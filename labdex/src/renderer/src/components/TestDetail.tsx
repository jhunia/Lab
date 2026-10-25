import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore, Copy, History, Moon, Pencil, Printer, RotateCcw, Trash2, XOctagon, CheckSquare, User, Truck, Clock } from 'lucide-react'
import { STORAGE_LABELS, formatDuration, type HistoryEntry, type LabTest, type Specimen } from '@shared/types'
import { specimenSummary } from '@shared/helpers'
import { api, cx, errMsg, fmtNum, relTime, type Lookups } from '../lib/util'
import { Barcode, ContainerChip, StorageBadge, TatBar, TubeIcon, TubeStack } from './Visuals'
import { useToast } from './Toasts'
import { isCancel, useRequireStaff } from './Identity'

interface Props {
  test: LabTest
  lookups: Lookups
  onEdit: () => void
  onDuplicate: () => void
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
  onChanged: () => void
  /** False on Viewer devices: hides every action that changes data. */
  canEdit: boolean
}

const ACTION_LABEL: Record<HistoryEntry['action'], string> = {
  created: 'Created',
  updated: 'Edited',
  archived: 'Archived',
  restored: 'Restored',
  reverted: 'Reverted',
  imported: 'Imported'
}

export function TestDetail({ test, lookups, onEdit, onDuplicate, onArchive, onRestore, onDelete, onChanged, canEdit }: Props) {
  const [tab, setTab] = useState<'details' | 'history'>('details')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const toast = useToast()
  const requireStaff = useRequireStaff()
  const dep = lookups.dep(test.departmentId)
  const archived = test.status === 'ARCHIVED'

  useEffect(() => {
    if (tab === 'history') void api.getHistory(test.id).then(setHistory)
  }, [tab, test.id, test.version])

  const revert = async (h: HistoryEntry) => {
    try {
      await requireStaff('SENIOR', `restore version ${h.version}`)
      await api.revertTo(h.id)
      toast('ok', `Reverted to v${h.version}`)
      onChanged()
    } catch (e) {
      if (!isCancel(e)) toast('error', 'Could not revert', errMsg(e))
    }
  }

  return (
    <article className="detail" style={{ ['--dep' as string]: dep?.color ?? 'var(--muted)' }}>
      <header className="label-card">
        <span className="label-rail" />
        <div className="label-top">
          <div className="label-code">
            <span className="mono">{test.code}</span>
            <Barcode value={test.code} />
          </div>
          <span className={cx('status', `status-${test.status.toLowerCase()}`)}>{test.status.toLowerCase()}</span>
        </div>
        <div className="label-main">
          <div>
            <h2>{test.name}</h2>
            {test.synonyms.length > 0 && <p className="synonyms">aka {test.synonyms.join(' · ')}</p>}
            <p className="dep-name">
              <span className="dep-dot" />
              {dep?.name ?? 'Unassigned'}
            </p>
          </div>
          <div className="label-tube">
            <TubeStack containers={test.specimens.map((x) => lookups.con(x.containerId))} size={64} />
          </div>
        </div>
        <span className="label-perf" />
      </header>

      <div className="detail-actions">
        {canEdit && !archived && (
          <button className="btn btn-primary" onClick={onEdit}>
            <Pencil size={14} /> Edit
          </button>
        )}
        {canEdit && (
          <button className="btn" onClick={onDuplicate} title="Duplicate as new test">
            <Copy size={14} /> Duplicate
          </button>
        )}
        <button className="btn" onClick={() => window.print()} title="Print bench card">
          <Printer size={14} />
        </button>
        <span className="spacer" />
        {!canEdit ? null : archived ? (
          <>
            <button className="btn" onClick={onRestore}>
              <ArchiveRestore size={14} /> Restore
            </button>
            <button className="btn btn-danger-ghost" onClick={onDelete}>
              <Trash2 size={14} /> Delete
            </button>
          </>
        ) : (
          <button className="btn btn-ghost" onClick={onArchive} title="Archive (can be restored)">
            <Archive size={14} /> Archive
          </button>
        )}
      </div>

      <nav className="tabs">
        <button className={cx(tab === 'details' && 'active')} onClick={() => setTab('details')}>
          Details
        </button>
        <button className={cx(tab === 'history' && 'active')} onClick={() => setTab('history')}>
          <History size={13} /> History <span className="count">v{test.version}</span>
        </button>
      </nav>

      {tab === 'details' ? (
        <div className="detail-body">
          {test.description && <p className="lede">{test.description}</p>}

          <section>
            <h4>
              Samples <span className="h4-note">{specimenSummary(test)}</span>
            </h4>
            {test.specimens.map((sp, i) => (
              <SampleCard key={sp.id} sp={sp} index={i} total={test.specimens.length} lookups={lookups} />
            ))}
            {test.transportNotes && (
              <p className="note">
                <Truck size={14} /> {test.transportNotes}
              </p>
            )}
          </section>

          <section>
            <h4>Turnaround</h4>
            <div className="tat-row">
              <div className="spec">
                <span>Routine</span>
                <strong className="mono big">{formatDuration(test.tatRoutine)}</strong>
              </div>
              <div className="spec">
                <span>Urgent / STAT</span>
                <strong className={cx('mono big', test.tatUrgent && 'urgent')}>{formatDuration(test.tatUrgent)}</strong>
              </div>
              <div className="spec">
                <span>Performed</span>
                <strong>{test.daysPerformed || '—'}</strong>
              </div>
            </div>
            <TatBar routine={test.tatRoutine} urgent={test.tatUrgent} showTicks />
          </section>

          {test.patientPrep && (
            <section>
              <h4>Patient preparation</h4>
              <p className="note">
                <User size={14} /> {test.patientPrep}
              </p>
            </section>
          )}

          {test.suggestions.length > 0 && (
            <section>
              <h4>Collection tips</h4>
              <ul className="checklist">
                {test.suggestions.map((s, i) => (
                  <li key={i}>
                    <CheckSquare size={15} /> {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {test.rejectionCriteria.length > 0 && (
            <section>
              <h4 className="danger-h">Reject if</h4>
              <ul className="checklist reject">
                {test.rejectionCriteria.map((s, i) => (
                  <li key={i}>
                    <XOctagon size={15} /> {s}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <footer className="meta">
            <Clock size={12} /> v{test.version} · updated {relTime(test.updatedAt)} · created {new Date(test.createdAt).toLocaleDateString()}
          </footer>
        </div>
      ) : (
        <ol className="timeline">
          {history.map((h, i) => (
            <li key={h.id} className={cx(i === 0 && 'current')}>
              <span className="tl-dot" />
              <div className="tl-head">
                <strong>
                  v{h.version} · {ACTION_LABEL[h.action]}
                </strong>
                <time title={new Date(h.at).toLocaleString()}>{relTime(h.at)}</time>
              </div>
              {h.changes.length > 0 && <p className="tl-changes">{h.changes.join(', ')}</p>}
              {canEdit && i > 0 && (
                <button className="btn btn-sm btn-ghost" onClick={() => revert(h)}>
                  <RotateCcw size={12} /> Restore this version
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}

function SampleCard({ sp, index, total, lookups }: { sp: Specimen; index: number; total: number; lookups: Lookups }) {
  const con = lookups.con(sp.containerId)
  return (
    <div className={cx('sample-card', sp.role === 'ALTERNATIVE' && 'alt')}>
      {total > 1 && (
        <div className="sample-head">
          <span className="mono">Sample {index + 1}</span>
          <span className={cx('role-pill', sp.role === 'ALTERNATIVE' ? 'role-alt' : 'role-req')}>{sp.role === 'ALTERNATIVE' ? 'or — alternative' : 'required'}</span>
        </div>
      )}
      <div className="sample-main">
        <TubeIcon container={con} size={46} />
        <div className="sample-info">
          <strong>{sp.sampleType}</strong>
          <ContainerChip container={con} />
          {con && (
            <em>
              {con.additive} · {con.size}
              {con.drawOrder < 99 && <> · draw #{con.drawOrder}</>}
            </em>
          )}
        </div>
        <div className="sample-vol">
          <strong className="mono">
            {fmtNum(sp.volume)}
            <small>{sp.volumeUnit}</small>
          </strong>
          {sp.minVolume != null && <span className="mono">min {fmtNum(sp.minVolume)}</span>}
          {sp.paedVolume != null && <span className="mono">paed {fmtNum(sp.paedVolume)}</span>}
        </div>
      </div>
      <div className="storage-row">
        <StorageBadge temp={sp.storageTemp} />
        {sp.protectFromLight && (
          <span className="storage storage-light">
            <Moon size={13} /> Protect from light
          </span>
        )}
      </div>
      {sp.stability.length > 0 && (
        <table className="mini-table">
          <tbody>
            {sp.stability.map((r, i) => (
              <tr key={i}>
                <td>Stable · {STORAGE_LABELS[r.temp].label}</td>
                <td className="mono muted">{STORAGE_LABELS[r.temp].range}</td>
                <td className="mono right">{formatDuration(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sp.notes && <p className="sample-notes">{sp.notes}</p>}
    </div>
  )
}
