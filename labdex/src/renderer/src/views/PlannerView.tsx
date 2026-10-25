import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { AlertTriangle, Check, Moon, Printer, Search, Trash2, Zap, Droplets } from 'lucide-react'
import { formatDuration, type LabTest } from '@shared/types'
import { planCollection, type Draw } from '@shared/helpers'
import { cx, fmtNum, type Lookups } from '../lib/util'
import { StorageBadge, TubeIcon } from '../components/Visuals'

interface Props {
  tests: LabTest[]
  lookups: Lookups
  selected: string[]
  setSelected: Dispatch<SetStateAction<string[]>>
}

export function PlannerView({ tests, lookups, selected, setSelected }: Props) {
  const [q, setQ] = useState('')
  const list = q.trim() ? lookups.search(tests, q) : [...tests].sort((a, b) => a.name.localeCompare(b.name))
  const picked = tests.filter((t) => selected.includes(t.id))

  const toggle = (id: string) => setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]))

  const plan = useMemo(() => planCollection(picked, lookups.con), [picked, lookups])
  const { blood, other, slowest } = plan
  const draws: Draw[] = [...blood, ...other]
  const prep = picked.filter((t) => t.patientPrep)
  const light = [...new Set(draws.flatMap((d) => d.samples.filter((p) => p.specimen.protectFromLight).map((p) => p.test.code)))]
  const noStat = picked.filter((t) => !t.tatUrgent)
  const sampleList = (d: Draw) => (
    <ul>
      {d.samples.map((p) => (
        <li key={p.test.id + p.specimen.id}>
          <span className="mono">{p.test.code}</span> {p.test.name}
          {p.alternatives.length > 0 && <span className="alt-note"> · or {p.alternatives.map((a) => lookups.con(a.containerId)?.name ?? a.sampleType).join(' / ')}</span>}
        </li>
      ))}
    </ul>
  )

  return (
    <div className="planner">
      <div className="planner-pick">
        <div className="toolbar-title">
          <h1>Collection planner</h1>
          <span className="mono muted">{String(picked.length).padStart(2, '0')} selected</span>
        </div>
        <p className="muted small">Pick the tests ordered for a patient. LabDex works out the tubes and the order of draw.</p>
        <div className="search">
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a test…" />
        </div>
        <div className="pick-list">
          {list.map((t) => {
            const on = selected.includes(t.id)
            return (
              <button key={t.id} className={cx('pick-item', on && 'active')} onClick={() => toggle(t.id)} style={{ ['--dep' as string]: lookups.dep(t.departmentId)?.color }}>
                <span className="pick-box">{on && <Check size={12} strokeWidth={3} />}</span>
                <span className="mono code">{t.code}</span>
                <span className="pick-name">{t.name}</span>
                <span className="pick-dots">
                  {t.specimens.map((sp) => (
                    <span key={sp.id} className="cap-dot" style={{ background: lookups.con(sp.containerId)?.capColor }} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="planner-tray">
        {picked.length === 0 ? (
          <div className="empty">
            <Droplets size={34} strokeWidth={1.4} />
            <h3>The tray is empty</h3>
            <p>Select tests on the left to build a collection plan.</p>
          </div>
        ) : (
          <>
            <div className="tray-head">
              <div>
                <span className="eyebrow">Order of draw</span>
                <h2>
                  {plan.totalContainers} containers
                  {plan.minBloodMl > 0 && (
                    <span className="mono muted">
                      {' '}
                      · ≥{fmtNum(plan.minBloodMl)} mL blood (min.)
                    </span>
                  )}
                </h2>
              </div>
              <div className="sheet-head-actions">
                <button className="btn btn-ghost" onClick={() => setSelected([])}>
                  <Trash2 size={14} /> Clear
                </button>
                <button className="btn" onClick={() => window.print()}>
                  <Printer size={14} /> Print
                </button>
              </div>
            </div>

            {blood.length > 0 && (
              <ol className="tray">
                {blood.map((d, i) => (
                  <li key={d.container.id} className="tray-slot">
                    <span className="tray-step mono">{i + 1}</span>
                    <div className="tray-tubes">
                      {Array.from({ length: d.tubes }, (_, k) => (
                        <TubeIcon key={k} container={d.container} size={78} />
                      ))}
                    </div>
                    <strong>{d.container.name}</strong>
                    <em>{d.container.additive}</em>
                    <span className="mono tray-vol">
                      {d.tubes > 1 ? `${d.tubes} × ` : ''}
                      {d.container.size}
                    </span>
                    {sampleList(d)}
                  </li>
                ))}
              </ol>
            )}

            {other.length > 0 && (
              <>
                <h4 className="tray-sub">Other specimens</h4>
                <div className="other-specimens">
                  {other.map((d) => (
                    <div key={d.container.id} className="other-item">
                      <TubeIcon container={d.container} size={46} />
                      <div>
                        <strong>{d.container.name}</strong>
                        <div className="muted small">{sampleList(d)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="tray-notes">
              {prep.length > 0 && (
                <div className="note-card">
                  <h4>
                    <AlertTriangle size={14} /> Patient preparation
                  </h4>
                  {prep.map((t) => (
                    <p key={t.id}>
                      <span className="mono">{t.code}</span> {t.patientPrep}
                    </p>
                  ))}
                </div>
              )}
              <div className="note-card">
                <h4>
                  <Zap size={14} /> Handling
                </h4>
                {draws.map((d) => (
                  <p key={d.container.id} className="handling-row">
                    <span className="cap-dot" style={{ background: d.container.capColor }} />
                    {d.container.name.replace(/ top.*$/i, '')}
                    <StorageBadge temp={d.samples[0].specimen.storageTemp} compact />
                  </p>
                ))}
                {light.length > 0 && (
                  <p>
                    <Moon size={13} /> Protect from light: {light.join(', ')}
                  </p>
                )}
                {slowest && (
                  <p className="muted">
                    Full results expected within <strong className="mono">{formatDuration(slowest.tatRoutine)}</strong> ({slowest.code})
                  </p>
                )}
                {noStat.length > 0 && <p className="muted">No STAT option: {noStat.map((t) => t.code).join(', ')}</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
