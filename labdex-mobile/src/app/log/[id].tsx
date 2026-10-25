import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { AlertTriangle, ChevronRight, Clock, CloudUpload, Plus } from 'lucide-react-native'
import { STATUS_ORDER, sampleAlerts, type SampleStatus } from '@shared/logs'
import type { LabTest } from '@shared/types'
import { errMsg, useData } from '@/lib/data'
import { useRequireStaff } from '@/lib/identity'
import { font, useTheme } from '@/lib/theme'
import { tap } from '@/components/ui'
import { TubeStack } from '@/components/Visuals'
import { MarginCell, ProgressTrack, STAMP_WORD, SectionRule, Stamp, elapsedSince, hhmm, initials } from '@/components/Logbook'

export default function LogDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { c } = useTheme()
  const { logs, tests, con, addLogEvent } = useData()
  const requireStaff = useRequireStaff()
  const v = logs.find((x) => x.log.id === id)
  const [status, setStatus] = useState<SampleStatus>(v && v.open ? v.status : 'COMPLETED')
  const [note, setNote] = useState('')

  if (!v) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <Text style={{ fontFamily: font.body, color: c.muted }}>This entry is not in the register.</Text>
      </View>
    )
  }

  const ts = v.log.testIds.map((tid) => tests.find((t) => t.id === tid)).filter((t): t is LabTest => !!t)
  const missing = v.log.testCodes.filter((code) => !ts.some((t) => t.code === code))
  const rejectReasons = [...new Set(ts.flatMap((t) => t.rejectionCriteria))]
  const alerts = v.open && v.first ? sampleAlerts(v.first.at, ts) : []
  const canAdd = status !== 'REJECTED' || !!note.trim()
  const logged = new Date(v.log.createdAt)

  const add = async () => {
    if (!(await requireStaff('TECH', `update ${v.log.labNumber}`, { allowProvisional: true }))) return
    try {
      addLogEvent(v.log.id, status, note)
      setNote('')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    } catch (e) {
      Alert.alert('Could not add update', errMsg(e))
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding" keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {/* The specimen label */}
          <View style={[styles.label, { backgroundColor: c.surface, borderColor: c.ink }]}>
            <View style={styles.labelTop}>
              <Text style={[styles.cap, { color: c.muted }]}>LAB NO.</Text>
              <Stamp status={v.status} />
            </View>
            <Text style={{ fontFamily: font.display, fontSize: 40, lineHeight: 44, color: c.ink, textDecorationLine: v.status === 'REJECTED' ? 'line-through' : 'none', textDecorationColor: c.danger }}>
              {v.log.labNumber}
            </Text>
            <View style={[styles.labelGrid, { borderTopColor: c.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cap, { color: c.muted }]}>LOGGED</Text>
                <Text style={[styles.val, { color: c.ink }]}>
                  {hhmm(v.log.createdAt)} · {logged.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cap, { color: c.muted }]}>BY</Text>
                <Text numberOfLines={1} style={[styles.val, { color: c.ink }]}>
                  {v.log.createdByName}
                </Text>
              </View>
              <View>
                <Text style={[styles.cap, { color: c.muted }]}>{v.open ? 'IN LAB' : 'CLOSED'}</Text>
                <Text style={[styles.val, { color: c.ink }]}>{v.open ? elapsedSince(v.first?.at ?? v.log.createdAt) : hhmm(v.last?.at ?? v.log.createdAt)}</Text>
              </View>
            </View>
            <ProgressTrack status={v.status} />
            {v.pendingUploads > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                <CloudUpload size={13} color={c.muted} />
                <Text style={{ fontFamily: font.body, fontSize: 12, color: c.muted }}>
                  {v.pendingUploads} update{v.pendingUploads > 1 ? 's' : ''} waiting to upload
                </Text>
              </View>
            )}
          </View>

          {alerts.map((a) =>
            a.level === 'late' ? (
              <View key={a.kind} style={[styles.banner, { backgroundColor: c.danger }]}>
                <AlertTriangle size={15} color="#fff" />
                <Text style={{ flex: 1, fontFamily: font.bodyMedium, fontSize: 13, color: '#fff' }}>{a.text}</Text>
              </View>
            ) : (
              <View key={a.kind} style={[styles.banner, { backgroundColor: a.level === 'soon' ? c.warnBg : c.surface2 }]}>
                <Clock size={14} color={a.level === 'soon' ? c.warnInk : c.muted} />
                <Text style={{ flex: 1, fontFamily: font.body, fontSize: 13, color: a.level === 'soon' ? c.warnInk : c.ink2 }}>{a.text}</Text>
              </View>
            )
          )}

          <SectionRule>TESTS ON THIS SAMPLE</SectionRule>
          {ts.map((t) => (
            <Pressable key={t.id} onPress={() => router.push(`/test/${t.id}`)} style={({ pressed }) => [styles.test, { borderBottomColor: c.line }, pressed && { backgroundColor: c.surface3 }]}>
              <TubeStack containers={t.specimens.map((s) => con(s.containerId))} size={28} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: font.bodySemi, fontSize: 14.5, color: c.ink }}>
                  {t.name}
                </Text>
                <Text style={{ fontFamily: font.mono, fontSize: 11.5, color: c.muted }}>{t.code}</Text>
              </View>
              <ChevronRight size={16} color={c.muted} />
            </Pressable>
          ))}
          {missing.map((code) => (
            <Text key={code} style={{ fontFamily: font.body, fontSize: 13, color: c.muted, paddingHorizontal: 16, paddingVertical: 8 }}>
              {code} — no longer in the directory
            </Text>
          ))}

          <SectionRule>WRITE AN ENTRY</SectionRule>
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.statuses}>
              {STATUS_ORDER.map((s) => {
                const on = status === s
                const col = c.stamp[s]
                return (
                  <Pressable
                    key={s}
                    onPress={() => {
                      tap()
                      setStatus(s)
                    }}
                    accessibilityState={{ selected: on }}
                    style={[styles.status, { borderColor: on ? col : c.lineStrong, backgroundColor: on ? col : 'transparent', transform: [{ rotate: on ? '-2deg' : '0deg' }] }]}
                  >
                    <Text style={{ fontFamily: font.display, fontSize: 14, letterSpacing: 1, color: on ? '#FFFFFF' : c.ink2 }}>{STAMP_WORD[s]}</Text>
                  </Pressable>
                )
              })}
            </View>
            <View style={[styles.noteBox, { backgroundColor: c.note, borderColor: status === 'REJECTED' && !note.trim() ? c.danger : c.lineStrong }]}>
              <TextInput
                multiline
                value={note}
                onChangeText={setNote}
                placeholder={status === 'REJECTED' ? 'Reason for rejection (required)' : 'Handover note — what happened, what is next…'}
                placeholderTextColor={c.muted}
                style={{ minHeight: 70, fontFamily: font.body, fontSize: 14.5, lineHeight: 20, color: c.ink, textAlignVertical: 'top', padding: 0 }}
              />
            </View>
            {status === 'REJECTED' && rejectReasons.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {rejectReasons.map((r) => (
                  <Pressable key={r} onPress={() => setNote((n) => (n ? `${n}; ${r}` : r))} style={[styles.reason, { borderColor: c.lineStrong }]}>
                    <Plus size={11} color={c.muted} />
                    <Text style={{ fontFamily: font.bodyMedium, fontSize: 12.5, color: c.ink2 }}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Pressable onPress={add} disabled={!canAdd} style={({ pressed }) => [styles.addBtn, { backgroundColor: c.ink, opacity: canAdd ? (pressed ? 0.85 : 1) : 0.35 }]}>
              <Text style={{ fontFamily: font.display, fontSize: 19, letterSpacing: 1.4, color: c.bg }}>SIGN ENTRY</Text>
            </Pressable>
          </View>

          <SectionRule>REGISTER · {v.events.length} ENTR{v.events.length === 1 ? 'Y' : 'IES'}</SectionRule>
          {[...v.events].reverse().map((e) => (
            <View key={e.id} style={[styles.event, { borderBottomColor: c.line }]}>
              <MarginCell time={hhmm(e.at)} elapsed={new Date(e.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} initials={initials(e.staffName)} />
              <View style={{ flex: 1, paddingVertical: 10, paddingLeft: 12, paddingRight: 16, gap: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Stamp status={e.status} size="sm" />
                  <Text style={{ fontFamily: font.bodyMedium, fontSize: 13.5, color: c.ink }}>{e.staffName}</Text>
                  <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>{e.staffNumber}</Text>
                </View>
                {e.note ? <Text style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: c.ink2 }}>{e.note}</Text> : null}
              </View>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  label: { marginHorizontal: 16, marginTop: 4, borderWidth: 2, borderRadius: 6, padding: 14 },
  labelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cap: { fontFamily: font.displaySemi, fontSize: 11.5, letterSpacing: 1.6 },
  val: { fontFamily: font.monoMedium, fontSize: 13, marginTop: 1 },
  labelGrid: { flexDirection: 'row', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderStyle: 'dashed' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 3 },
  test: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  status: { paddingHorizontal: 10, height: 36, borderRadius: 3, borderWidth: 2, justifyContent: 'center' },
  noteBox: { marginTop: 12, padding: 12, borderWidth: 1, borderStyle: 'dashed', borderRadius: 3 },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed' },
  addBtn: { height: 52, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  event: { flexDirection: 'row', borderBottomWidth: 1 }
})
