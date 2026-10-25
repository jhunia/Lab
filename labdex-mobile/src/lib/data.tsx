import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import { LabCore, createSeedDb, parsePackage, type DbFile, type UpdatePackage } from '@shared/core'
import { searchTests } from '@shared/search'
import { CHECK_INTERVAL_MS, UPDATE_FILE_NAME, checkFeed, httpGetText } from '@shared/sync'
import { CloudClient, cloudConfigError } from '@shared/cloud'
import { LogCore, emptyLogFile, type LogFile, type LogView, type SampleStatus } from '@shared/logs'
import { PinThrottle, SESSION_MS, hasRole, type Staff, type StaffInput, type StaffRole, type StaffSession } from '@shared/staff'
import { identify, pullLogs, pushOutbox, sessionValid } from '@shared/teamsync'
import { DEFAULT_SYNC, type CloudStatus, type Container, type Department, type LabTest, type SyncCheck, type SyncSettings } from '@shared/types'
import { DB_KEY, LOGS_KEY, SYNC_KEY, enableUpdateNotifications, loadSync, notifyUpdate } from './background'

/** How often the open app syncs the staff list, sample log and releases with the cloud. */
const TEAM_SYNC_MS = 60_000

interface Snapshot {
  tests: LabTest[]
  containers: Container[]
  departments: Department[]
  revision: number
  staff: Staff[]
}

export interface NeedsPin {
  eventId: string
  staffName: string
  staffNumber: string
  labNumber: string
  error: string
}

interface DataCtx extends Snapshot {
  ready: boolean
  core: LabCore
  sync: SyncSettings
  update: SyncCheck | null
  checking: boolean
  cloud: CloudStatus
  // Staff identity
  session: StaffSession | null
  /** Confirms a person (staff record + PIN). Throws with a readable message on failure. */
  identify: (staffId: string, pin: string, minRole: StaffRole, allowProvisional: boolean) => Promise<{ provisional: boolean }>
  lock: () => void
  /** True when the action is allowed now without asking (or nobody is set up yet on a no-cloud phone). */
  allowedNow: (min: StaffRole) => boolean
  saveStaff: (input: StaffInput, newPin: string | null) => Promise<Staff>
  changeOwnPin: (staffId: string, oldPin: string, newPin: string) => Promise<void>
  // Directory
  /** Runs a change against the shared engine (Senior confirmed, or first-time setup) and re-renders. */
  mutate: <T>(fn: (core: LabCore) => T) => T
  dep: (id: string) => Department | undefined
  con: (id: string) => Container | undefined
  search: (q: string, list?: LabTest[]) => LabTest[]
  resetToSample: () => void
  // Updates
  checkUpdate: () => Promise<SyncCheck>
  syncNow: () => Promise<{ revision: number; tests: number }>
  dismissUpdate: () => void
  openUpdateFile: () => Promise<{ revision: number; tests: number } | null>
  publish: (publishedBy: string) => Promise<'cloud' | 'file'>
  setFeedUrl: (url: string) => Promise<void>
  // Cloud
  setCloud: (cfg: { url: string; anonKey: string } | null) => Promise<{ staff: number }>
  teamSync: () => Promise<void>
  // Sample log
  logs: LogView[]
  waitingUpload: number
  needsPin: NeedsPin[]
  createLog: (input: { labNumber: string; tests: LabTest[]; status: SampleStatus; note: string }) => string
  addLogEvent: (logId: string, status: SampleStatus, note: string) => void
  reconfirmUpload: (eventId: string, pin: string) => void
}

const Ctx = createContext<DataCtx | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const coreRef = useRef<LabCore | null>(null)
  const logsRef = useRef<LogCore | null>(null)
  const cloudRef = useRef<CloudClient | null>(null)
  const sessionRef = useRef<StaffSession | null>(null)
  const throttle = useRef(new PinThrottle()).current
  const writes = useRef(Promise.resolve())
  const logWrites = useRef(Promise.resolve())
  const pending = useRef<UpdatePackage | null>(null)
  const syncing = useRef(false)
  const [snap, setSnap] = useState<Snapshot>({ tests: [], containers: [], departments: [], revision: 0, staff: [] })
  const [logState, setLogState] = useState<{ logs: LogView[]; waitingUpload: number; needsPin: NeedsPin[] }>({ logs: [], waitingUpload: 0, needsPin: [] })
  const [sync, setSync] = useState<SyncSettings>({ ...DEFAULT_SYNC })
  const [update, setUpdate] = useState<SyncCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [cloud, setCloudStatus] = useState<CloudStatus>({ connected: false, lastSyncAt: null, error: '' })
  const [session, setSession] = useState<StaffSession | null>(null)
  const [ready, setReady] = useState(false)
  const syncRef = useRef(sync)
  syncRef.current = sync

  // Writes are queued so a slow save can never overtake a newer one.
  const persist = useCallback((db: DbFile) => {
    const json = JSON.stringify(db)
    writes.current = writes.current.then(() => AsyncStorage.setItem(DB_KEY, json)).catch(() => {})
  }, [])
  const persistLogs = useCallback((f: LogFile) => {
    const json = JSON.stringify(f)
    logWrites.current = logWrites.current.then(() => AsyncStorage.setItem(LOGS_KEY, json)).catch(() => {})
  }, [])

  const saveSync = useCallback((next: SyncSettings) => {
    syncRef.current = next
    setSync(next)
    AsyncStorage.setItem(SYNC_KEY, JSON.stringify(next)).catch(() => {})
  }, [])

  const refresh = useCallback(() => {
    const s = coreRef.current!.snapshot()
    setSnap({ tests: s.tests, containers: s.containers, departments: s.departments, revision: s.revision, staff: s.staff })
    const out = logsRef.current!.outbox()
    setLogState({
      logs: logsRef.current!.views(),
      waitingUpload: out.length,
      needsPin: out
        .filter((o) => o.item.needsPin)
        .map((o) => ({ eventId: o.event.id, staffName: o.event.staffName, staffNumber: o.event.staffNumber, labNumber: o.log.labNumber, error: o.item.error }))
    })
  }, [])

  const makeCloud = useCallback((s: SyncSettings) => {
    cloudRef.current = s.cloudUrl && s.cloudKey ? new CloudClient({ url: s.cloudUrl, anonKey: s.cloudKey }) : null
    setCloudStatus((c) => ({ ...c, connected: !!cloudRef.current, error: '' }))
  }, [])

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(DB_KEY), AsyncStorage.getItem(LOGS_KEY), loadSync()])
      .then(([raw, rawLogs, s]) => {
        let db: unknown = null
        try {
          db = raw ? JSON.parse(raw) : null
        } catch {
          db = null
        }
        if (!db) {
          db = createSeedDb()
          persist(db as DbFile)
        }
        // LabCore upgrades older saved data (v1, one sample per test) on load.
        coreRef.current = new LabCore(db, persist)
        let logs: unknown = emptyLogFile()
        try {
          logs = rawLogs ? JSON.parse(rawLogs) : emptyLogFile()
        } catch {
          logs = emptyLogFile()
        }
        logsRef.current = new LogCore(logs, persistLogs)
        syncRef.current = s
        setSync(s)
        makeCloud(s)
        refresh()
      })
      .finally(() => setReady(true))
  }, [persist, persistLogs, refresh, makeCloud])

  // ---------- Identity ----------

  const setSess = useCallback((s: StaffSession | null) => {
    sessionRef.current = s
    setSession(s)
  }, [])

  // Expire the session on time even while the app sits open.
  useEffect(() => {
    if (!session) return
    const t = setTimeout(() => setSess(null), Math.max(0, session.until - Date.now()))
    return () => clearTimeout(t)
  }, [session, setSess])

  /** Senior/tech check for an action; also slides the session window forward. */
  const requireRole = useCallback(
    (min: StaffRole): StaffSession | null => {
      if (coreRef.current!.snapshot().staff.length === 0 && !cloudRef.current) return null // first-time setup
      const s = sessionRef.current
      if (!sessionValid(s)) throw new Error(min === 'SENIOR' ? 'Confirm you are a Senior first' : 'Confirm who you are first')
      if (!hasRole(s.role, min)) throw new Error(min === 'SENIOR' ? 'Only a Senior can do this' : 'Viewers cannot log samples')
      const slid = { ...s, until: Date.now() + SESSION_MS }
      setSess(slid)
      return slid
    },
    [setSess]
  )

  const allowedNow = useCallback((min: StaffRole) => {
    if (coreRef.current && coreRef.current.snapshot().staff.length === 0 && !cloudRef.current) return true
    const s = sessionRef.current
    return sessionValid(s) && hasRole(s.role, min)
  }, [])

  const identifyFn = useCallback(
    async (staffId: string, pin: string, minRole: StaffRole, allowProvisional: boolean) => {
      const person = coreRef.current!.snapshot().staff.find((x) => x.id === staffId)
      if (!person) throw new Error('Pick your name from the list')
      const r = await identify({ staff: person, pin, minRole, core: coreRef.current!, cloud: cloudRef.current, throttle, allowProvisional })
      setSess(r.session)
      refresh()
      return { provisional: r.provisional }
    },
    [throttle, setSess, refresh]
  )

  const saveStaff = useCallback(
    async (input: StaffInput, newPin: string | null) => {
      const core = coreRef.current!
      const c = cloudRef.current
      if (c) {
        const empty = (await c.listStaff()).length === 0
        const actor = empty ? null : requireRole('SENIOR')
        const saved = await c.saveStaff(actor && { staffNumber: actor.staffNumber, pin: actor.pin }, input, newPin)
        core.replaceStaff(await c.listStaff())
        if (newPin) core.rememberPin(saved.id, newPin)
        refresh()
        return saved
      }
      if (core.snapshot().staff.length > 0) requireRole('SENIOR')
      else input = { ...input, role: 'SENIOR', active: true } // the first person sets up the lab
      const saved = core.saveStaff(input, newPin)
      refresh()
      return saved
    },
    [requireRole, refresh]
  )

  const changeOwnPin = useCallback(
    async (staffId: string, oldPin: string, newPin: string) => {
      const core = coreRef.current!
      const person = core.snapshot().staff.find((s) => s.id === staffId)
      if (!person) throw new Error('Staff member not found')
      if (cloudRef.current) {
        await cloudRef.current.changeOwnPin(person.staffNumber, oldPin, newPin)
        core.rememberPin(person.id, newPin)
      } else {
        await identify({ staff: person, pin: oldPin, minRole: 'VIEWER', core, cloud: null, throttle, allowProvisional: false })
        core.saveStaff(person, newPin)
      }
      refresh()
    },
    [throttle, refresh]
  )

  // ---------- Directory ----------

  const mutate = useCallback(
    <T,>(fn: (core: LabCore) => T): T => {
      requireRole('SENIOR')
      const result = fn(coreRef.current!)
      refresh()
      return result
    },
    [refresh, requireRole]
  )

  const resetToSample = useCallback(() => {
    requireRole('SENIOR')
    const staff = coreRef.current!.snapshot().staff
    const db = { ...createSeedDb(), staff }
    coreRef.current = new LabCore(db, persist)
    persist(db)
    saveSync({ ...syncRef.current, syncedRevision: 0 })
    refresh()
  }, [persist, refresh, saveSync, requireRole])

  const applyPackage = useCallback(
    (pkg: UpdatePackage) => {
      const r = coreRef.current!.applyPackage(pkg)
      saveSync({ ...syncRef.current, syncedRevision: r.revision })
      setUpdate(null)
      pending.current = null
      refresh()
      return r
    },
    [refresh, saveSync]
  )

  // ---------- Updates (cloud releases, or update-file link) ----------

  const checkUpdate = useCallback(async (): Promise<SyncCheck> => {
    const s = syncRef.current
    const local = Math.max(s.syncedRevision, coreRef.current?.snapshot().revision ?? 0)
    const c = cloudRef.current
    if (!c && !s.feedUrl) return { available: false, remoteRevision: 0, publishedAt: null, publishedBy: '', error: 'No update link set' }
    setChecking(true)
    try {
      let check: SyncCheck
      if (c) {
        try {
          const rel = await c.latestRelease()
          check = rel
            ? { available: rel.revision > local, remoteRevision: rel.revision, publishedAt: rel.publishedAt, publishedBy: rel.publisherName }
            : { available: false, remoteRevision: 0, publishedAt: null, publishedBy: '' }
        } catch (e) {
          check = { available: false, remoteRevision: 0, publishedAt: null, publishedBy: '', error: e instanceof Error ? e.message : String(e) }
        }
        pending.current = null
      } else {
        const r = await checkFeed(s.feedUrl, local, httpGetText)
        check = r.check
        pending.current = check.available ? r.pkg : null
      }
      setUpdate(check)
      saveSync({ ...syncRef.current, lastCheckedAt: new Date().toISOString() })
      if (check.available) notifyUpdate(check.remoteRevision, check.publishedBy).catch(() => {})
      return check
    } finally {
      setChecking(false)
    }
  }, [saveSync])

  const syncNow = useCallback(async () => {
    let pkg = pending.current
    const c = cloudRef.current
    if (!pkg && c) {
      const rel = await c.latestRelease()
      if (!rel) throw new Error('Nothing has been published yet')
      pkg = await c.fetchRelease(rel.revision)
    }
    if (!pkg) {
      const { check, pkg: fresh } = await checkFeed(syncRef.current.feedUrl, 0, httpGetText)
      if (!fresh) throw new Error(check.error ?? 'Could not download the update')
      pkg = fresh
    }
    return applyPackage(pkg)
  }, [applyPackage])

  const openUpdateFile = useCallback(async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true })
    if (res.canceled || !res.assets[0]) return null
    return applyPackage(parsePackage(await new File(res.assets[0].uri).text()))
  }, [applyPackage])

  const publish = useCallback(
    async (publishedBy: string): Promise<'cloud' | 'file'> => {
      const who = requireRole('SENIOR')
      const c = cloudRef.current
      const pkg = coreRef.current!.exportPackage(publishedBy || who?.name || 'LabDex')
      if (c) {
        if (!who) throw new Error('Confirm you are a Senior first')
        await c.publish({ staffNumber: who.staffNumber, pin: who.pin }, pkg)
        saveSync({ ...syncRef.current, syncedRevision: pkg.revision })
        refresh()
        return 'cloud'
      }
      saveSync({ ...syncRef.current, syncedRevision: pkg.revision })
      refresh()
      const file = new File(Paths.cache, UPDATE_FILE_NAME)
      if (file.exists) file.delete()
      file.create()
      await file.write(JSON.stringify(pkg))
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device')
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Publish LabDex update', UTI: 'public.json' })
      return 'file'
    },
    [refresh, saveSync, requireRole]
  )

  const setFeedUrl = useCallback(
    async (url: string) => {
      saveSync({ ...syncRef.current, feedUrl: url.trim() })
      if (url.trim()) await enableUpdateNotifications()
    },
    [saveSync]
  )

  // ---------- Cloud team sync ----------

  const teamSync = useCallback(async () => {
    const c = cloudRef.current
    if (!c || syncing.current || !coreRef.current || !logsRef.current) return
    syncing.current = true
    try {
      coreRef.current.replaceStaff(await c.listStaff())
      await pushOutbox(c, logsRef.current)
      await pullLogs(c, logsRef.current)
      setCloudStatus({ connected: true, lastSyncAt: new Date().toISOString(), error: '' })
    } catch (e) {
      setCloudStatus((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }))
    } finally {
      syncing.current = false
      refresh()
    }
  }, [refresh])

  const setCloud = useCallback(
    async (cfg: { url: string; anonKey: string } | null) => {
      if (cfg) {
        const err = cloudConfigError(cfg)
        if (err) throw new Error(err)
        const r = await new CloudClient(cfg).ping()
        const next = { ...syncRef.current, cloudUrl: cfg.url.trim().replace(/\/+$/, ''), cloudKey: cfg.anonKey.trim() }
        saveSync(next)
        makeCloud(next)
        setSess(null)
        await enableUpdateNotifications()
        await teamSync()
        return r
      }
      const next = { ...syncRef.current, cloudUrl: '', cloudKey: '' }
      saveSync(next)
      makeCloud(next)
      setSess(null)
      return { staff: coreRef.current!.snapshot().staff.length }
    },
    [saveSync, makeCloud, setSess, teamSync]
  )

  // Check when the app opens, every minute/few minutes while open, and when it returns to the foreground.
  useEffect(() => {
    if (!ready) return
    const run = () => {
      void teamSync()
      if (cloudRef.current || syncRef.current.feedUrl) void checkUpdate()
    }
    run()
    const team = setInterval(() => void teamSync(), TEAM_SYNC_MS)
    const upd = setInterval(() => (cloudRef.current || syncRef.current.feedUrl) && void checkUpdate(), CHECK_INTERVAL_MS)
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run())
    return () => {
      clearInterval(team)
      clearInterval(upd)
      sub.remove()
    }
  }, [ready, sync.cloudUrl, sync.feedUrl, teamSync, checkUpdate])

  // ---------- Sample log ----------

  const createLog = useCallback(
    (input: { labNumber: string; tests: LabTest[]; status: SampleStatus; note: string }) => {
      const who = requireRole('TECH')
      if (!who) throw new Error('Add yourself to the staff list first (Settings → Staff)')
      const person = coreRef.current!.snapshot().staff.find((s) => s.id === who.staffId)!
      const log = logsRef.current!.create(input, person, who.pin)
      refresh()
      void teamSync()
      return log.id
    },
    [requireRole, refresh, teamSync]
  )

  const addLogEvent = useCallback(
    (logId: string, status: SampleStatus, note: string) => {
      const who = requireRole('TECH')
      if (!who) throw new Error('Add yourself to the staff list first')
      const person = coreRef.current!.snapshot().staff.find((s) => s.id === who.staffId)!
      logsRef.current!.addEvent(logId, status, note, person, who.pin)
      refresh()
      void teamSync()
    },
    [requireRole, refresh, teamSync]
  )

  const reconfirmUpload = useCallback(
    (eventId: string, pin: string) => {
      logsRef.current!.reconfirm(eventId, pin)
      refresh()
      void teamSync()
    },
    [refresh, teamSync]
  )

  const value = useMemo<DataCtx>(() => {
    const d = new Map(snap.departments.map((x) => [x.id, x]))
    const c = new Map(snap.containers.map((x) => [x.id, x]))
    return {
      ...snap,
      ...logState,
      ready,
      core: coreRef.current!,
      sync,
      update,
      checking,
      cloud,
      session: sessionValid(session) ? session : null,
      identify: identifyFn,
      lock: () => setSess(null),
      allowedNow,
      saveStaff,
      changeOwnPin,
      mutate,
      resetToSample,
      dep: (id) => d.get(id),
      con: (id) => c.get(id),
      search: (q, list) => searchTests(list ?? snap.tests, q, { departments: snap.departments }),
      checkUpdate,
      syncNow,
      dismissUpdate: () => setUpdate(null),
      openUpdateFile,
      publish,
      setFeedUrl,
      setCloud,
      teamSync,
      createLog,
      addLogEvent,
      reconfirmUpload
    }
  }, [
    snap,
    logState,
    ready,
    sync,
    update,
    checking,
    cloud,
    session,
    identifyFn,
    setSess,
    allowedNow,
    saveStaff,
    changeOwnPin,
    mutate,
    resetToSample,
    checkUpdate,
    syncNow,
    openUpdateFile,
    publish,
    setFeedUrl,
    setCloud,
    teamSync,
    createLog,
    addLogEvent,
    reconfirmUpload
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData(): DataCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useData must be used inside DataProvider')
  return v
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
