import { useState } from 'react'
import { KeyRound, Pencil, Phone, Plus, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import type { Snapshot } from '@shared/types'
import { ROLE_HINT, ROLE_LABEL, pinError, type Staff, type StaffInput, type StaffRole } from '@shared/staff'
import { api, cx, errMsg, relTime } from '../lib/util'
import { useToast } from '../components/Toasts'
import { isCancel, useRequireStaff } from '../components/Identity'

const ROLES: StaffRole[] = ['TECH', 'SENIOR', 'VIEWER']

export function StaffView({ snap, onChanged }: { snap: Snapshot; onChanged: () => Promise<void> }) {
  const toast = useToast()
  const requireStaff = useRequireStaff()
  const [editing, setEditing] = useState<{ input: StaffInput; isNew: boolean } | null>(null)
  const [pinFor, setPinFor] = useState<Staff | null>(null)
  const empty = snap.staff.length === 0
  const active = snap.staff.filter((s) => s.active)
  const inactive = snap.staff.filter((s) => !s.active)

  const startEdit = async (input: StaffInput, isNew: boolean) => {
    try {
      if (!empty) await requireStaff('SENIOR', isNew ? 'add staff' : 'edit staff details')
      setEditing({ input, isNew })
    } catch (e) {
      if (!isCancel(e)) toast('error', 'Not allowed', errMsg(e))
    }
  }

  return (
    <div className="settings staff-view">
      <div className="toolbar-title">
        <h1>Staff</h1>
        <span className="muted small">Who can log samples and edit tests — no accounts, just staff number + PIN</span>
      </div>

      {empty ? (
        <section className="set-card bootstrap">
          <header>
            <ShieldCheck size={18} />
            <h3>Set up your lab</h3>
          </header>
          <p className="muted">
            Add yourself first — the first person becomes a <b>Senior</b>. Seniors add the other lab techs, edit tests and publish updates.
            {snap.cloud.connected ? ' The list is stored in the cloud and shared with every device.' : ' Until the cloud is connected, the list lives on this computer and travels with published update files.'}
          </p>
          <div className="set-row">
            <button className="btn btn-primary" onClick={() => setEditing({ input: { staffNumber: '', name: '', phone: '', role: 'SENIOR', active: true }, isNew: true })}>
              <Plus size={14} /> Add yourself as the first Senior
            </button>
          </div>
        </section>
      ) : (
        <section className="set-card">
          <header>
            <UsersRound size={18} />
            <h3>
              {active.length} active staff
            </h3>
            <span className="spacer" />
            <button className="btn btn-primary btn-sm" onClick={() => startEdit({ staffNumber: '', name: '', phone: '', role: 'TECH', active: true }, true)}>
              <Plus size={13} /> Add staff
            </button>
          </header>
          <div className="staff-grid">
            <span className="lh">Name</span>
            <span className="lh">Staff no.</span>
            <span className="lh">Role</span>
            <span className="lh">Phone</span>
            <span className="lh">PIN on this PC</span>
            <span className="lh" />
            {[...active, ...inactive].map((s) => (
              <StaffRow key={s.id} s={s} onEdit={() => startEdit({ id: s.id, staffNumber: s.staffNumber, name: s.name, phone: s.phone, role: s.role, active: s.active }, false)} onPin={() => setPinFor(s)} />
            ))}
          </div>
          <p className="field-hint">
            “PIN on this PC: known” means this computer can check that person’s PIN without internet. With the cloud connected, a person is learned the first time they confirm online.
          </p>
        </section>
      )}

      <section className="set-card">
        <header>
          <KeyRound size={18} />
          <h3>Roles</h3>
        </header>
        <div className="role-legend">
          {ROLES.map((r) => (
            <div key={r}>
              <span className={cx('role-chip', `role-${r.toLowerCase()}`)}>{ROLE_LABEL[r]}</span> <span className="muted small">{ROLE_HINT[r]}</span>
            </div>
          ))}
        </div>
      </section>

      {editing && (
        <StaffDialog
          snap={snap}
          initial={editing.input}
          isNew={editing.isNew}
          first={empty}
          onClose={() => setEditing(null)}
          onSaved={async (name) => {
            setEditing(null)
            await onChanged()
            toast('ok', editing.isNew ? `${name} added` : `${name} updated`)
          }}
        />
      )}
      {pinFor && (
        <ChangePinDialog
          s={pinFor}
          onClose={() => setPinFor(null)}
          onDone={async () => {
            setPinFor(null)
            await onChanged()
            toast('ok', 'PIN changed')
          }}
        />
      )}
    </div>
  )
}

function StaffRow({ s, onEdit, onPin }: { s: Staff; onEdit: () => void; onPin: () => void }) {
  return (
    <>
      <span className={cx('staff-name', !s.active && 'inactive')}>
        <UserRound size={14} /> {s.name}
        {!s.active && <span className="status status-archived">inactive</span>}
      </span>
      <span className="mono">{s.staffNumber}</span>
      <span>
        <span className={cx('role-chip', `role-${s.role.toLowerCase()}`)}>{ROLE_LABEL[s.role]}</span>
      </span>
      <span className="muted">
        {s.phone ? (
          <>
            <Phone size={12} /> {s.phone}
          </>
        ) : (
          '—'
        )}
      </span>
      <span className="muted small">{s.pinCheck ? 'known' : '—'}</span>
      <span className="row-actions">
        <button className="btn btn-sm btn-ghost" onClick={onPin} title="Change own PIN">
          <KeyRound size={13} />
        </button>
        <button className="btn btn-sm" onClick={onEdit} title={`Edit · updated ${relTime(s.updatedAt)}`}>
          <Pencil size={13} /> Edit
        </button>
      </span>
    </>
  )
}

function StaffDialog({
  snap,
  initial,
  isNew,
  first,
  onClose,
  onSaved
}: {
  snap: Snapshot
  initial: StaffInput
  isNew: boolean
  first: boolean
  onClose: () => void
  onSaved: (name: string) => void
}) {
  const [v, setV] = useState(initial)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setErr('')
    if (pin || isNew) {
      const pe = pinError(pin)
      if (pe) return setErr(pe)
      if (pin !== pin2) return setErr('The two PINs do not match')
    }
    setBusy(true)
    try {
      await api.saveStaff(v, pin || null)
      onSaved(v.name)
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="dialog staff-dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>{first ? 'Add yourself (first Senior)' : isNew ? 'Add staff member' : `Edit ${initial.name}`}</h3>
        <div className="grid-2">
          <label className="field">
            <span className="field-label">Full name</span>
            <input className="input" autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Ama Mensah" />
          </label>
          <label className="field">
            <span className="field-label">Staff number</span>
            <input className="input mono" value={v.staffNumber} onChange={(e) => setV({ ...v, staffNumber: e.target.value.toUpperCase() })} placeholder="LT-014" />
          </label>
          <label className="field">
            <span className="field-label">Phone (optional)</span>
            <input className="input" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="024 000 0000" />
          </label>
          <label className="field">
            <span className="field-label">Role</span>
            <select className="input" value={v.role} disabled={first} onChange={(e) => setV({ ...v, role: e.target.value as StaffRole })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]} — {ROLE_HINT[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{isNew ? 'PIN (4–6 digits)' : 'New PIN (leave blank to keep)'}</span>
            <input className="input mono" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
          </label>
          <label className="field">
            <span className="field-label">Repeat PIN</span>
            <input className="input mono" type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && save()} />
          </label>
        </div>
        {!isNew && (
          <label className="toggle">
            <input type="checkbox" checked={v.active} onChange={(e) => setV({ ...v, active: e.target.checked })} />
            <span className="toggle-track" />
            Active {v.active ? '' : '— cannot confirm or log, but past entries keep their name'}
          </label>
        )}
        <p className="field-hint">
          {snap.cloud.connected ? 'PINs are stored scrambled in the cloud (bcrypt) and never shown again.' : 'PINs are stored scrambled on this computer and never shown again.'} Tell the person their PIN privately — they can change it themselves.
        </p>
        {err && <p className="err-text">{err}</p>}
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ChangePinDialog({ s, onClose, onDone }: { s: Staff; onClose: () => void; onDone: () => void }) {
  const [oldPin, setOld] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [err, setErr] = useState('')
  const save = async () => {
    const pe = pinError(pin)
    if (pe) return setErr(pe)
    if (pin !== pin2) return setErr('The two PINs do not match')
    try {
      await api.changeOwnPin(s.id, oldPin, pin)
      onDone()
    } catch (e) {
      setErr(errMsg(e))
    }
  }
  return (
    <div className="scrim" onMouseDown={onClose}>
      <div className="dialog" onMouseDown={(e) => e.stopPropagation()}>
        <h3>Change PIN — {s.name}</h3>
        <label className="field">
          <span className="field-label">Current PIN</span>
          <input className="input mono" autoFocus type="password" inputMode="numeric" maxLength={6} value={oldPin} onChange={(e) => setOld(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="field">
          <span className="field-label">New PIN</span>
          <input className="input mono" type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
        </label>
        <label className="field">
          <span className="field-label">Repeat new PIN</span>
          <input className="input mono" type="password" inputMode="numeric" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </label>
        {err && <p className="err-text">{err}</p>}
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Change PIN
          </button>
        </div>
      </div>
    </div>
  )
}
