import { useMemo, useState, type RefObject } from 'react'
import { LayoutGrid, Plus, Rows3, Search, X, FlaskConical } from 'lucide-react'
import { STORAGE_LABELS, formatDuration, toMinutes, type Container, type LabTest, type StorageTemp } from '@shared/types'
import { cx, fmtNum, relTime, type Lookups } from '../lib/util'
import { TestCard } from '../components/TestCard'
import { ContainerChip, StorageBadge } from '../components/Visuals'

type Sort = 'name' | 'code' | 'tat' | 'updated'

interface Props {
  tests: LabTest[]
  containers: Container[]
  lookups: Lookups
  selectedId: string | null
  onSelect: (id: string) => void
  /** Undefined on Viewer devices: hides the New test buttons. */
  onNew?: () => void
  query: string
  setQuery: (q: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  heading: string
}

const TEMPS = Object.keys(STORAGE_LABELS) as StorageTemp[]

export function CatalogView({ tests, containers, lookups, selectedId, onSelect, onNew, query, setQuery, searchRef, heading }: Props) {
  const [view, setView] = useState<'grid' | 'table'>(() => {
    try {
      return localStorage.getItem('labdex.view') === 'table' ? 'table' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const [temp, setTemp] = useState<StorageTemp | null>(null)
  const [containerId, setContainerId] = useState('')
  const [sort, setSort] = useState<Sort>('name')

  const rows = useMemo(() => {
    let list = query.trim() ? lookups.search(tests, query) : [...tests]
    if (temp) list = list.filter((t) => t.specimens.some((s) => s.storageTemp === temp))
    if (containerId) list = list.filter((t) => t.specimens.some((s) => s.containerId === containerId))
    if (!query.trim()) {
      list.sort((a, b) =>
        sort === 'code'
          ? a.code.localeCompare(b.code)
          : sort === 'tat'
            ? toMinutes(a.tatRoutine) - toMinutes(b.tatRoutine)
            : sort === 'updated'
              ? b.updatedAt.localeCompare(a.updatedAt)
              : a.name.localeCompare(b.name)
      )
    }
    return list
  }, [tests, lookups, query, temp, containerId, sort])

  const switchView = (v: 'grid' | 'table') => {
    setView(v)
    try {
      localStorage.setItem('labdex.view', v)
    } catch {
      /* non-essential */
    }
  }

  const usedContainers = containers.filter((c) => tests.some((t) => t.specimens.some((s) => s.containerId === c.id)))
  const filtered = temp || containerId

  return (
    <div className="catalog">
      <div className="toolbar">
        <div className="toolbar-title">
          <h1>{heading}</h1>
          <span className="mono muted">{String(rows.length).padStart(3, '0')} tests</span>
        </div>
        <div className="search">
          <Search size={16} />
          <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, code, synonym…" onKeyDown={(e) => e.key === 'Escape' && setQuery('')} />
          {query ? (
            <button className="btn btn-icon btn-ghost" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </div>
        {onNew && (
          <button className="btn btn-primary" onClick={onNew}>
            <Plus size={15} /> New test <kbd className="kbd-on-primary">Ctrl N</kbd>
          </button>
        )}
      </div>

      <div className="filterbar">
        <div className="filter-group">
          {TEMPS.map((t) => (
            <button key={t} className={cx('filter-chip', temp === t && 'active')} onClick={() => setTemp(temp === t ? null : t)}>
              <StorageBadge temp={t} compact />
            </button>
          ))}
        </div>
        <select className="input input-sm" value={containerId} onChange={(e) => setContainerId(e.target.value)} aria-label="Filter by container">
          <option value="">All containers</option>
          {usedContainers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {filtered && (
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setTemp(null)
              setContainerId('')
            }}
          >
            <X size={12} /> Clear
          </button>
        )}
        <div className="filter-end">
        <select className="input input-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)} disabled={!!query.trim()} aria-label="Sort">
          <option value="name">Sort: Name</option>
          <option value="code">Sort: Code</option>
          <option value="tat">Sort: Fastest TAT</option>
          <option value="updated">Sort: Recently updated</option>
        </select>
        <div className="segmented segmented-icons">
          <button className={cx(view === 'grid' && 'active')} onClick={() => switchView('grid')} aria-label="Rack view">
            <LayoutGrid size={15} />
          </button>
          <button className={cx(view === 'table' && 'active')} onClick={() => switchView('table')} aria-label="Table view">
            <Rows3 size={15} />
          </button>
        </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          <FlaskConical size={34} strokeWidth={1.4} />
          <h3>{query ? `Nothing matches “${query}”` : 'No tests here yet'}</h3>
          <p>{query ? 'Try a code, abbreviation or synonym.' : 'Add your first test or import a CSV from the sidebar.'}</p>
          {!query && onNew && (
            <button className="btn btn-primary" onClick={onNew}>
              <Plus size={15} /> New test
            </button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="rack">
          {rows.map((t) => (
            <TestCard key={t.id} test={t} dep={lookups.dep(t.departmentId)} conOf={lookups.con} selected={t.id === selectedId} onClick={() => onSelect(t.id)} />
          ))}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Test</th>
                <th>Sample</th>
                <th className="right">Vol.</th>
                <th>Container</th>
                <th>Storage</th>
                <th className="right">TAT</th>
                <th className="right">STAT</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const dep = lookups.dep(t.departmentId)
                return (
                  <tr
                    key={t.id}
                    className={cx(t.id === selectedId && 'selected', t.status === 'ARCHIVED' && 'archived')}
                    onClick={() => onSelect(t.id)}
                    style={{ ['--dep' as string]: dep?.color }}
                  >
                    <td className="mono code-cell">
                      <span className="dep-tick" />
                      {t.code}
                    </td>
                    <td>
                      <strong>{t.name}</strong>
                      {t.status === 'DRAFT' && <span className="status status-draft">draft</span>}
                    </td>
                    <td className="muted">
                      {t.specimens.map((sp) => (
                        <div key={sp.id} className="cell-line">
                          {sp.role === 'ALTERNATIVE' && t.specimens.length > 1 && <span className="or-tag">or</span>}
                          {sp.sampleType}
                        </div>
                      ))}
                    </td>
                    <td className="mono right">
                      {t.specimens.map((sp) => (
                        <div key={sp.id} className="cell-line">
                          {fmtNum(sp.volume)} {sp.volumeUnit}
                        </div>
                      ))}
                    </td>
                    <td>
                      {t.specimens.map((sp) => (
                        <div key={sp.id} className="cell-line">
                          <ContainerChip container={lookups.con(sp.containerId)} />
                        </div>
                      ))}
                    </td>
                    <td>
                      {t.specimens.map((sp) => (
                        <div key={sp.id} className="cell-line">
                          <StorageBadge temp={sp.storageTemp} compact />
                        </div>
                      ))}
                    </td>
                    <td className="mono right">{formatDuration(t.tatRoutine)}</td>
                    <td className="mono right urgent-text">{formatDuration(t.tatUrgent)}</td>
                    <td className="muted nowrap">{relTime(t.updatedAt)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
