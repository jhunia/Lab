import { Pressable, StyleSheet, Text, View } from 'react-native'
import { formatDuration, primarySpecimen, type Container, type Department, type TestInput } from '@shared/types'
import { fmtNum, specimenSummary } from '@shared/helpers'
import { font, useTheme } from '@/lib/theme'
import { StorageBadge, TatBar, TubeStack } from './Visuals'
import { StatusPill, tap } from './ui'

interface Props {
  test: TestInput
  dep?: Department
  conOf: (id: string) => Container | undefined
  onPress?: () => void
}

export function TestCard({ test, dep, conOf, onPress }: Props) {
  const { c } = useTheme()
  const main = primarySpecimen(test)
  const multi = test.specimens.length > 1
  const containers = test.specimens.map((s) => conOf(s.containerId))
  return (
    <Pressable
      onPress={
        onPress &&
        (() => {
          tap()
          onPress()
        })
      }
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.surface, borderColor: c.line, opacity: test.status === 'ARCHIVED' ? 0.6 : 1 },
        pressed && { transform: [{ scale: 0.985 }], borderColor: c.lineStrong }
      ]}
    >
      <View style={{ width: 4, backgroundColor: dep?.color ?? c.lineStrong }} />
      <View style={styles.body}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.code, { color: c.muted }]}>{test.code || 'CODE'}</Text>
          {test.status !== 'PUBLISHED' && <StatusPill status={test.status} />}
        </View>
        <Text numberOfLines={1} style={[styles.name, { color: c.ink }]}>
          {test.name || 'Untitled test'}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: font.body, fontSize: 13, color: c.muted }}>
          {multi ? (
            specimenSummary(test)
          ) : (
            <>
              {main?.sampleType || 'Sample type'} · <Text style={{ fontFamily: font.mono, color: c.ink2 }}>{main && main.volume > 0 ? `${fmtNum(main.volume)} ${main.volumeUnit}` : '— mL'}</Text>
            </>
          )}
        </Text>
        <View style={styles.foot}>
          <StorageBadge temp={main?.storageTemp ?? 'ROOM'} compact size="sm" />
          <TatBar routine={test.tatRoutine} urgent={test.tatUrgent} />
          <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.ink2 }}>{test.tatRoutine.value > 0 ? formatDuration(test.tatRoutine) : '—'}</Text>
        </View>
      </View>
      {/* Tear-off stub with perforation notches */}
      <View style={[styles.stub, { backgroundColor: c.surface2, borderLeftColor: c.lineStrong }]}>
        <View style={[styles.notch, { top: -7, backgroundColor: c.bg, borderColor: c.line }]} />
        <View style={[styles.notch, { bottom: -7, backgroundColor: c.bg, borderColor: c.line }]} />
        <TubeStack containers={containers} size={46} />
        <Text numberOfLines={2} style={[styles.stubLabel, { color: c.muted }]}>
          {multi ? `${test.specimens.length} samples` : (containers[0]?.name.replace(/ top.*$/i, '').replace(/ set$/i, '') ?? '—')}
        </Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', minHeight: 118 },
  body: { flex: 1, paddingVertical: 12, paddingHorizontal: 14, gap: 3 },
  code: { fontFamily: font.monoSemi, fontSize: 11, letterSpacing: 0.4 },
  name: { fontFamily: font.display, fontSize: 17, letterSpacing: -0.2 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 8 },
  stub: { width: 74, alignItems: 'center', justifyContent: 'center', gap: 6, borderLeftWidth: 1.5, borderStyle: 'dashed' },
  notch: { position: 'absolute', left: -7, width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },
  stubLabel: { fontFamily: font.monoMedium, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'center', paddingHorizontal: 4 }
})
