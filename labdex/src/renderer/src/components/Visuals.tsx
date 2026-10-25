import { Snowflake, Sun, Thermometer, Sparkles } from 'lucide-react'
import { STORAGE_LABELS, formatDuration, toMinutes, type Container, type Duration, type StorageTemp } from '@shared/types'
import { cx } from '../lib/util'

/** A specimen container drawn in its real cap colour. */
export function TubeIcon({ container, size = 44 }: { container?: Container; size?: number }) {
  const color = container?.capColor ?? '#B8BEC6'
  const kind = container?.kind ?? 'tube'
  const h = size
  const w = size * 0.42

  if (kind === 'cup') {
    return (
      <svg className="tube" width={w * 1.6} height={h} viewBox="0 0 34 52" aria-hidden>
        <rect x="3" y="4" width="28" height="8" rx="2.5" fill={color} />
        <rect x="5" y="12" width="24" height="36" rx="3" className="tube-glass" />
        <rect x="5" y="30" width="24" height="18" rx="3" className="tube-liquid" fill="#E8C94A" opacity="0.55" />
        <rect x="8" y="17" width="18" height="7" rx="1" className="tube-label" />
      </svg>
    )
  }
  if (kind === 'bottle') {
    return (
      <svg className="tube" width={w * 1.4} height={h} viewBox="0 0 30 64" aria-hidden>
        <rect x="9" y="2" width="12" height="9" rx="2" fill={color} />
        <path d="M10 11h10v6l6 6v35a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V23l6-6z" className="tube-glass" />
        <path d="M4 40h22v18a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" className="tube-liquid" fill="#B9473F" opacity="0.6" />
        <rect x="7" y="26" width="16" height="9" rx="1" className="tube-label" />
      </svg>
    )
  }
  if (kind === 'jar') {
    // Wide histology pot with formalin
    return (
      <svg className="tube" width={w * 1.7} height={h} viewBox="0 0 36 52" aria-hidden>
        <rect x="2" y="8" width="32" height="9" rx="2.5" fill={color} />
        <rect x="2" y="11.5" width="32" height="1" fill="#000" opacity="0.12" />
        <rect x="4" y="17" width="28" height="31" rx="4" className="tube-glass" />
        <rect x="4" y="26" width="28" height="22" rx="4" className="tube-liquid" fill="#E9DFA8" opacity="0.55" />
        <ellipse cx="18" cy="40" rx="5" ry="3" fill="#C98B7A" opacity="0.8" />
        <rect x="8" y="20" width="20" height="5" rx="1" className="tube-label" />
      </svg>
    )
  }
  if (kind === 'vial') {
    // Liquid-based cytology vial
    return (
      <svg className="tube" width={w * 1.15} height={h} viewBox="0 0 24 60" aria-hidden>
        <rect x="2" y="4" width="20" height="11" rx="2.5" fill={color} stroke="currentColor" strokeOpacity="0.25" />
        <rect x="2" y="8" width="20" height="1" fill="#000" opacity="0.1" />
        <rect x="3" y="15" width="18" height="41" rx="3" className="tube-glass" />
        <rect x="3" y="30" width="18" height="26" rx="3" className="tube-liquid" fill="#9CC3E6" opacity="0.5" />
        <rect x="5" y="19" width="14" height="9" rx="1" className="tube-label" />
      </svg>
    )
  }
  if (kind === 'slide') {
    // Glass microscope slide, frosted end in the "cap" colour
    return (
      <svg className="tube" width={w * 0.9} height={h} viewBox="0 0 18 60" aria-hidden>
        <rect x="2" y="2" width="14" height="56" rx="1.5" className="tube-glass" />
        <rect x="2" y="2" width="14" height="14" rx="1.5" fill={color} opacity="0.85" />
        <ellipse cx="9" cy="36" rx="4.5" ry="9" className="tube-liquid" fill="#C77DA0" opacity="0.45" />
      </svg>
    )
  }
  if (kind === 'swab') {
    return (
      <svg className="tube" width={w} height={h} viewBox="0 0 20 64" aria-hidden>
        <rect x="4" y="2" width="12" height="10" rx="3" fill={color} />
        <rect x="5" y="12" width="10" height="48" rx="5" className="tube-glass" />
        <rect x="9.25" y="12" width="1.5" height="36" fill="currentColor" opacity="0.35" />
        <ellipse cx="10" cy="50" rx="3" ry="5" fill="#F2EEE4" stroke="currentColor" strokeOpacity="0.2" />
        <rect x="5" y="46" width="10" height="14" rx="5" className="tube-liquid" fill="#9DB5D9" opacity="0.5" />
      </svg>
    )
  }
  return (
    <svg className="tube" width={w} height={h} viewBox="0 0 20 64" aria-hidden>
      <rect x="2" y="2" width="16" height="12" rx="3" fill={color} />
      <rect x="2" y="9" width="16" height="1.2" fill="#000" opacity="0.12" />
      <rect x="2" y="5.5" width="16" height="1.2" fill="#000" opacity="0.12" />
      <path d="M4 14h12v40a6 6 0 0 1-12 0z" className="tube-glass" />
      <path d="M4 34h12v20a6 6 0 0 1-12 0z" className="tube-liquid" fill="#9E2B2B" opacity="0.7" />
      <rect x="4" y="18" width="12" height="11" className="tube-label" />
    </svg>
  )
}

/** Up to three containers side by side, for tests needing several samples. */
export function TubeStack({ containers, size = 44 }: { containers: (Container | undefined)[]; size?: number }) {
  if (containers.length <= 1) return <TubeIcon container={containers[0]} size={size} />
  const shown = containers.slice(0, 3)
  const s = size * (shown.length === 2 ? 0.86 : 0.74)
  return (
    <span className="tube-stack">
      {shown.map((c, i) => (
        <TubeIcon key={i} container={c} size={s} />
      ))}
    </span>
  )
}

/** Small colour chip + always-present text label (never colour alone). */
export function ContainerChip({ container }: { container?: Container }) {
  if (!container) return <span className="chip chip-muted">No container</span>
  return (
    <span className="cap-chip">
      <span className="cap-dot" style={{ background: container.capColor }} />
      {container.name}
    </span>
  )
}

const STORAGE_ICON: Record<StorageTemp, typeof Sun> = {
  ROOM: Sun,
  FRIDGE: Thermometer,
  FROZEN: Snowflake,
  DEEP_FROZEN: Sparkles
}

export function StorageBadge({ temp, compact }: { temp: StorageTemp; compact?: boolean }) {
  const Icon = STORAGE_ICON[temp]
  const l = STORAGE_LABELS[temp]
  return (
    <span className={cx('storage', `storage-${temp.toLowerCase()}`)} title={`${l.label} (${l.range})`}>
      <Icon size={13} strokeWidth={2.2} />
      {compact ? l.range : `${l.label} · ${l.range}`}
    </span>
  )
}

// Log scale from 10 minutes to 3 weeks.
const MIN_M = Math.log(10)
const MAX_M = Math.log(30240)
const pos = (d: Duration) => {
  const m = Math.min(Math.max(toMinutes(d), 10), 30240)
  return ((Math.log(m) - MIN_M) / (MAX_M - MIN_M)) * 100
}
const TICKS: { label: string; d: Duration }[] = [
  { label: '1h', d: { value: 1, unit: 'h' } },
  { label: '1d', d: { value: 1, unit: 'd' } },
  { label: '1w', d: { value: 1, unit: 'wk' } }
]

export function TatBar({ routine, urgent, showTicks = false }: { routine: Duration; urgent: Duration | null; showTicks?: boolean }) {
  const r = pos(routine)
  const u = urgent ? pos(urgent) : null
  return (
    <div className={cx('tatbar', showTicks && 'tatbar-ticks')}>
      <div className="tatbar-track">
        <div className="tatbar-fill" style={{ width: `${r}%` }} />
        {u != null && <span className="tatbar-urgent" style={{ left: `${u}%` }} title={`STAT ${formatDuration(urgent)}`} />}
        <span className="tatbar-routine" style={{ left: `${r}%` }} title={`Routine ${formatDuration(routine)}`} />
        {showTicks &&
          TICKS.map((t) => (
            <span key={t.label} className="tatbar-tick" style={{ left: `${pos(t.d)}%` }}>
              <em>{t.label}</em>
            </span>
          ))}
      </div>
    </div>
  )
}

/** Fake barcode strip derived from the test code — decorative, specimen-label look. */
export function Barcode({ value, height = 18 }: { value: string; height?: number }) {
  const bars: number[] = []
  for (const ch of value.padEnd(10, '0')) {
    const c = ch.charCodeAt(0)
    bars.push((c % 3) + 1, ((c >> 2) % 2) + 1, ((c >> 1) % 3) + 1)
  }
  let x = 0
  const rects = bars.map((w, i) => {
    const r = i % 2 === 0 ? <rect key={i} x={x} y={0} width={w} height={height} /> : null
    x += w
    return r
  })
  return (
    <svg className="barcode" width={x} height={height} viewBox={`0 0 ${x} ${height}`} aria-hidden>
      {rects}
    </svg>
  )
}
