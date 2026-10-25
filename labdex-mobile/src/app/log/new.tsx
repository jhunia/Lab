import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Plus, Search, X } from 'lucide-react-native'
import { STATUS_ORDER, type SampleStatus } from '@shared/logs'
import type { LabTest } from '@shared/types'
import { errMsg, useData } from '@/lib/data'
import { useRequireStaff } from '@/lib/identity'
import { font, useTheme } from '@/lib/theme'
import { Field, Input, tap } from '@/components/ui'
import { TubeStack } from '@/components/Visuals'
import { STAMP_WORD } from '@/components/Logbook'

export default function NewLog() {
  const { c } = useTheme()
  const { tests, search, con, createLog, logs, session } = useData()
  const requireStaff = useRequireStaff()
  const params = useLocalSearchParams<{ lab?: string }>()
  const [labNumber, setLab] = useState(typeof params.lab === 'string' ? params.lab.toUpperCase() : '')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<LabTest[]>([])
  const [status, setStatus] = useState<SampleStatus>('RECEIVED')
  const [note, setNote] = useState('')

  const published = tests.filter((t) => t.status === 'PUBLISHED')
  const matches = q.trim() ? search(q, published).filter((t) => !picked.includes(t)).slice(0, 6) : []
  const existing = labNumber.trim() ? logs.find((v) => v.open && v.log.labNumber.toUpperCase() === labNumber.trim().toUpperCase()) : undefined
  const rejectReasons = [...new Set(picked.flatMap((t) => t.rejectionCriteria))]
  const canSave = labNumber.trim() && picked.length > 0 && (status !== 'REJECTED' || note.trim())

  const save = async () => {
    // Re-check in case the 5-minute confirmation ran out while filling the form.
    if (!(await requireStaff('TECH', 'log this sample', { allowProvisional: true }))) return
    try {
      const id = createLog({ labNumber, tests: picked, status, note })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      router.replace(`/log/${id}`)
    } catch (e) {
      Alert.alert('Could not log sample', errMsg(e))
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Log a sample',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} hitSlop={10} style={{ paddingRight: 16 }}>
              <Text style={{ fontFamily: font.body, fontSize: 16, color: c.ink2 }}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} disabled={!canSave} hitSlop={10}>
              <Text style={{ fontFamily: font.bodySemi, fontSize: 16, color: canSave ? c.accent : c.muted }}>Save</Text>
            </Pressable>
          )
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior="padding" keyboardVerticalOffset={90}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {session && (
            <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted, marginBottom: 14 }}>
              Logging as <Text style={{ fontFamily: font.bodySemi, color: c.ink }}>{session.name}</Text> ({session.staffNumber})
            </Text>
          )}

          <Field label="Lab number (from the request form)" hint="Only the lab number is stored — never the patient’s name.">
            <Input mono large autoFocus={!params.lab} autoCapitalize="characters" autoCorrect={false} value={labNumber} onChangeText={(v) => setLab(v.toUpperCase())} placeholder="L-2026-0042" />
          </Field>
          {existing && (
            <Pressable onPress={() => router.replace(`/log/${existing.log.id}`)} style={[styles.warn, { backgroundColor: c.warnBg }]}>
              <Text style={{ fontFamily: font.body, fontSize: 13, color: c.warnInk }}>
                {existing.log.labNumber} is already open ({existing.log.testCodes.join(', ')}). <Text style={{ fontFamily: font.bodySemi }}>Open it instead →</Text>
              </Text>
            </Pressable>
          )}

          <Field label="Tests">
            {picked.length > 0 && (
              <View style={{ gap: 6 }}>
                {picked.map((t) => (
                  <View key={t.id} style={[styles.picked, { backgroundColor: c.surface, borderColor: c.line }]}>
                    <TubeStack containers={t.specimens.map((s) => con(s.containerId))} size={28} />
                    <Text style={{ fontFamily: font.mono, fontSize: 12, color: c.muted }}>{t.code}</Text>
                    <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.bodySemi, fontSize: 14, color: c.ink }}>
                      {t.name}
                    </Text>
                    <Pressable onPress={() => setPicked(picked.filter((x) => x !== t))} hitSlop={10} accessibilityLabel={`Remove ${t.code}`}>
                      <X size={17} color={c.muted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.lineStrong }]}>
              <Search size={17} color={c.muted} />
              <TextInput value={q} onChangeText={setQ} placeholder="Find a test — name, code or abbreviation" placeholderTextColor={c.muted} autoCorrect={false} style={{ flex: 1, fontFamily: font.body, fontSize: 15, color: c.ink, paddingVertical: 0 }} />
            </View>
            {matches.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => {
                  tap()
                  setPicked([...picked, t])
                  setQ('')
                }}
                style={({ pressed }) => [styles.match, { borderColor: c.line, backgroundColor: pressed ? c.surface3 : c.surface }]}
              >
                <Plus size={15} color={c.accent} />
                <Text style={{ fontFamily: font.mono, fontSize: 12, color: c.muted }}>{t.code}</Text>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.body, fontSize: 14, color: c.ink }}>
                  {t.name}
                </Text>
              </Pressable>
            ))}
          </Field>

          <Field label="Status">
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
          </Field>

          <Field label={status === 'REJECTED' ? 'Reason for rejection (required)' : 'Note (optional)'}>
            <Input multiline value={note} onChangeText={setNote} placeholder="e.g. Haemolysed — recollection requested from Ward 4" style={{ minHeight: 80 }} />
            {status === 'REJECTED' && rejectReasons.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {rejectReasons.map((r) => (
                  <Pressable key={r} onPress={() => setNote((n) => (n ? `${n}; ${r}` : r))} style={[styles.reason, { borderColor: c.lineStrong }]}>
                    <Plus size={11} color={c.muted} />
                    <Text style={{ fontFamily: font.bodyMedium, fontSize: 12.5, color: c.ink2 }}>{r}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Field>

          <Pressable onPress={save} disabled={!canSave} style={[styles.saveBtn, { backgroundColor: c.ink, opacity: canSave ? 1 : 0.35 }]}>
            <Text style={{ fontFamily: font.display, fontSize: 20, letterSpacing: 1.6, color: c.bg }}>WRITE IN REGISTER</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  warn: { padding: 12, borderRadius: 3, marginTop: -6, marginBottom: 14 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 3, borderWidth: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderRadius: 4, borderWidth: 1.5, paddingHorizontal: 14 },
  match: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1 },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  status: { paddingHorizontal: 10, height: 36, borderRadius: 3, borderWidth: 2, justifyContent: 'center' },
  reason: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, paddingHorizontal: 10, borderRadius: 15, borderWidth: 1, borderStyle: 'dashed' },
  saveBtn: { height: 54, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 4 }
})
