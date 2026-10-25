import { app, BrowserWindow, dialog, ipcMain, nativeTheme, Notification, shell } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  DEFAULT_SYNC,
  type CloudStatus,
  type Container,
  type Department,
  type LogState,
  type PublicSession,
  type SyncSettings,
  type TestInput,
  type ThemeMode
} from '@shared/types'
import { parsePackage, type LabCore, type UpdatePackage } from '@shared/core'
import { importCsv, toCsv } from '@shared/csv'
import { UPDATE_FILE_NAME, checkFeed, httpGetText } from '@shared/sync'
import { CloudClient, cloudConfigError } from '@shared/cloud'
import { LogCore, emptyLogFile, type LogFile, type SampleStatus } from '@shared/logs'
import { PinThrottle, SESSION_MS, hasRole, type StaffInput, type StaffRole, type StaffSession } from '@shared/staff'
import { identify, pullLogs, pushOutbox, sessionValid } from '@shared/teamsync'
import { openStore, writeJsonAtomic } from './store'

let win: BrowserWindow | null = null
let store: LabCore
let logs: LogCore
let dataFile = ''
let syncFile = ''
let logsFile = ''
let sync: SyncSettings = { ...DEFAULT_SYNC }
let cloud: CloudClient | null = null
let cloudStatus: CloudStatus = { connected: false, lastSyncAt: null, error: '' }
/** Who is confirmed on this computer. The PIN stays in this process only. */
let session: StaffSession | null = null
const throttle = new PinThrottle()
/** Update found by the last check, kept so "Sync now" doesn't download twice. */
let pendingPackage: UpdatePackage | null = null
let lastNotifiedRevision = 0

const SYNC_EVERY_MS = 60_000

function loadSync(): void {
  try {
    if (existsSync(syncFile)) sync = { ...DEFAULT_SYNC, ...(JSON.parse(readFileSync(syncFile, 'utf8')) as Partial<SyncSettings>) }
  } catch {
    /* keep defaults */
  }
}
const saveSync = () => writeFileSync(syncFile, JSON.stringify(sync, null, 2), 'utf8')

function makeCloud(): void {
  cloud = sync.cloudUrl && sync.cloudKey ? new CloudClient({ url: sync.cloudUrl, anonKey: sync.cloudKey }) : null
  cloudStatus = { connected: !!cloud, lastSyncAt: cloudStatus.lastSyncAt, error: '' }
}

const publicSession = (): PublicSession | null => {
  if (!sessionValid(session)) return null
  const { pin: _pin, ...rest } = session
  return rest
}

/** Seniors only — except before any staff exist (first-time setup on a single computer). */
function requireRole(min: StaffRole): StaffSession | null {
  const staff = store.snapshot().staff
  if (staff.length === 0 && !cloud) return null
  if (!sessionValid(session)) throw new Error(min === 'SENIOR' ? 'Confirm you are a Senior first' : 'Confirm who you are first')
  if (!hasRole(session.role, min)) throw new Error(min === 'SENIOR' ? 'Only a Senior can do this' : 'Viewers cannot log samples')
  // Sliding window: keep the person confirmed while they are actively working.
  session.until = Date.now() + SESSION_MS
  return session
}

function senior<A extends unknown[], R>(fn: (...args: A) => R) {
  return (_e: unknown, ...args: A): R => {
    requireRole('SENIOR')
    return fn(...args)
  }
}

function snapshot() {
  const s = store.snapshot()
  return {
    tests: s.tests,
    containers: s.containers,
    departments: s.departments,
    revision: s.revision,
    // PIN checks never leave the main process.
    staff: s.staff.map((x) => ({ ...x, pinSalt: '', pinCheck: x.pinCheck ? 'known' : '' })),
    dataPath: dataFile,
    sync: { ...sync, cloudKey: sync.cloudKey ? '••••' + sync.cloudKey.slice(-6) : '' },
    session: publicSession(),
    cloud: cloudStatus
  }
}

function logState(): LogState {
  const out = logs.outbox()
  return {
    views: logs.views(),
    waitingUpload: out.length,
    needsPin: out
      .filter((o) => o.item.needsPin)
      .map((o) => ({ eventId: o.event.id, staffName: o.event.staffName, staffNumber: o.event.staffNumber, labNumber: o.log.labNumber, error: o.item.error }))
  }
}

const changed = () => win?.webContents.send('labdex:changed')

// ---------- Background team sync (cloud mode) ----------

let syncing = false
async function teamSync(): Promise<void> {
  if (!cloud || syncing) return
  syncing = true
  try {
    store.replaceStaff(await cloud.listStaff())
    await pushOutbox(cloud, logs)
    await pullLogs(cloud, logs)
    const rel = await cloud.latestRelease()
    const local = Math.max(sync.syncedRevision, store.snapshot().revision)
    if (rel && rel.revision > local && rel.revision > lastNotifiedRevision) {
      lastNotifiedRevision = rel.revision
      if (Notification.isSupported()) new Notification({ title: 'LabDex update available', body: `${rel.publisherName} published new test information. Open LabDex and click Sync now.` }).show()
    }
    cloudStatus = { connected: true, lastSyncAt: new Date().toISOString(), error: '' }
  } catch (e) {
    cloudStatus = { ...cloudStatus, error: e instanceof Error ? e.message : String(e) }
  } finally {
    syncing = false
    changed()
  }
}

const OVERLAY = {
  light: { color: '#F3F4EF', symbolColor: '#14181F' },
  dark: { color: '#0B0F14', symbolColor: '#E6E9EE' }
}

function createWindow(): void {
  const mode: ThemeMode = nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'LabDex',
    backgroundColor: OVERLAY[mode].color,
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...OVERLAY[mode], height: 44 },
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => win?.show())
  win.on('focus', () => void teamSync())

  // Open external links in the user's browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('tests:all', () => snapshot())
  ipcMain.handle('tests:save', senior((input: TestInput) => store.saveTest(input)))
  ipcMain.handle('tests:archive', senior((id: string) => store.archiveTest(id)))
  ipcMain.handle('tests:restore', senior((id: string) => store.restoreTest(id)))
  ipcMain.handle('tests:delete', senior((id: string) => store.deleteTest(id)))
  ipcMain.handle('tests:history', (_e, id: string) => store.history(id))
  ipcMain.handle('tests:revert', senior((historyId: string) => store.revertTo(historyId)))

  ipcMain.handle('containers:save', senior((c: Container) => store.saveContainer(c)))
  ipcMain.handle('containers:delete', senior((id: string) => store.deleteContainer(id)))
  ipcMain.handle('departments:save', senior((d: Department) => store.saveDepartment(d)))
  ipcMain.handle('departments:delete', senior((id: string) => store.deleteDepartment(id)))

  // ---------- Staff identity ----------
  ipcMain.handle('staff:identify', async (_e, staffId: string, pin: string, minRole: StaffRole, allowProvisional: boolean) => {
    const person = store.snapshot().staff.find((s) => s.id === staffId)
    if (!person) throw new Error('Pick your name from the list')
    const r = await identify({ staff: person, pin, minRole, core: store, cloud, throttle, allowProvisional })
    session = r.session
    return { session: publicSession(), provisional: r.provisional }
  })
  ipcMain.handle('staff:lock', () => {
    session = null
  })
  ipcMain.handle('staff:save', async (_e, input: StaffInput, newPin: string | null) => {
    const staff = store.snapshot().staff
    if (cloud) {
      const empty = (await cloud.listStaff()).length === 0
      const actor = empty ? null : requireRole('SENIOR')
      const saved = await cloud.saveStaff(actor && { staffNumber: actor.staffNumber, pin: actor.pin }, input, newPin)
      store.replaceStaff(await cloud.listStaff())
      if (newPin) store.rememberPin(saved.id, newPin)
      return saved
    }
    if (staff.length > 0) requireRole('SENIOR')
    else input = { ...input, role: 'SENIOR', active: true } // first person sets up the lab
    return store.saveStaff(input, newPin)
  })
  ipcMain.handle('staff:changePin', async (_e, staffId: string, oldPin: string, newPin: string) => {
    const person = store.snapshot().staff.find((s) => s.id === staffId)
    if (!person) throw new Error('Staff member not found')
    if (cloud) {
      await cloud.changeOwnPin(person.staffNumber, oldPin, newPin)
      store.rememberPin(person.id, newPin)
      return
    }
    await identify({ staff: person, pin: oldPin, minRole: 'VIEWER', core: store, cloud: null, throttle, allowProvisional: false })
    store.saveStaff(person, newPin)
  })

  // ---------- Cloud ----------
  ipcMain.handle('cloud:set', async (_e, cfg: { url: string; anonKey: string } | null) => {
    if (cfg) {
      const err = cloudConfigError(cfg)
      if (err) throw new Error(err)
      const probe = new CloudClient(cfg)
      const r = await probe.ping() // throws with a readable message if unreachable / not set up
      sync = { ...sync, cloudUrl: cfg.url.trim().replace(/\/+$/, ''), cloudKey: cfg.anonKey.trim() }
      saveSync()
      makeCloud()
      session = null
      await teamSync()
      return r
    }
    sync = { ...sync, cloudUrl: '', cloudKey: '' }
    saveSync()
    makeCloud()
    session = null
    return { staff: store.snapshot().staff.length }
  })
  ipcMain.handle('cloud:sync', () => teamSync())

  // ---------- Sample log ----------
  ipcMain.handle('logs:all', () => logState())
  ipcMain.handle('logs:create', (_e, input: { labNumber: string; testIds: string[]; status: SampleStatus; note: string }) => {
    const who = requireRole('TECH')
    if (!who) throw new Error('Add yourself to the staff list first (Staff → Add the first Senior)')
    const person = store.snapshot().staff.find((s) => s.id === who.staffId)!
    const tests = input.testIds.map((id) => store.snapshot().tests.find((t) => t.id === id)).filter((t) => !!t)
    const log = logs.create({ labNumber: input.labNumber, tests, status: input.status, note: input.note }, person, who.pin)
    changed()
    void teamSync()
    return log
  })
  ipcMain.handle('logs:event', (_e, logId: string, status: SampleStatus, note: string) => {
    const who = requireRole('TECH')
    if (!who) throw new Error('Add yourself to the staff list first')
    const person = store.snapshot().staff.find((s) => s.id === who.staffId)!
    logs.addEvent(logId, status, note, person, who.pin)
    changed()
    void teamSync()
  })
  ipcMain.handle('logs:reconfirm', (_e, eventId: string, pin: string) => {
    logs.reconfirm(eventId, pin)
    void teamSync()
  })

  // ---------- Directory updates (cloud releases, or update file when no cloud) ----------
  ipcMain.handle(
    'sync:publish',
    senior(async (publishedBy: string) => {
      if (cloud) {
        const who = requireRole('SENIOR')!
        const pkg = store.exportPackage(publishedBy || who.name)
        await cloud.publish({ staffNumber: who.staffNumber, pin: who.pin }, pkg)
        sync = { ...sync, syncedRevision: pkg.revision }
        saveSync()
        return 'the cloud'
      }
      const res = await dialog.showSaveDialog(win!, {
        title: 'Publish update — save into your shared OneDrive / Google Drive / Dropbox folder',
        defaultPath: UPDATE_FILE_NAME,
        filters: [{ name: 'LabDex update', extensions: ['json'] }]
      })
      if (res.canceled || !res.filePath) return null
      const pkg = store.exportPackage(publishedBy)
      writeFileSync(res.filePath, JSON.stringify(pkg), 'utf8')
      sync = { ...sync, syncedRevision: pkg.revision }
      saveSync()
      return res.filePath
    })
  )

  ipcMain.handle('sync:openFile', async () => {
    const res = await dialog.showOpenDialog(win!, {
      title: 'Open a LabDex update file',
      properties: ['openFile'],
      filters: [{ name: 'LabDex update', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    const result = store.applyPackage(parsePackage(readFileSync(res.filePaths[0], 'utf8')))
    sync = { ...sync, syncedRevision: result.revision }
    saveSync()
    return result
  })

  ipcMain.handle('sync:check', async () => {
    const local = Math.max(sync.syncedRevision, store.snapshot().revision)
    sync = { ...sync, lastCheckedAt: new Date().toISOString() }
    saveSync()
    if (cloud) {
      try {
        const rel = await cloud.latestRelease()
        pendingPackage = null
        return rel && rel.revision > local
          ? { available: true, remoteRevision: rel.revision, publishedAt: rel.publishedAt, publishedBy: rel.publisherName }
          : { available: false, remoteRevision: rel?.revision ?? 0, publishedAt: rel?.publishedAt ?? null, publishedBy: rel?.publisherName ?? '' }
      } catch (e) {
        return { available: false, remoteRevision: 0, publishedAt: null, publishedBy: '', error: e instanceof Error ? e.message : String(e) }
      }
    }
    if (!sync.feedUrl) return { available: false, remoteRevision: 0, publishedAt: null, publishedBy: '', error: 'No update link set' }
    const { check, pkg } = await checkFeed(sync.feedUrl, local, httpGetText)
    pendingPackage = check.available ? pkg : null
    return check
  })

  ipcMain.handle('sync:now', async () => {
    let pkg = pendingPackage
    if (!pkg && cloud) {
      const rel = await cloud.latestRelease()
      if (!rel) throw new Error('Nothing has been published yet')
      pkg = await cloud.fetchRelease(rel.revision)
    }
    if (!pkg) {
      const { check, pkg: fresh } = await checkFeed(sync.feedUrl, 0, httpGetText)
      if (!fresh) throw new Error(check.error ?? 'Could not download the update')
      pkg = fresh
    }
    const result = store.applyPackage(pkg)
    pendingPackage = null
    sync = { ...sync, syncedRevision: result.revision }
    saveSync()
    return result
  })

  ipcMain.handle('sync:settings', (_e, patch: Partial<Pick<SyncSettings, 'feedUrl'>>) => {
    sync = { ...sync, ...patch }
    saveSync()
    return sync
  })

  ipcMain.handle('csv:export', async () => {
    const stamp = new Date().toISOString().slice(0, 10)
    const res = await dialog.showSaveDialog(win!, {
      title: 'Export test directory',
      defaultPath: `labdex-tests-${stamp}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (res.canceled || !res.filePath) return null
    writeFileSync(res.filePath, toCsv(store), 'utf8')
    return res.filePath
  })

  ipcMain.handle('csv:import', async () => {
    requireRole('SENIOR')
    const res = await dialog.showOpenDialog(win!, {
      title: 'Import tests from CSV',
      properties: ['openFile'],
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (res.canceled || !res.filePaths[0]) return null
    return importCsv(store, readFileSync(res.filePaths[0], 'utf8'))
  })

  ipcMain.handle('app:openDataFolder', () => shell.openPath(dirname(dataFile)))

  ipcMain.on('app:theme', (_e, mode: ThemeMode) => {
    win?.setTitleBarOverlay({ ...OVERLAY[mode], height: 44 })
    win?.setBackgroundColor(OVERLAY[mode].color)
  })
}

function openLogs(file: string): LogCore {
  let raw: unknown = emptyLogFile()
  if (existsSync(file)) {
    try {
      raw = JSON.parse(readFileSync(file, 'utf8'))
    } catch (err) {
      console.error('Sample log file was unreadable; starting a new one and keeping the old copy', err)
      writeFileSync(`${file}.corrupt-${Date.now()}`, readFileSync(file))
    }
  }
  return new LogCore(raw, (f: LogFile) => writeJsonAtomic(file, f))
}

app.whenReady().then(() => {
  app.setAppUserModelId('app.labdex.desktop')
  const dir = app.getPath('userData')
  dataFile = join(dir, 'labdex-data.json')
  syncFile = join(dir, 'labdex-sync.json')
  logsFile = join(dir, 'labdex-logs.json')
  store = openStore(dataFile)
  logs = openLogs(logsFile)
  loadSync()
  makeCloud()
  registerIpc()
  createWindow()
  void teamSync()
  setInterval(() => void teamSync(), SYNC_EVERY_MS)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
