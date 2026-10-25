// Logbook design pieces: ink stamps, the red-ruled margin, section rules, summary strip,
// progress track and handover note slips. Used by the Register and sample screens.
import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { STATUS_META, type SampleStatus } from '@shared/logs'
import { font, useTheme } from '@/lib/theme'

/** Display words on stamps — "On analyser" says more at the bench than "In progress". */
export const STAMP_WORD: Record<SampleStatus, string> = {
  RECEIVED: 'RECEIVED',
  IN_PROGRESS: 'ON ANALYSER',
  PENDING: 'PENDING',
  SENT_OUT: 'SENT OUT',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED'
}

export function Stamp({ status, size = 'md', style }: { status: SampleStatus; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme()
  const col = c.stamp[status]
  return (
    <View
      accessibilityLabel={STATUS_META[status].label}
      style={[
        styles.stamp,
        { borderColor: col, transform: [{ rotate: status === 'REJECTED' ? '-6deg' : '-2.5deg' }], paddingHorizontal: size === 'sm' ? 4 : 6 },
        style
      ]}
    >
      <Text style={{ fontFamily: font.display, fontSize: size === 'sm' ? 11 : 12.5, letterSpacing: 1.1, color: col }}>{STAMP_WORD[status]}</Text>
    </View>
  )
}

/** "ACTION NOW ───────" */
export function SectionRule({ children, color }: { children: ReactNode; color?: string }) {
  const { c } = useTheme()
  return (
    <View style={styles.rule}>
      <Text style={{ fontFamily: font.displaySemi, fontSize: 13, letterSpacing: 1.8, color: color ?? c.muted }}>{children}</Text>
      <View style={{ flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: c.lineStrong }} />
    </View>
  )
}

/** Left margin of a register row: time logged, time elapsed, initials. */
export function MarginCell({ time, elapsed, initials }: { time: string; elapsed?: string; initials: string }) {
  const { c } = useTheme()
  return (
    <View style={[styles.margin, { borderRightColor: c.margin }]}>
      <Text style={{ fontFamily: font.monoMedium, fontSize: 11, color: c.ink }}>{time}</Text>
      {elapsed ? <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>{elapsed}</Text> : null}
      <Text style={{ fontFamily: font.bodySemi, fontSize: 11, color: c.ink, marginTop: 1 }}>{initials}</Text>
    </View>
  )
}

/** Overdue / due soon / waiting counts across the top of the Register. */
export function SummaryStrip({ overdue, soon, waiting }: { overdue: number; soon: number; waiting: number }) {
  const { c } = useTheme()
  const cell = (n: number, label: string, bg: string, fg: string, sub: string, last = false) => (
    <View style={[styles.sumCell, { backgroundColor: bg, borderRightWidth: last ? 0 : 1, borderRightColor: c.ink }]}>
      <Text style={{ fontFamily: font.display, fontSize: 26, lineHeight: 28, color: fg }}>{n}</Text>
      <Text style={{ fontFamily: font.body, fontSize: 11.5, color: sub }}>{label}</Text>
    </View>
  )
  return (
    <View style={[styles.sum, { borderColor: c.ink }]}>
      {cell(overdue, 'overdue', overdue ? c.danger : c.surface, overdue ? '#FFFFFF' : c.ink, overdue ? '#FFFFFF' : c.muted)}
      {cell(soon, 'due within 1 h', soon ? c.warnBg : c.surface, soon ? c.warnInk : c.ink, soon ? c.warnInk : c.muted)}
      {cell(waiting, 'waiting', c.surface, c.ink, c.muted, true)}
    </View>
  )
}

const STEP: Record<SampleStatus, number> = { RECEIVED: 1, IN_PROGRESS: 2, PENDING: 3, SENT_OUT: 3, COMPLETED: 4, REJECTED: 4 }

/** Four-segment progress: received → in the lab → waiting/sent → done. */
export function ProgressTrack({ status }: { status: SampleStatus }) {
  const { c } = useTheme()
  const n = STEP[status]
  return (
    <View style={styles.track} accessibilityLabel={`Step ${n} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={{ flex: 1, height: 3, borderRadius: 1, backgroundColor: i <= n ? c.stamp[status] : c.line }} />
      ))}
    </View>
  )
}

/** A handover note on a slip of paper. */
export function NoteSlip({ by, at, text }: { by: string; at: string; text: string }) {
  const { c } = useTheme()
  return (
    <View style={[styles.slip, { backgroundColor: c.note, borderColor: c.lineStrong }]}>
      <Text style={{ fontFamily: font.body, fontSize: 11.5, color: c.muted }}>
        Handover · {by} {at}
      </Text>
      <Text style={{ fontFamily: font.body, fontSize: 13, lineHeight: 18, color: c.ink }}>{text}</Text>
    </View>
  )
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/** 24-hour "07:05" — built by hand because some locales add AM/PM even with hour12: false. */
export function hhmm(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** "4h03", "35m" */
export function elapsedSince(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  return h >= 48 ? `${Math.floor(h / 24)}d` : `${h}h${String(mins % 60).padStart(2, '0')}`
}

export function shiftLabel(d = new Date()): string {
  const h = d.getHours()
  const day = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
  return `${day} · ${h >= 7 && h < 19 ? 'Day shift' : 'Night shift'}`
}

const styles = StyleSheet.create({
  stamp: { borderWidth: 2, borderRadius: 3, paddingVertical: 1, alignSelf: 'flex-start' },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  margin: { width: 52, borderRightWidth: 1.5, paddingTop: 11, paddingRight: 7, alignItems: 'flex-end' },
  sum: { flexDirection: 'row', borderWidth: 1.5, borderRadius: 4, overflow: 'hidden' },
  sumCell: { flex: 1, paddingVertical: 7, paddingHorizontal: 10 },
  track: { flexDirection: 'row', gap: 3, marginTop: 8 },
  slip: { marginTop: 8, padding: 8, borderWidth: 1, borderStyle: 'dashed', borderRadius: 2, gap: 2 }
})
