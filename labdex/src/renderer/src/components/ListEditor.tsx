import { useState } from 'react'
import { Plus, X } from 'lucide-react'

interface Props {
  value: string[]
  onChange: (v: string[]) => void
  placeholder: string
  /** Chips render inline (synonyms); rows render as an ordered list (suggestions). */
  variant?: 'chips' | 'rows'
  quickAdd?: string[]
}

export function ListEditor({ value, onChange, placeholder, variant = 'rows', quickAdd }: Props) {
  const [draft, setDraft] = useState('')

  const add = (v: string) => {
    const t = v.trim()
    if (!t || value.some((x) => x.toLowerCase() === t.toLowerCase())) return
    onChange([...value, t])
    setDraft('')
  }

  const input = (
    <div className="list-add">
      <input
        className="input"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || (variant === 'chips' && e.key === ',')) {
            e.preventDefault()
            add(draft)
          } else if (e.key === 'Backspace' && !draft && variant === 'chips' && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
      />
      <button type="button" className="btn btn-icon" onClick={() => add(draft)} disabled={!draft.trim()} aria-label="Add">
        <Plus size={15} />
      </button>
    </div>
  )

  const suggestions = quickAdd?.filter((q) => !value.includes(q))

  return (
    <div className={`list-editor list-${variant}`}>
      {variant === 'chips' ? (
        <div className="chips">
          {value.map((v) => (
            <span key={v} className="chip">
              {v}
              <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        value.length > 0 && (
          <ol className="rows">
            {value.map((v, i) => (
              <li key={i}>
                <span className="row-n">{String(i + 1).padStart(2, '0')}</span>
                <input
                  className="input input-flat"
                  value={v}
                  onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
                  onBlur={() => !v.trim() && onChange(value.filter((_, j) => j !== i))}
                />
                <button type="button" className="btn btn-icon btn-ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ol>
        )
      )}
      {input}
      {suggestions && suggestions.length > 0 && (
        <div className="quick-add">
          {suggestions.map((q) => (
            <button type="button" key={q} className="chip chip-ghost" onClick={() => add(q)}>
              <Plus size={11} /> {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
