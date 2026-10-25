import { StyleSheet, Text, View } from 'react-native'
import Svg, { Ellipse, Path, Rect } from 'react-native-svg'
import { Snowflake, Sparkles, Sun, Thermometer } from 'lucide-react-native'
import { STORAGE_LABELS, toMinutes, type Container, type Duration, type StorageTemp } from '@shared/types'
import { font, useTheme } from '@/lib/theme'

/** A specimen container drawn in its real cap colour. */
export function TubeIcon({ container, size = 44 }: { container?: Container; size?: number }) {
  const { c } = useTheme()
  const cap = container?.capColor ?? '#B8BEC6'
  const kind = container?.kind ?? 'tube'
  const glass = { fill: c.glass, stroke: c.glassStroke, strokeWidth: 1 }
  const label = { fill: c.label, stroke: c.glassStroke, strokeWidth: 0.5, opacity: 0.92 }

  if (kind === 'cup') {
    return (
      <Svg width={size * 0.65} height={size} viewBox="0 0 34 52">
        <Rect x={3} y={4} width={28} height={8} rx={2.5} fill={cap} />
        <Rect x={5} y={12} width={24} height={36} rx={3} {...glass} />
        <Rect x={5} y={28} width={24} height={20} rx={3} fill="#E8C94A" opacity={0.55} />
        <Rect x={8} y={17} width={18} height={7} rx={1} {...label} />
      </Svg>
    )
  }
  if (kind === 'bottle') {
    return (
      <Svg width={size * 0.47} height={size} viewBox="0 0 30 64">
        <Rect x={9} y={2} width={12} height={9} rx={2} fill={cap} />
        <Path d="M10 11h10v6l6 6v35a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V23l6-6z" {...glass} />
        <Path d="M4 38h22v20a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#B9473F" opacity={0.6} />
        <Rect x={7} y={26} width={16} height={9} rx={1} {...label} />
      </Svg>
    )
  }
  if (kind === 'jar') {
    return (
      <Svg width={size * 0.69} height={size} viewBox="0 0 36 52">
        <Rect x={2} y={8} width={32} height={9} rx={2.5} fill={cap} />
        <Rect x={4} y={17} width={28} height={31} rx={4} {...glass} />
        <Rect x={4} y={26} width={28} height={22} rx={4} fill="#E9DFA8" opacity={0.55} />
        <Ellipse cx={18} cy={40} rx={5} ry={3} fill="#C98B7A" opacity={0.8} />
        <Rect x={8} y={20} width={20} height={5} rx={1} {...label} />
      </Svg>
    )
  }
  if (kind === 'vial') {
    return (
      <Svg width={size * 0.4} height={size} viewBox="0 0 24 60">
        <Rect x={2} y={4} width={20} height={11} rx={2.5} fill={cap} stroke={c.glassStroke} strokeWidth={0.6} />
        <Rect x={3} y={15} width={18} height={41} rx={3} {...glass} />
        <Rect x={3} y={30} width={18} height={26} rx={3} fill="#9CC3E6" opacity={0.5} />
        <Rect x={5} y={19} width={14} height={9} rx={1} {...label} />
      </Svg>
    )
  }
  if (kind === 'slide') {
    return (
      <Svg width={size * 0.3} height={size} viewBox="0 0 18 60">
        <Rect x={2} y={2} width={14} height={56} rx={1.5} {...glass} />
        <Rect x={2} y={2} width={14} height={14} rx={1.5} fill={cap} opacity={0.85} />
        <Ellipse cx={9} cy={36} rx={4.5} ry={9} fill="#C77DA0" opacity={0.45} />
      </Svg>
    )
  }
  if (kind === 'swab') {
    return (
      <Svg width={size * 0.31} height={size} viewBox="0 0 20 64">
        <Rect x={4} y={2} width={12} height={10} rx={3} fill={cap} />
        <Rect x={5} y={12} width={10} height={48} rx={5} {...glass} />
        <Rect x={9.25} y={12} width={1.5} height={36} fill={c.ink} opacity={0.35} />
        <Ellipse cx={10} cy={50} rx={3} ry={5} fill="#F2EEE4" />
        <Rect x={5} y={46} width={10} height={14} rx={5} fill="#9DB5D9" opacity={0.5} />
      </Svg>
    )
  }
  return (
    <Svg width={size * 0.31} height={size} viewBox="0 0 20 64">
      <Rect x={2} y={2} width={16} height={12} rx={3} fill={cap} />
      <Rect x={2} y={9} width={16} height={1.2} fill="#000" opacity={0.12} />
      <Rect x={2} y={5.5} width={16} height={1.2} fill="#000" opacity={0.12} />
      <Path d="M4 14h12v40a6 6 0 0 1-12 0z" {...glass} />
      <Path d="M4 32h12v22a6 6 0 0 1-12 0z" fill="#9E2B2B" opacity={0.72} />
      <Rect x={4} y={18} width={12} height={11} {...label} />
    </Svg>
  )
}

/** Up to three containers side by side, for tests needing several samples. */
export function TubeStack({ containers, size = 44 }: { containers: (Container | undefined)[]; size?: number }) {
  if (containers.length <= 1) return <TubeIcon container={containers[0]} size={size} />
  const shown = containers.slice(0, 3)
  const s = size * (shown.length === 2 ? 0.86 : 0.74)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
      {shown.map((c, i) => (
        <TubeIcon key={i} container={c} size={s} />
      ))}
    </View>
  )
}

export function CapDot({ color, size = 11 }: { color?: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: 3, backgroundColor: color ?? '#B8BEC6', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.25)' }} />
}

/** Colour chip + always-present text label (never colour alone). */
export function ContainerChip({ container }: { container?: Container }) {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      <CapDot color={container?.capColor} />
      <Text style={{ fontFamily: font.bodySemi, color: c.ink, fontSize: 14 }}>{container?.name ?? 'No container'}</Text>
    </View>
  )
}

const STORAGE_ICON = { ROOM: Sun, FRIDGE: Thermometer, FROZEN: Snowflake, DEEP_FROZEN: Sparkles }

export function StorageBadge({ temp, compact, size = 'md' }: { temp: StorageTemp; compact?: boolean; size?: 'sm' | 'md' }) {
  const { c } = useTheme()
  const Icon = STORAGE_ICON[temp]
  const col = c.storage[temp]
  const l = STORAGE_LABELS[temp]
  const fs = size === 'sm' ? 11 : 12
  return (
    <View style={[styles.badge, { backgroundColor: col.bg, height: size === 'sm' ? 22 : 26 }]}>
      <Icon size={fs + 1} color={col.fg} strokeWidth={2.2} />
      <Text style={{ fontFamily: font.monoMedium, fontSize: fs, color: col.fg }}>{compact ? l.range : `${l.label} · ${l.range}`}</Text>
    </View>
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

export function TatBar({ routine, urgent, ticks }: { routine: Duration; urgent: Duration | null; ticks?: boolean }) {
  const { c } = useTheme()
  const r = pos(routine)
  const u = urgent ? pos(urgent) : null
  const h = ticks ? 6 : 4
  return (
    <View style={{ paddingBottom: ticks ? 16 : 0, justifyContent: 'center', flex: 1 }}>
      <View style={{ height: h, borderRadius: h, backgroundColor: c.surface3 }}>
        <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${r}%`, borderRadius: h, backgroundColor: c.accent, opacity: 0.85 }} />
        {u != null && <View style={[styles.marker, { left: `${u}%`, backgroundColor: c.urgent, borderColor: c.surface, transform: [{ translateX: -5 }, { translateY: -(5 - h / 2) }, { rotate: '45deg' }], borderRadius: 2 }]} />}
        <View style={[styles.marker, { left: `${r}%`, backgroundColor: c.accent, borderColor: c.surface, transform: [{ translateX: -5 }, { translateY: -(5 - h / 2) }] }]} />
        {ticks &&
          TICKS.map((t) => (
            <View key={t.label} style={{ position: 'absolute', left: `${pos(t.d)}%`, top: h + 3, alignItems: 'center', width: 20, marginLeft: -10 }}>
              <View style={{ width: 1, height: 4, backgroundColor: c.lineStrong }} />
              <Text style={{ fontFamily: font.mono, fontSize: 9.5, color: c.muted }}>{t.label}</Text>
            </View>
          ))}
      </View>
    </View>
  )
}

/** Decorative barcode strip derived from the test code — specimen-label look. */
export function Barcode({ value, height = 16 }: { value: string; height?: number }) {
  const { c } = useTheme()
  const bars: number[] = []
  for (const ch of value.padEnd(10, '0')) {
    const k = ch.charCodeAt(0)
    bars.push((k % 3) + 1, ((k >> 2) % 2) + 1, ((k >> 1) % 3) + 1)
  }
  let x = 0
  const rects = bars.map((w, i) => {
    const r = i % 2 === 0 ? <Rect key={i} x={x} y={0} width={w} height={height} fill={c.ink} opacity={0.75} /> : null
    x += w
    return r
  })
  return (
    <Svg width={x} height={height} viewBox={`0 0 ${x} ${height}`}>
      {rects}
    </Svg>
  )
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start' },
  marker: { position: 'absolute', top: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2 }
})
