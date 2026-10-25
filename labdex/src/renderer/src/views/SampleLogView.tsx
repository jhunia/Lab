import { useEffect, useMemo, useState } from 'react'
import { AlarmClock, CloudOff, CloudUpload, ClipboardList, KeyRound, Plus, Search, TimerReset, X } from 'lucide-react'
import type { LabTest, LogState, Snapshot } from '@shared/types'
import { STATUS_META, STATUS_ORDER, sampleAlerts, type LogView, type SampleStatus } from '@shared/logs'
import { api, cx, errMsg, relTime, type Lookups } from '../lib/util'
import { useToast } from '../components/Toasts'
import { isCancel, useRequireStaff } from '../components/Identity'
import { TubeStack } from '../components/Visuals'

type Filter = 'open' | 'today' | 'all'

export function SampleLogView({ snap, lookups, state, reload }: { snap: Snapshot; lookups: Lookups; state: LogState; reload: () => Promise<void> }) {
  const toast = useToast()
  const requireStaff = useRequireStaff()
  const [filter, setFilter] = useState<Filter>('open')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [logging, setLogging] = useState(false)
  const [reconfirm, setReconfirm] = useState<LogState['needsPin'][number] | null>(null)
  const [, tick] = useState(0)

  // Re-render every minute so "due in" warnings stay current.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [])

  const testsById = useMemo(() => new Map(snap.tests.map((t) => [t.id, t])), [snap.tests])
  const today = new Date().toDateString()
  const rows = state.views.filter((v) => {
    if (filter === 'open' && !v.open) return false
    if (filter === 'today' && new Date(v.last?.at ?? v.log.createdAt).toDateString() !== today) return false
    if (q.trim() && !`${v.log.labNumber} ${v.log.testCodes.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())) return false
    return true
  })
  // Open items: the most urgent (earliest stability deadline) first.
  const urgency = (v: LogView) => {
    if (!v.open || !v.first) return Number.MAX_SAFE_INTEGER
    const a = sampleAlerts(v.first.at, v.log.testIds.map((id) => testsById.get(id)).filter((t): t is LabTest => !!t))
    return Math.min(...a.map((x) => x.due.getTime()), Number.MAX_SAFE_INTEGER)
  }
  const sorted = filter === 'open' ? [...rows].sort((a, b) => urgency(a) - urgency(b)) : rows
  const current = state.views.find((v) => v.log.id === selected) ?? null
  const openCount = state.views.filter((v) => v.open).length

  const startLog = async () => {
    try {
      await requireStaff('TECH', 'log a sample', { allowProvisional: true })
      setLogging(true)
    } catch (e) {
      if (!isCancel(e)) toast('error', 'Cannot log yet', errMsg(e))
    }
  }

  return (
    <div className="logview">
      <div className="log-list">
        <div className="toolbar">
          <div className="toolbar-title">
            <h1>Sample log</h1>
            <span className="mono muted">{String(openCount).padStart(2, '0')} open</span>
          </div>
          <button className="btn btn-primary" onClick={startLog}>
            <Plus size={15} /> Log sample
          </button>
        </div>

        <UploadStrip snap={snap} state={state} onReconfirm={setReconfirm} />

        <div className="filterbar">
          <div className="segmented">
            {(['open', 'today', 'all'] as Filter[]).map((f) => (
              <button key={f} className={cx(filter === f && 'active')} onClick={() => setFilter(f)}>
                {f === 'open' ? 'Open items' : f === 'today' ? 'Today' : 'All'}
              </button>
            ))}
          </div>
          <div className="search log-search">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Lab number or test code…" />
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="empty">
            <ClipboardList size={34} strokeWidth={1.4} />
            <h3>{filter === 'open' ? 'Nothing open — all caught up' : 'No samples logged'}</h3>
            <p>Log a sample when it arrives so the next shift can pick it up. Only the lab number is stored — no patient names.</p>
          </div>
        ) : (
          <div className="log-rows">
            {sorted.map((v) => (
              <LogRow key={v.log.id} v={v} tests={v.log.testIds.map((id) => testsById.get(id)).filter((t): t is LabTest => !!t)} lookups={lookups} active={v.log.id === selected} onClick={() => setSelected(v.log.id)} />
            ))}
          </div>
        )}
      </div>

      <div className="detail-pane">
        {current ? (
          <LogDetail key={current.log.id} v={current} tests={current.log.testIds.map((id) => testsById.get(id)).filter((t): t is LabTest => !!t)} lookups={lookups} reload={reload} />
        ) : (
          <div className="overview">
            <span className="eyebrow">Handover</span>
            <p className="muted">
              Open items are sorted by urgency — samples closest to their stability limit come first. Pick one to see its timeline and add an update.
            </p>
            <div className="tips">
              <p>
                <b>Received</b> → <b>In progress</b> → <b>Pending</b> / <b>Sent out</b> → <b>Completed</b> or <b>Rejected</b>
              </p>
              <p>Every update records who made it and when. Entries are never edited — corrections are added as a new update.</p>
            </div>
          </div>
        )}
      </div>

      {logging && (
        <LogSampleDialog
          snap={snap}
          lookups={lookups}
          onClose={() => setLogging(false)}
          onDone={async (id) => {
            setLogging(false)
            setFilter('open')
            setSelected(id)
            await reload()
            toast('ok', 'Sample logged', snap.cloud.connected ? 'Uploading to the cloud…' : 'Saved on this computer')
          }}
        />
      )}
      {reconfirm && (
        <ReconfirmDialog
          item={reconfirm}
          onClose={() => setReconfirm(null)}
          onDone={async () => {
            setReconfirm(null)
            await reload()
            toast('ok', 'Re-confirmed — uploading')
          }}
        />
      )}
    </div>
  )
}

function UploadStrip({ snap, state, onReconfirm }: { snap: Snapshot; state: LogState; onReconfirm: (i: LogState['needsPin'][number]) => void }) {
  if (!snap.cloud.connected) {
    return (
      <div className="upload-strip muted-strip">
        <CloudOff size={14} /> Saved on this computer only. Connect the cloud in Settings so other devices and the next shift can see these.
      </div>
    )
  }
  return (
    <>
      {state.waitingUpload - state.needsPin.length > 0 && (
        <div className="upload-strip">
          <CloudUpload size={14} /> {state.waitingUpload - state.needsPin.length} entr{state.waitingUpload - state.needsPin.length === 1 ? 'y' : 'ies'} waiting to upload
          {snap.cloud.error ? <span className="err-text"> · {snap.cloud.error}</span> : ' · uploads automatically when online'}
        </div>
      )}
      {state.needsPin.map((n) => (
        <div key={n.eventId} className="upload-strip warn-strip">
          <KeyRound size={14} /> {n.staffName}’s entry for <b className="mono">{n.labNumber}</b> was not accepted ({n.error}).
          <button className="btn btn-sm" onClick={() => onReconfirm(n)}>
            Re-confirm
          </button>
        </div>
      ))}
    </>
  )
}

function StatusPill({ status }: { status: SampleStatus }) {
  return <span className={cx('log-status', `ls-${status.toLowerCase()}`)}>{STATUS_META[status].label}</span>
}

function AlertChips({ v, tests }: { v: LogView; tests: LabTest[] }) {
  if (!v.open || !v.first) return null
  return (
    <span className="alert-chips">
      {sampleAlerts(v.first.at, tests).map((a) => (
        <span key={a.kind} className={cx('alert-chip', `al-${a.level}`)} title={a.text}>
          {a.kind === 'stability' ? <TimerReset size={12} /> : <AlarmClock size={12} />} {a.text}
        </span>
      ))}
    </span>
  )
}

function LogRow({ v, tests, lookups, active, onClick }: { v: LogView; tests: LabTest[]; lookups: Lookups; active: boolean; onClick: () => void }) {
  return (
    <button className={cx('log-row', active && 'selected', !v.open && 'closed')} onClick={onClick}>
      <TubeStack containers={tests.flatMap((t) => t.specimens.filter((s) => s.role === 'REQUIRED').slice(0, 1).map((s) => lookups.con(s.containerId))).slice(0, 3)} size={36} />
      <div className="log-row-main">
        <div className="log-row-top">
          <span className="mono lab-no">{v.log.labNumber}</span>
          <StatusPill status={v.status} />
          {v.pendingUploads > 0 && <CloudUpload size={13} className="muted" aria-label="Waiting to upload" />}
        </div>
        <div className="muted small">{v.log.testCodes.join(' · ')}</div>
        <AlertChips v={v} tests={tests} />
      </div>
      <div className="log-row-meta">
        <span>{v.last?.staffName}</span>
        <span className="muted small">{v.last ? relTime(v.last.at) : ''}</span>
      </div>
    </button>
  )
}

function LogDetail({ v, tests, lookups, reload }: { v: LogView; tests: LabTest[]; lookups: Lookups; reload: () => Promise<void> }) {
  const toast = useToast()
  const requireStaff = useRequireStaff()
  const [status, setStatus] = useState<SampleStatus>(v.open ? v.status : 'COMPLETED')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const rejectReasons = [...new Set(tests.flatMap((t) => t.rejectionCriteria))]

  const add = async () => {
    setBusy(true)
    try {
      await requireStaff('TECH', `update ${v.log.labNumber}`, { allowProvisional: true })
      await api.addLogEvent(v.log.id, status, note)
      setNote('')
      await reload()
      toast('ok', 'Update added')
    } catch (e) {
      if (!isCancel(e)) toast('error', 'Could not add update', errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="detail">
      <header className="label-card">
        <span className="label-rail" style={{ background: 'var(--accent)' }} />
        <div className="label-top">
          <div className="label-code">
            <span className="mono">LAB NO.</span>
          </div>
          <StatusPill status={v.status} />
        </div>
        <div className="label-main">
          <div>
            <h2 className="mono">{v.log.labNumber}</h2>
            <p className="synonyms">
              Logged by {v.log.createdByName} · {new Date(v.log.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <span className="label-perf" />
      </header>

      <div className="detail-body">
        <section>
          <h4>Tests</h4>
          {tests.map((t) => (
            <div key={t.id} className="log-test">
              <TubeStack containers={t.specimens.map((s) => lookups.con(s.containerId))} size={30} />
              <span className="mono muted">{t.code}</span>
              <span>{t.name}</span>
            </div>
          ))}
          {v.log.testCodes.filter((c) => !tests.some((t) => t.code === c)).map((c) => (
            <div key={c} className="log-test muted">
              <span className="mono">{c}</span> (no longer in the directory)
            </div>
          ))}
          <AlertChips v={v} tests={tests} />
        </section>

        <section>
          <h4>Add update</h4>
          <div className="status-picker">
            {STATUS_ORDER.map((s) => (
              <button key={s} className={cx('status-option', `ls-${s.toLowerCase()}`, status === s && 'active')} onClick={() => setStatus(s)} title={STATUS_META[s].hint}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={status === 'REJECTED' ? 'Reason for rejection (required)' : 'Handover note — what happened, what is next…'} />
          {status === 'REJECTED' && rejectReasons.length > 0 && (
            <div className="quick-add">
              {rejectReasons.map((r) => (
                <button key={r} className="chip chip-ghost" onClick={() => setNote((n) => (n ? `${n}; ${r}` : r))}>
                  <Plus size={11} /> {r}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-primary add-update" disabled={busy || (status === 'REJECTED' && !note.trim())} onClick={add}>
            {busy ? 'Saving…' : 'Add update'}
          </button>
        </section>

        <section>
          <h4>Timeline</h4>
          <ol className="timeline">
            {[...v.events].reverse().map((e, i) => (
              <li key={e.id} className={cx(i === 0 && 'current')}>
                <span className="tl-dot" />
                <div className="tl-head">
                  <strong>
                    <StatusPill status={e.status} /> {e.staffName} <span className="mono muted small">{e.staffNumber}</span>
                  </strong>
                  <time title={new Date(e.at).toLocaleString()}>{new Date(e.at).toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                </div>
                {e.note && <p className="tl-changes">{e.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </article>
  )
}

function LogSampleDialog({ snap, lookups, onClose, onDone }: { snap: Snapshot; lookups: Lookups; onClose: () => void; onDone: (logId: string) => void }) {
  const [labNumber, setLab] = useState('')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<LabTest[]>([])
  const [status, setStatus] = useState<SampleStatus>('RECEIVED')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const active = snap.tests.filter((t) => t.status === 'PUBLISHED')
  const matches = q.trim() ? lookups.search(active, q).filter((t) => !picked.includes(t)).slice(0, 6) : []

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      const log = await api.createLog({ labNumber, testIds: picked.map((t) => t.id), status, note })
      onDone(log.id)
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="dialog log-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <button className="btn btn-icon btn-ghost dialog-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <h3>Log a sample</h3>
        <label className="field">
          <span className="field-label">Lab number (from the request form)</span>
          <input className="input mono input-lg" autoFocus value={labNumber} onChange={(e) => setLab(e.target.value.toUpperCase())} placeholder="L-2026-0042" />
          <span className="field-hint">Only the lab number is stored — never the patient’s name.</span>
        </label>
        <label className="field">
          <span className="field-label">Tests</span>
          <div className="chips">
            {picked.map((t) => (
              <span key={t.id} className="chip">
                {t.code}
                <button onClick={() => setPicked(picked.filter((x) => x !== t))} aria-label={`Remove ${t.code}`}>
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <div className="search id-search">
            <Search size={15} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a test — name, code or abbreviation" onKeyDown={(e) => e.key === 'Enter' && matches[0] && (setPicked([...picked, matches[0]]), setQ(''))} />
          </div>
          {matches.length > 0 && (
            <div className="id-list">
              {matches.map((t) => (
                <button key={t.id} className="id-person" onClick={() => (setPicked([...picked, t]), setQ(''))}>
                  <TubeStack containers={t.specimens.map((s) => lookups.con(s.containerId))} size={24} />
                  <span className="mono muted">{t.code}</span>
                  <span className="id-name">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <div className="status-picker">
            {STATUS_ORDER.map((s) => (
              <button key={s} className={cx('status-option', `ls-${s.toLowerCase()}`, status === s && 'active')} onClick={() => setStatus(s)} title={STATUS_META[s].hint}>
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </label>
        <label className="field">
          <span className="field-label">Note {status === 'REJECTED' ? '(reason — required)' : '(optional)'}</span>
          <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Haemolysed — recollection requested from Ward 4" />
        </label>
        {err && <p className="err-text">{err}</p>}
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !labNumber.trim() || picked.length === 0} onClick={save}>
            {busy ? 'Saving…' : 'Log sample'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReconfirmDialog({ item, onClose, onDone }: { item: LogState['needsPin'][number]; onClose: () => void; onDone: () => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Re-confirm entry</h3>
        <p>
          <b>{item.staffName}</b> ({item.staffNumber}), enter your current PIN so your entry for <b className="mono">{item.labNumber}</b> can upload.
        </p>
        <input
          className="input mono pin-big"
          autoFocus
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={async (e) => {
            if (e.key !== 'Enter') return
            try {
              await api.reconfirmUpload(item.eventId, pin)
              onDone()
            } catch (er) {
              setErr(errMsg(er))
            }
          }}
        />
        {err && <p className="err-text">{err}</p>}
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={pin.length < 4}
            onClick={async () => {
              try {
                await api.reconfirmUpload(item.eventId, pin)
                onDone()
              } catch (er) {
                setErr(errMsg(er))
              }
            }}
          >
            Re-confirm
          </button>
        </div>
      </div>
    </div>
  )
}
