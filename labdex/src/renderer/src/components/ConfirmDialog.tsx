import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  title: string
  body: string
  confirmLabel: string
  /** When set, the user must type this exact text to enable the button. */
  requireText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, body, confirmLabel, requireText, danger, onConfirm, onCancel }: Props) {
  const [typed, setTyped] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  const ok = !requireText || typed.trim().toUpperCase() === requireText

  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="scrim" onMouseDown={onCancel}>
      <div className="dialog" role="alertdialog" aria-labelledby="dlg-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className={danger ? 'dialog-icon danger' : 'dialog-icon'}>
          <AlertTriangle size={18} />
        </div>
        <h3 id="dlg-title">{title}</h3>
        <p>{body}</p>
        {requireText && (
          <label className="field">
            <span className="field-label">
              Type <code>{requireText}</code> to confirm
            </span>
            <input ref={ref} className="input mono" value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ok && onConfirm()} />
          </label>
        )}
        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} disabled={!ok} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
