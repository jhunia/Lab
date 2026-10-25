import { createContext, useCallback, useContext, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from 'react'
import { KeyRound, Search, ShieldCheck, X } from 'lucide-react'
import type { PublicSession, Snapshot } from '@shared/types'
import { ROLE_LABEL, hasRole, type StaffRole } from '@shared/staff'
import { api, cx, errMsg } from '../lib/util'

interface Ask {
  minRole: StaffRole
  reason: string
  allowProvisional: boolean
  resolve: (s: PublicSession | null) => void
  reject: (e: Error) => void
}

export type RequireStaff = (minRole: StaffRole, reason: string, opts?: { allowProvisional?: boolean }) => Promise<PublicSession | null>

const Ctx = createContext<RequireStaff>(async () => null)

/**
 * `requireStaff('SENIOR', 'edit tests')` resolves with the confirmed person — asking for
 * name + PIN only when nobody suitable is confirmed on this computer. Resolves null before
 * any staff exist (first-time setup), rejects if the dialog is cancelled.
 */
export function IdentityProvider({
  snap,
  reload,
  requireRef,
  children
}: {
  snap: Snapshot | null
  reload: () => Promise<void>
  /** Lets the component that renders this provider use requireStaff too. */
  requireRef?: MutableRefObject<RequireStaff | null>
  children: ReactNode
}) {
  const [ask, setAsk] = useState<Ask | null>(null)
  const snapRef = useRef(snap)
  snapRef.current = snap

  const requireStaff = useCallback<RequireStaff>((minRole, reason, opts) => {
    const s = snapRef.current
    if (!s) return Promise.reject(new Error('Still loading'))
    if (s.session && hasRole(s.session.role, minRole) && s.session.until > Date.now()) return Promise.resolve(s.session)
    if (s.staff.length === 0 && !s.cloud.connected) return Promise.resolve(null)
    return new Promise((resolve, reject) => setAsk({ minRole, reason, allowProvisional: !!opts?.allowProvisional, resolve, reject }))
  }, [])
  if (requireRef) requireRef.current = requireStaff

  return (
    <Ctx.Provider value={requireStaff}>
      {children}
      {ask && snap && (
        <IdentityDialog
          snap={snap}
          ask={ask}
          onDone={async (session) => {
            await reload()
            ask.resolve(session)
            setAsk(null)
          }}
          onCancel={() => {
            ask.reject(new Error('cancelled'))
            setAsk(null)
          }}
        />
      )}
    </Ctx.Provider>
  )
}

export const useRequireStaff = () => useContext(Ctx)

/** True for the rejection you get when someone closes the dialog — callers stay silent. */
export const isCancel = (e: unknown) => e instanceof Error && e.message === 'cancelled'

function IdentityDialog({ snap, ask, onDone, onCancel }: { snap: Snapshot; ask: Ask; onDone: (s: PublicSession) => void; onCancel: () => void }) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const pinRef = useRef<HTMLInputElement>(null)

  const eligible = snap.staff.filter((s) => s.active && hasRole(s.role, ask.minRole))
  const list = eligible.filter((s) => !q.trim() || `${s.name} ${s.staffNumber}`.toLowerCase().includes(q.trim().toLowerCase()))
  const person = eligible.find((s) => s.id === picked)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  useEffect(() => {
    if (picked) pinRef.current?.focus()
  }, [picked])

  const confirm = async () => {
    if (!person || !pin) return
    setBusy(true)
    setErr('')
    try {
      const r = await api.identify(person.id, pin, ask.minRole, ask.allowProvisional)
      onDone(r.session)
    } catch (e) {
      setErr(errMsg(e))
      setPin('')
      pinRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="scrim" onMouseDown={onCancel}>
      <div className="dialog identity" role="dialog" aria-labelledby="id-title" onMouseDown={(e) => e.stopPropagation()}>
        <button className="btn btn-icon btn-ghost dialog-close" onClick={onCancel} aria-label="Cancel">
          <X size={16} />
        </button>
        <div className="dialog-icon">
          <ShieldCheck size={18} />
        </div>
        <h3 id="id-title">Confirm it’s you</h3>
        <p>
          To <b>{ask.reason}</b>, pick your name and enter your PIN{ask.minRole === 'SENIOR' ? ' (Seniors only)' : ''}.
        </p>

        {eligible.length === 0 ? (
          <p className="err-text">Nobody on the staff list can do this yet. A Senior can add people under Staff.</p>
        ) : (
          <>
            <div className="search id-search">
              <Search size={15} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find your name or staff number" />
            </div>
            <div className="id-list">
              {list.map((s) => (
                <button key={s.id} className={cx('id-person', picked === s.id && 'active')} onClick={() => setPicked(s.id)}>
                  <span className="id-avatar">{s.name.slice(0, 1).toUpperCase()}</span>
                  <span className="id-name">{s.name}</span>
                  <span className="mono muted">{s.staffNumber}</span>
                  <span className="id-role">{ROLE_LABEL[s.role]}</span>
                </button>
              ))}
              {list.length === 0 && <p className="muted small">No match.</p>}
            </div>
            <label className="field">
              <span className="field-label">
                <span>
                  <KeyRound size={13} /> PIN {person ? `for ${person.name}` : ''}
                </span>
              </span>
              <input
                ref={pinRef}
                className="input mono pin-big"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                disabled={!person}
                value={pin}
                placeholder="••••"
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && confirm()}
              />
            </label>
            {err && <p className="err-text">{err}</p>}
            <p className="field-hint">This computer remembers you for 5 minutes. Lock it from the top bar when you step away.</p>
          </>
        )}
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!person || pin.length < 4 || busy} onClick={confirm}>
            {busy ? 'Checking…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
