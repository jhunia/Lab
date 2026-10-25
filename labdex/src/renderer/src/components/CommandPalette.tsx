import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, Search, type LucideIcon } from 'lucide-react'
import { primarySpecimen, type LabTest } from '@shared/types'
import { cx, type Lookups } from '../lib/util'
import { TubeStack } from './Visuals'

export interface PaletteAction {
  id: string
  label: string
  icon: LucideIcon
  hint?: string
  run: () => void
}

interface Props {
  tests: LabTest[]
  lookups: Lookups
  actions: PaletteAction[]
  onPickTest: (t: LabTest) => void
  onClose: () => void
}

type Item = { kind: 'action'; a: PaletteAction } | { kind: 'test'; t: LabTest }

export function CommandPalette({ tests, lookups, actions, onPickTest, onClose }: Props) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const items: Item[] = useMemo(() => {
    const query = q.trim()
    const acts = actions.filter((a) => !query || a.label.toLowerCase().includes(query.toLowerCase())).map((a) => ({ kind: 'action', a }) as Item)
    const found = query ? lookups.search(tests, query).slice(0, 8) : tests.filter((t) => t.status !== 'ARCHIVED').slice(0, 6)
    return [...found.map((t) => ({ kind: 'test', t }) as Item), ...acts]
  }, [q, actions, lookups, tests])

  useEffect(() => setIdx(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('.active')?.scrollIntoView({ block: 'nearest' })
  }, [idx])

  const run = (it: Item | undefined) => {
    if (!it) return
    onClose()
    if (it.kind === 'action') it.a.run()
    else onPickTest(it.t)
  }

  return (
    <div className="scrim scrim-top" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-input">
          <Search size={17} />
          <input
            autoFocus
            value={q}
            placeholder="Search tests by name, code or synonym… or run a command"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setIdx((i) => Math.min(i + 1, items.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setIdx((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter') run(items[idx])
              else if (e.key === 'Escape') onClose()
            }}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="palette-list" ref={listRef}>
          {items.length === 0 && <p className="palette-empty">No tests or commands match “{q}”.</p>}
          {items.map((it, i) =>
            it.kind === 'test' ? (
              <button key={it.t.id} className={cx('palette-item', i === idx && 'active')} onMouseEnter={() => setIdx(i)} onClick={() => run(it)}>
                <span className="palette-tube">
                  <TubeStack containers={it.t.specimens.map((s) => lookups.con(s.containerId))} size={26} />
                </span>
                <span className="mono code">{it.t.code}</span>
                <span className="palette-name">{it.t.name}</span>
                <span className="palette-meta">{it.t.specimens.length > 1 ? `${it.t.specimens.length} samples` : primarySpecimen(it.t)?.sampleType}</span>
                {i === idx && <CornerDownLeft size={14} className="muted" />}
              </button>
            ) : (
              <button key={it.a.id} className={cx('palette-item', 'palette-action', i === idx && 'active')} onMouseEnter={() => setIdx(i)} onClick={() => run(it)}>
                <it.a.icon size={16} />
                <span className="palette-name">{it.a.label}</span>
                {it.a.hint && <kbd>{it.a.hint}</kbd>}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
