import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  Download,
  FileEdit,
  FolderOpen,
  Library,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Sun,
  TestTubes,
  Upload,
  ClipboardList,
  Lock,
  UsersRound,
  Zap
} from 'lucide-react'
import { primarySpecimen, type LabTest, type LogState, type Snapshot, type SyncCheck, type TestInput } from '@shared/types'
import { ROLE_LABEL } from '@shared/staff'
import { CHECK_INTERVAL_MS } from '@shared/sync'
import { api, blankTest, cx, duplicateInput, errMsg, makeLookups, relTime, toInput } from './lib/util'
import { useToast } from './components/Toasts'
import { TestDetail } from './components/TestDetail'
import { TestForm } from './components/TestForm'
import { ConfirmDialog } from './components/ConfirmDialog'
import { CommandPalette, type PaletteAction } from './components/CommandPalette'
import { CatalogView } from './views/CatalogView'
import { PlannerView } from './views/PlannerView'
import { LookupsView } from './views/LookupsView'
import { SettingsView } from './views/SettingsView'
import { SampleLogView } from './views/SampleLogView'
import { StaffView } from './views/StaffView'
import { IdentityProvider, isCancel, type RequireStaff } from './components/Identity'
import { StorageBadge } from './components/Visuals'

type View = 'directory' | 'planner' | 'log' | 'staff' | 'lookups' | 'settings'
type Scope = 'active' | 'DRAFT' | 'ARCHIVED'
type Theme = 'system' | 'light' | 'dark'

interface Confirm {
  title: string
  body: string
  confirmLabel: string
  requireText?: string
  danger?: boolean
  onConfirm: () => void
}

const readPref = <T extends string>(key: string, fallback: T): T => {
  try {
    return (localStorage.getItem(key) as T) || fallback
  } catch {
    return fallback
  }
}
const writePref = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* non-essential */
  }
}

export function App() {
  const toast = useToast()
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [view, setView] = useState<View>('directory')
  const [scope, setScope] = useState<Scope>('active')
  const [depFilter, setDepFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<TestInput | null>(null)
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [palette, setPalette] = useState(false)
  const [query, setQuery] = useState('')
  const [plannerSel, setPlannerSel] = useState<string[]>([])
  const [theme, setTheme] = useState<Theme>(() => readPref<Theme>('labdex.theme', 'system'))
  const [update, setUpdate] = useState<SyncCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [logState, setLogState] = useState<LogState>({ views: [], waitingUpload: 0, needsPin: [] })
  const searchRef = useRef<HTMLInputElement>(null)
  const requireRef = useRef<RequireStaff | null>(null)

  const reload = useCallback(async () => {
    const [s, l] = await Promise.all([api.getAll(), api.getLogs()])
    setSnap(s)
    setLogState(l)
  }, [])
  useEffect(() => {
    void reload()
    // Background sync (new logs, staff, releases) tells us when to refresh.
    return api.onChanged(() => void reload())
  }, [reload])

  // Anyone may open edit screens; saving asks a Senior to confirm (main process enforces it too).
  const canEdit = true
  const feedUrl = snap?.sync.feedUrl ?? ''
  const cloudOn = !!snap?.cloud.connected

  /** Ask for a Senior (or whatever role) before an action; false when cancelled / refused. */
  const confirmAs = useCallback(
    async (role: 'SENIOR' | 'TECH', reason: string) => {
      try {
        await requireRef.current!(role, reason)
        return true
      } catch (e) {
        if (!isCancel(e)) toast('error', 'Not allowed', errMsg(e))
        return false
      }
    },
    [toast]
  )

  // Update checks: on start-up, every few minutes, and when the window regains focus.
  const checkUpdate = useCallback(
    async (quiet = true) => {
      setChecking(true)
      try {
        const c = await api.checkForUpdate()
        setUpdate(c)
        if (!quiet && c.error) toast('error', 'Could not check for updates', c.error)
        if (!quiet && !c.error && !c.available) toast('ok', 'Already up to date')
        await reload()
      } finally {
        setChecking(false)
      }
    },
    [reload, toast]
  )
  useEffect(() => {
    if (!feedUrl && !cloudOn) return
    void checkUpdate()
    const timer = setInterval(() => void checkUpdate(), CHECK_INTERVAL_MS)
    const onFocus = () => void checkUpdate()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [feedUrl, cloudOn, checkUpdate])

  const syncNow = async () => {
    try {
      const r = await api.syncNow()
      setUpdate(null)
      setSelectedId(null)
      await reload()
      toast('ok', 'Directory updated', `${r.tests} tests · published ${new Date(r.revision).toLocaleString()}`)
    } catch (e) {
      toast('error', 'Sync failed', errMsg(e))
    }
  }

  // Theme: resolve "system" and keep the native title bar in sync.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const mode = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme
      document.documentElement.dataset.theme = mode
      api.setTheme(mode)
    }
    apply()
    writePref('labdex.theme', theme)
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const lookups = useMemo(() => makeLookups(snap?.departments ?? [], snap?.containers ?? []), [snap])
  const tests = useMemo(() => snap?.tests ?? [], [snap])
  const active = useMemo(() => tests.filter((t) => t.status !== 'ARCHIVED'), [tests])

  const scoped = useMemo(() => {
    let list = scope === 'active' ? active : tests.filter((t) => t.status === scope)
    if (depFilter) list = list.filter((t) => t.departmentId === depFilter)
    return list
  }, [tests, active, scope, depFilter])

  const selected = tests.find((t) => t.id === selectedId) ?? null

  const startNew = useCallback(async () => {
    if (await confirmAs('SENIOR', 'add a test')) setEditing(blankTest(depFilter ?? '', ''))
  }, [depFilter, confirmAs])

  const startEdit = async (t: LabTest) => {
    if (await confirmAs('SENIOR', `edit ${t.code}`)) setEditing(toInput(t))
  }

  const save = async (input: TestInput) => {
    if (!(await confirmAs('SENIOR', 'save the test'))) return
    try {
      const saved = await api.saveTest(input)
      await reload()
      setEditing(null)
      setSelectedId(saved.id)
      setView('directory')
      toast('ok', input.id ? `${saved.code} updated` : `${saved.code} created`, input.id ? `Now version ${saved.version}` : undefined)
    } catch (e) {
      toast('error', 'Could not save test', errMsg(e))
    }
  }

  const act = async (fn: () => Promise<unknown>, ok: string, reason: string) => {
    if (!(await confirmAs('SENIOR', reason))) return
    try {
      await fn()
      await reload()
      toast('ok', ok)
    } catch (e) {
      toast('error', 'Something went wrong', errMsg(e))
    }
  }

  const archive = (t: LabTest) =>
    setConfirm({
      title: `Archive ${t.code}?`,
      body: `“${t.name}” will be hidden from the directory. You can restore it any time from Archived.`,
      confirmLabel: 'Archive',
      onConfirm: () => {
        setConfirm(null)
        void act(() => api.archiveTest(t.id), `${t.code} archived`, `archive ${t.code}`)
      }
    })

  const hardDelete = (t: LabTest) =>
    setConfirm({
      title: `Permanently delete ${t.code}?`,
      body: `This removes “${t.name}” and its entire version history. This cannot be undone.`,
      confirmLabel: 'Delete forever',
      requireText: t.code,
      danger: true,
      onConfirm: () => {
        setConfirm(null)
        setSelectedId(null)
        void act(() => api.deleteTest(t.id), `${t.code} deleted`, `delete ${t.code}`)
      }
    })

  const duplicate = async (t: LabTest) => {
    if (await confirmAs('SENIOR', `duplicate ${t.code}`)) setEditing(duplicateInput(t))
  }

  const exportCsv = async () => {
    try {
      const path = await api.exportCsv()
      if (path) toast('ok', 'Directory exported', path)
    } catch (e) {
      toast('error', 'Export failed', errMsg(e))
    }
  }

  const importCsv = async () => {
    if (!(await confirmAs('SENIOR', 'import tests'))) return
    try {
      const r = await api.importCsv()
      if (!r) return
      await reload()
      toast(r.errors.length ? 'error' : 'ok', `Imported: ${r.added} added, ${r.updated} updated`, r.errors.length ? `${r.errors.length} row(s) skipped — ${r.errors.slice(0, 2).join('; ')}` : undefined)
    } catch (e) {
      toast('error', 'Import failed', errMsg(e))
    }
  }

  // Global shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing || confirm) return
      const typing = e.target instanceof Element && e.target.matches('input, textarea, select')
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      } else if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        startNew()
      } else if (mod && e.key.toLowerCase() === 'e' && selected && selected.status !== 'ARCHIVED') {
        e.preventDefault()
        void startEdit(selected)
      } else if (e.key === '/' && !typing) {
        e.preventDefault()
        setView('directory')
        setTimeout(() => searchRef.current?.focus())
      } else if (e.key === 'Escape' && !typing && selectedId && !palette) {
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, confirm, selected, selectedId, palette, startNew, canEdit])

  const paletteActions: PaletteAction[] = [
    { id: 'new', label: 'New test', icon: Plus, hint: 'Ctrl N', run: () => void startNew() },
    { id: 'planner', label: 'Open collection planner', icon: TestTubes, run: () => setView('planner') },
    { id: 'log', label: 'Sample log (handover)', icon: ClipboardList, run: () => setView('log') },
    { id: 'staff', label: 'Staff list', icon: UsersRound, run: () => setView('staff') },
    { id: 'lookups', label: 'Containers & departments', icon: SlidersHorizontal, run: () => setView('lookups') },
    { id: 'settings', label: 'Sync & settings', icon: Settings2, run: () => setView('settings') },
    { id: 'check', label: 'Check for updates', icon: RefreshCw, run: () => void checkUpdate(false) },
    { id: 'import', label: 'Import tests from CSV', icon: Upload, run: importCsv },
    { id: 'export', label: 'Export directory to CSV', icon: Download, run: exportCsv },
    { id: 'theme', label: 'Toggle light / dark theme', icon: Moon, run: () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark') }
  ]

  if (!snap) return <div className="boot">LabDex</div>

  const counts = {
    active: active.length,
    drafts: tests.filter((t) => t.status === 'DRAFT').length,
    archived: tests.filter((t) => t.status === 'ARCHIVED').length
  }
  const heading =
    scope === 'DRAFT' ? 'Drafts' : scope === 'ARCHIVED' ? 'Archived' : depFilter ? (lookups.dep(depFilter)?.name ?? 'Directory') : 'Test directory'

  return (
    <IdentityProvider snap={snap} reload={reload} requireRef={requireRef}>
    <div className="app">
      <header className="titlebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">
            Lab<b>Dex</b>
          </span>
        </div>
        <button className="palette-trigger" onClick={() => setPalette(true)}>
          <Search size={14} />
          <span>Search tests or jump to…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <span className="titlebar-fill" />
        {snap.session ? (
          <span className="session-chip" title={`Confirmed on this computer until ${new Date(snap.session.until).toLocaleTimeString()}`}>
            <span className="id-avatar sm">{snap.session.name.slice(0, 1).toUpperCase()}</span>
            {snap.session.name} · {ROLE_LABEL[snap.session.role]}
            <button
              className="btn btn-icon btn-sm btn-ghost"
              title="Lock — next person must confirm"
              aria-label="Lock"
              onClick={async () => {
                await api.lockSession()
                await reload()
              }}
            >
              <Lock size={13} />
            </button>
          </span>
        ) : snap.staff.length > 0 ? (
          <span className="viewer-chip muted" title="Nobody is confirmed on this computer">
            <Lock size={12} /> Locked
          </span>
        ) : null}
      </header>

      <aside className="rail">
        <nav className="rail-nav">
          <RailItem icon={Library} label="Directory" active={view === 'directory' && scope === 'active' && !depFilter} count={counts.active} onClick={() => { setView('directory'); setScope('active'); setDepFilter(null) }} />
          <RailItem icon={TestTubes} label="Collection planner" active={view === 'planner'} count={plannerSel.length || undefined} onClick={() => setView('planner')} />
          <RailItem icon={ClipboardList} label="Sample log" active={view === 'log'} count={logState.views.filter((v) => v.open).length || undefined} onClick={() => setView('log')} />
          <RailItem icon={UsersRound} label="Staff" active={view === 'staff'} dot={snap.staff.length === 0} onClick={() => setView('staff')} />
          <RailItem icon={SlidersHorizontal} label="Lookups" active={view === 'lookups'} onClick={() => setView('lookups')} />
          <RailItem icon={Settings2} label="Settings" active={view === 'settings'} dot={!!update?.available} onClick={() => setView('settings')} />
        </nav>

        <div className="rail-section">
          <span className="rail-label">Departments</span>
          {snap.departments.map((d) => {
            const n = active.filter((t) => t.departmentId === d.id).length
            return (
              <button
                key={d.id}
                className={cx('rail-dep', view === 'directory' && depFilter === d.id && 'active')}
                style={{ ['--dep' as string]: d.color }}
                onClick={() => {
                  setView('directory')
                  setScope('active')
                  setDepFilter(depFilter === d.id ? null : d.id)
                }}
              >
                <span className="rail-dep-bar" />
                <span className="rail-dep-name">{d.name}</span>
                <span className="mono count">{n}</span>
              </button>
            )
          })}
        </div>

        <div className="rail-section">
          <span className="rail-label">Status</span>
          <RailItem icon={FileEdit} label="Drafts" small active={view === 'directory' && scope === 'DRAFT'} count={counts.drafts} onClick={() => { setView('directory'); setScope('DRAFT'); setDepFilter(null) }} />
          <RailItem icon={Archive} label="Archived" small active={view === 'directory' && scope === 'ARCHIVED'} count={counts.archived} onClick={() => { setView('directory'); setScope('ARCHIVED'); setDepFilter(null) }} />
        </div>

        <div className="rail-foot">
          <div className="rail-tools">
            <button className="btn btn-icon btn-ghost" onClick={importCsv} title="Import CSV">
              <Upload size={15} />
            </button>
            <button className="btn btn-icon btn-ghost" onClick={exportCsv} title="Export CSV">
              <Download size={15} />
            </button>
            <button className="btn btn-icon btn-ghost" onClick={() => void api.openDataFolder()} title={`Data file: ${snap.dataPath}`}>
              <FolderOpen size={15} />
            </button>
          </div>
          <div className="segmented segmented-icons theme-switch" role="radiogroup" aria-label="Theme">
            {(
              [
                ['light', Sun],
                ['system', Monitor],
                ['dark', Moon]
              ] as const
            ).map(([m, Icon]) => (
              <button key={m} className={cx(theme === m && 'active')} onClick={() => setTheme(m)} aria-label={`${m} theme`} title={`${m[0].toUpperCase()}${m.slice(1)} theme`}>
                <Icon size={13} />
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className={cx('main', (view === 'directory' || view === 'log') && 'with-detail', update?.available && 'has-banner')}>
        {update?.available && (
          <div className="update-banner">
            <RefreshCw size={15} />
            <span>
              <b>Update available</b> — published by {update.publishedBy}
              {update.publishedAt ? ` ${relTime(update.publishedAt)}` : ''}
            </span>
            <button className="btn btn-sm btn-primary" onClick={syncNow}>
              Sync now
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setUpdate(null)}>
              Later
            </button>
          </div>
        )}
        {view === 'directory' && (
          <>
            <CatalogView
              tests={scoped}
              containers={snap.containers}
              lookups={lookups}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
              onNew={() => void startNew()}
              query={query}
              setQuery={setQuery}
              searchRef={searchRef}
              heading={heading}
            />
            <div className="detail-pane">
              {selected ? (
                <TestDetail
                  key={selected.id}
                  test={selected}
                  lookups={lookups}
                  onEdit={() => void startEdit(selected)}
                  onDuplicate={() => duplicate(selected)}
                  onArchive={() => archive(selected)}
                  onRestore={() => act(() => api.restoreTest(selected.id), `${selected.code} restored`, `restore ${selected.code}`)}
                  onDelete={() => hardDelete(selected)}
                  onChanged={reload}
                  canEdit={canEdit}
                />
              ) : (
                <Overview tests={active} drafts={counts.drafts} />
              )}
            </div>
          </>
        )}
        {view === 'planner' && <PlannerView tests={active.filter((t) => t.status === 'PUBLISHED')} lookups={lookups} selected={plannerSel} setSelected={setPlannerSel} />}
        {view === 'log' && <SampleLogView snap={snap} lookups={lookups} state={logState} reload={reload} />}
        {view === 'staff' && <StaffView snap={snap} onChanged={reload} />}
        {view === 'lookups' && <LookupsView tests={tests} containers={snap.containers} departments={snap.departments} onChanged={reload} />}
        {view === 'settings' && (
          <SettingsView
            snap={snap}
            update={update}
            checking={checking}
            onCheck={() => void checkUpdate(false)}
            onSync={syncNow}
            onChanged={reload}
            onImportCsv={importCsv}
            onExportCsv={exportCsv}
            theme={theme}
            setTheme={setTheme}
          />
        )}
      </main>

      {editing && <TestForm initial={editing} tests={tests} departments={snap.departments} containers={snap.containers} onSave={save} onClose={() => setEditing(null)} />}
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      {palette && (
        <CommandPalette
          tests={tests}
          lookups={lookups}
          actions={paletteActions}
          onPickTest={(t) => {
            setView('directory')
            setScope(t.status === 'ARCHIVED' ? 'ARCHIVED' : 'active')
            setDepFilter(null)
            setSelectedId(t.id)
          }}
          onClose={() => setPalette(false)}
        />
      )}
    </div>
    </IdentityProvider>
  )
}

function RailItem({
  icon: Icon,
  label,
  active,
  count,
  small,
  dot,
  onClick
}: {
  icon: typeof Library
  label: string
  active: boolean
  count?: number
  small?: boolean
  dot?: boolean
  onClick: () => void
}) {
  return (
    <button className={cx('rail-item', active && 'active', small && 'small')} onClick={onClick}>
      <Icon size={small ? 15 : 17} />
      <span>{label}</span>
      {count != null && <span className="mono count">{count}</span>}
      {dot && <span className="rail-dot" aria-label="Update available" />}
    </button>
  )
}

function Overview({ tests, drafts }: { tests: LabTest[]; drafts: number }) {
  const temps = (['ROOM', 'FRIDGE', 'FROZEN', 'DEEP_FROZEN'] as const).map((t) => ({ t, n: tests.filter((x) => primarySpecimen(x)?.storageTemp === t).length }))
  const stat = tests.filter((t) => t.tatUrgent).length
  const max = Math.max(1, ...temps.map((x) => x.n))
  return (
    <div className="overview">
      <span className="eyebrow">Directory at a glance</span>
      <div className="readouts">
        <div className="readout">
          <span>Active tests</span>
          <strong className="mono">{String(tests.length).padStart(3, '0')}</strong>
        </div>
        <div className="readout">
          <span>
            <Zap size={12} /> STAT available
          </span>
          <strong className="mono">{String(stat).padStart(3, '0')}</strong>
        </div>
        <div className="readout">
          <span>Drafts</span>
          <strong className="mono">{String(drafts).padStart(3, '0')}</strong>
        </div>
      </div>
      <h4>By storage</h4>
      <div className="bars">
        {temps.map(({ t, n }) => (
          <div key={t} className="bar-row">
            <StorageBadge temp={t} compact />
            <span className={`bar storage-${t.toLowerCase()}`}>
              <span style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="mono">{n}</span>
          </div>
        ))}
      </div>
      <div className="tips">
        <p>
          <kbd>Ctrl K</kbd> jump to any test
        </p>
        <p>
          <kbd>Ctrl N</kbd> new test · <kbd>Ctrl E</kbd> edit selected
        </p>
        <p>
          <kbd>/</kbd> search · <kbd>Esc</kbd> close
        </p>
      </div>
    </div>
  )
}
