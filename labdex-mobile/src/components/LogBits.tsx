import { StyleSheet, Text, View } from 'react-native'
import { AlarmClock, TimerReset } from 'lucide-react-native'
import { STATUS_META, sampleAlerts, type LogView, type SampleStatus } from '@shared/logs'
import type { LabTest } from '@shared/types'
import { font, useTheme, type Colors } from '@/lib/theme'

export function statusColors(c: Colors, s: SampleStatus): { fg: string; bg: string } {
  switch (s) {
    case 'RECEIVED':
      return c.storage.FRIDGE
    case 'IN_PROGRESS':
      return c.storage.DEEP_FROZEN
    case 'PENDING':
      return { fg: c.amber, bg: `${c.amber}22` }
    case 'SENT_OUT':
      return c.storage.FROZEN
    case 'COMPLETED':
      return { fg: c.accent, bg: c.accentSoft }
    case 'REJECTED':
      return { fg: c.danger, bg: c.dangerSoft }
  }
}

export function LogStatusPill({ status }: { status: SampleStatus }) {
  const { c } = useTheme()
  const col = statusColors(c, status)
  return (
    <View style={[styles.pill, { backgroundColor: col.bg }]}>
      <Text style={{ fontFamily: font.monoSemi, fontSize: 9.5, letterSpacing: 0.6, color: col.fg }}>{STATUS_META[status].label.toUpperCase()}</Text>
    </View>
  )
}

export function AlertChips({ v, tests }: { v: LogView; tests: LabTest[] }) {
  const { c } = useTheme()
  if (!v.open || !v.first) return null
  return (
    <View style={styles.chips}>
      {sampleAlerts(v.first.at, tests).map((a) => {
        const col = a.level === 'late' ? { fg: c.danger, bg: c.dangerSoft } : a.level === 'soon' ? { fg: c.amber, bg: `${c.amber}22` } : { fg: c.ink2, bg: c.surface3 }
        const Icon = a.kind === 'stability' ? TimerReset : AlarmClock
        return (
          <View key={a.kind} style={[styles.chip, { backgroundColor: col.bg }]}>
            <Icon size={12} color={col.fg} />
            <Text style={{ fontFamily: a.level === 'late' ? font.bodySemi : font.bodyMedium, fontSize: 11.5, color: col.fg }}>{a.text}</Text>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  pill: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }
})
