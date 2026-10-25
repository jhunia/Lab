import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Copy, Moon, Plus, Snowflake, Sparkles, Sun, Thermometer, Trash2, X } from 'lucide-react-native'
import { STORAGE_LABELS, VOLUME_UNITS, type Container, type Duration, type Specimen, type StorageTemp, type TestInput, type TimeUnit } from '@shared/types'
import { blankSpecimen } from '@shared/migrate'
import { DESCRIPTION_MAX, validateTest } from '@shared/validate'
import { blankTest, duplicateInput, toInput } from '@shared/helpers'
import { errMsg, useData } from '@/lib/data'
import { font, useTheme } from '@/lib/theme'
import { TestCard } from '@/components/TestCard'
import { TubeIcon } from '@/components/Visuals'
import { ListEditor } from '@/components/ListEditor'
import { Chip, Field, Input, Segmented, tap } from '@/components/ui'
import { useRequireStaff } from '@/lib/identity'

const SAMPLE_TYPES = ['Whole blood', 'Serum', 'EDTA plasma', 'Citrated plasma', 'Heparin plasma', 'Fluoride plasma', 'Midstream urine', '24 h urine', 'Swab', 'CSF', 'Stool', 'Tissue', 'Cervical cells (liquid-based)', 'Cervical smear (conventional)']
const DAYS = ['24/7', 'Daily', 'Mon–Fri', 'Mon–Sat']
const REJECT_COMMON = ['Haemolysed', 'Clotted', 'Under-filled', 'Unlabelled', 'Wrong container', 'Leaking']
const TEMPS: { v: StorageTemp; icon: typeof Sun; short: string }[] = [
  { v: 'ROOM', icon: Sun, short: 'RT' },
  { v: 'FRIDGE', icon: Thermometer, short: '2–8°' },
  { v: 'FROZEN', icon: Snowflake, short: '−20°' },
  { v: 'DEEP_FROZEN', icon: Sparkles, short: '−70°' }
]
const UNITS: { v: TimeUnit; label: string }[] = [
  { v: 'min', label: 'min' },
  { v: 'h', label: 'hrs' },
  { v: 'd', label: 'days' },
  { v: 'wk', label: 'wks' }
]

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
const numStr = (n: number | null | undefined) => (n == null || n === 0 ? '' : String(n))

export default function EditTest() {
  const { id, from, dep: depParam } = useLocalSearchParams<{ id?: string; from?: string; dep?: string }>()
  const { c } = useTheme()
  const { tests, departments, containers, dep, con, mutate } = useData()
  const requireStaff = useRequireStaff()
  const scroll = useRef<ScrollView>(null)

  const initial = useMemo<TestInput>(() => {
    const src = tests.find((t) => t.id === (id ?? from))
    if (id && src) return toInput(src)
    if (from && src) return duplicateInput(src)
    return blankTest(depParam ?? '', '')
  }, [])

  const [t, setT] = useState<TestInput>(initial)
  const [touched, setTouched] = useState(false)
  const errors = useMemo(() => validateTest(t, tests), [t, tests])
  const err = (k: string) => (touched ? errors[k] : undefined)
  const set = <K extends keyof TestInput>(k: K, v: TestInput[K]) => setT((p) => ({ ...p, [k]: v }))
  const dirty = JSON.stringify(t) !== JSON.stringify(initial)
  const sortedContainers = useMemo(() => [...containers].sort((a, b) => a.drawOrder - b.drawOrder), [containers])

  const save = async () => {
    setTouched(true)
    if (Object.keys(errors).length) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
      scroll.current?.scrollTo({ y: 0, animated: true })
      return
    }
    if (!(await requireStaff('SENIOR', 'save the test'))) return
    try {
      const saved = mutate((core) => core.saveTest(t))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      if (id) router.back()
      else router.replace(`/test/${saved.id}`)
    } catch (e) {
      Alert.alert('Could not save', errMsg(e))
    }
  }

  const cancel = () => {
    if (!dirty) return router.back()
    Alert.alert('Discard changes?', 'You have unsaved changes to this test.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() }
    ])
  }

  const issues = touched ? Object.values(errors) : []

  return (
    <>
      <Stack.Screen
        options={{
          title: id ? 'Edit test' : 'New test',
          gestureEnabled: !dirty,
          headerLeft: () => (
            <Pressable onPress={cancel} hitSlop={10} style={{ paddingRight: 16 }}>
              <Text style={{ fontFamily: font.body, fontSize: 16, color: c.ink2 }}>Cancel</Text>
            </Pressable>
          ),
          headerRight: () => (
            <Pressable onPress={save} hitSlop={10}>
              <Text style={{ fontFamily: font.bodySemi, fontSize: 16, color: c.accent }}>{id ? 'Save' : 'Create'}</Text>
            </Pressable>
          )
        }}
      />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <Text style={[styles.eyebrow, { color: c.muted }]}>Live preview</Text>
          <TestCard test={t} dep={dep(t.departmentId)} conOf={con} />

          {issues.length > 0 && (
            <View style={[styles.issues, { backgroundColor: c.dangerSoft }]}>
              <Text style={{ fontFamily: font.bodySemi, color: c.danger }}>
                {issues.length} issue{issues.length > 1 ? 's' : ''} to fix
              </Text>
              {issues.map((m, i) => (
                <Text key={i} style={{ fontFamily: font.body, fontSize: 13, color: c.danger }}>
                  • {m}
                </Text>
              ))}
            </View>
          )}

          <Section n="01" title="Identity">
            <Field label="Test code" error={err('code')} hint="e.g. CHEM-GLU">
              <Input mono value={t.code} onChangeText={(v) => set('code', v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} invalid={!!err('code')} placeholder="CODE" />
            </Field>
            <Field label="Test name" error={err('name')}>
              <Input large value={t.name} onChangeText={(v) => set('name', v)} invalid={!!err('name')} placeholder="Full Blood Count" />
            </Field>
            <Field label="Status">
              <Segmented
                value={t.status === 'ARCHIVED' ? 'PUBLISHED' : t.status}
                onChange={(v) => set('status', v)}
                options={[
                  { v: 'DRAFT', label: 'Draft' },
                  { v: 'PUBLISHED', label: 'Published' }
                ]}
              />
            </Field>
            <Field label="Synonyms & abbreviations" hint="Searchable — add with Return or a comma">
              <ListEditor variant="chips" value={t.synonyms} onChange={(v) => set('synonyms', v)} placeholder="CBC, FBC…" />
            </Field>
            <Field label="Department" error={err('departmentId')}>
              <View style={styles.wrap}>
                {departments.map((d) => (
                  <Chip key={d.id} label={d.name} color={d.color} active={t.departmentId === d.id} onPress={() => set('departmentId', d.id)} />
                ))}
              </View>
            </Field>
          </Section>

          <Section n="02" title="Samples">
            {err('specimens') ? <Text style={{ fontFamily: font.bodyMedium, fontSize: 13, color: c.danger, marginBottom: 10 }}>{err('specimens')}</Text> : null}
            <View style={{ gap: 14 }}>
              {t.specimens.map((sp, i) => (
                <SpecimenEditor
                  key={sp.id || `new-${i}`}
                  sp={sp}
                  index={i}
                  total={t.specimens.length}
                  containers={sortedContainers}
                  err={(f) => err(`specimens.${i}.${f}`)}
                  onChange={(next) => set('specimens', t.specimens.map((x, j) => (j === i ? next : x)))}
                  onRemove={() => set('specimens', t.specimens.filter((_, j) => j !== i))}
                  onDuplicate={() => set('specimens', [...t.specimens.slice(0, i + 1), { ...sp, id: '' }, ...t.specimens.slice(i + 1)])}
                />
              ))}
            </View>
            <Pressable onPress={() => set('specimens', [...t.specimens, blankSpecimen('')])} style={[styles.dashed, { borderColor: c.lineStrong, marginTop: 14 }]}>
              <Plus size={15} color={c.muted} />
              <Text style={{ fontFamily: font.bodySemi, color: c.muted }}>Add another sample</Text>
            </Pressable>
            <Text style={{ fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: c.muted, marginVertical: 12 }}>
              Required samples must all be collected. Mark two or more as Alternative when any one of them is acceptable (e.g. serum or plasma).
            </Text>
            <Field label="Transport notes" hint="Optional — applies to the whole test">
              <Input multiline value={t.transportNotes} onChangeText={(v) => set('transportNotes', v)} placeholder="Separate within 2 h, ship on dry ice…" style={{ minHeight: 70 }} />
            </Field>
          </Section>

          <Section n="03" title="Turnaround time">
            <Field label="Routine TAT" error={err('tatRoutine')}>
              <DurationInput value={t.tatRoutine} onChange={(d) => set('tatRoutine', d)} invalid={!!err('tatRoutine')} />
            </Field>
            <Field label="Urgent / STAT TAT" error={err('tatUrgent')}>
              {t.tatUrgent ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <DurationInput value={t.tatUrgent} onChange={(d) => set('tatUrgent', d)} invalid={!!err('tatUrgent')} />
                  </View>
                  <Pressable onPress={() => set('tatUrgent', null)} hitSlop={10} accessibilityLabel="Remove urgent TAT">
                    <X size={18} color={c.muted} />
                  </Pressable>
                </View>
              ) : (
                <Pressable onPress={() => set('tatUrgent', { value: 1, unit: 'h' })} style={[styles.dashed, { borderColor: c.lineStrong }]}>
                  <Plus size={15} color={c.muted} />
                  <Text style={{ fontFamily: font.bodySemi, color: c.muted }}>STAT available</Text>
                </Pressable>
              )}
            </Field>
            <Field label="Days performed">
              <Input value={t.daysPerformed} onChangeText={(v) => set('daysPerformed', v)} placeholder="Mon–Fri" />
              <View style={styles.wrap}>
                {DAYS.map((d) => (
                  <Chip key={d} label={d} active={t.daysPerformed === d} onPress={() => set('daysPerformed', d)} />
                ))}
              </View>
            </Field>
          </Section>

          <Section n="04" title="Guidance">
            <Field
              label="Brief info"
              error={err('description')}
              right={<Text style={{ fontFamily: font.mono, fontSize: 11, color: t.description.length > DESCRIPTION_MAX ? c.danger : c.muted }}>{`${t.description.length}/${DESCRIPTION_MAX}`}</Text>}
            >
              <Input multiline value={t.description} onChangeText={(v) => set('description', v)} invalid={!!err('description')} placeholder="What the test measures and why it is ordered." style={{ minHeight: 90 }} />
            </Field>
            <Field label="Patient preparation" hint="Optional">
              <Input multiline value={t.patientPrep} onChangeText={(v) => set('patientPrep', v)} placeholder="Fast for 8–12 hours…" style={{ minHeight: 70 }} />
            </Field>
            <Field label="Specific suggestions" hint="Collection tips, shown as a checklist">
              <ListEditor value={t.suggestions} onChange={(v) => set('suggestions', v)} placeholder="Invert gently 8–10 times…" />
            </Field>
            <Field label="Rejection criteria">
              <ListEditor value={t.rejectionCriteria} onChange={(v) => set('rejectionCriteria', v)} placeholder="Add a reason to reject…" quickAdd={REJECT_COMMON} />
            </Field>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  )
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  const { c } = useTheme()
  return (
    <View style={{ marginTop: 26, paddingTop: 20, borderTopWidth: 1, borderTopColor: c.lineStrong, borderStyle: 'dashed' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <View style={{ backgroundColor: c.accentSoft, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ fontFamily: font.monoMedium, fontSize: 11, color: c.accent }}>{n}</Text>
        </View>
        <Text style={{ fontFamily: font.display, fontSize: 19, color: c.ink }}>{title}</Text>
      </View>
      {children}
    </View>
  )
}

function SpecimenEditor({
  sp,
  index,
  total,
  containers,
  err,
  onChange,
  onRemove,
  onDuplicate
}: {
  sp: Specimen
  index: number
  total: number
  containers: Container[]
  err: (field: string) => string | undefined
  onChange: (s: Specimen) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const { c } = useTheme()
  const set = <K extends keyof Specimen>(k: K, v: Specimen[K]) => onChange({ ...sp, [k]: v })
  const alt = sp.role === 'ALTERNATIVE'
  return (
    <View style={[styles.sampleBox, { backgroundColor: c.surface, borderColor: c.line, borderLeftColor: alt ? c.amber : c.accent, borderStyle: alt ? 'dashed' : 'solid' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Text style={{ fontFamily: font.monoSemi, fontSize: 12, color: c.ink2 }}>Sample {index + 1}</Text>
        <View style={{ flex: 1 }}>
          <Segmented
            value={sp.role}
            onChange={(v) => set('role', v)}
            options={[
              { v: 'REQUIRED', label: 'Required' },
              { v: 'ALTERNATIVE', label: 'Alternative' }
            ]}
          />
        </View>
        <Pressable onPress={onDuplicate} hitSlop={8} accessibilityLabel="Duplicate sample">
          <Copy size={17} color={c.muted} />
        </Pressable>
        {total > 1 && (
          <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel="Remove sample">
            <Trash2 size={17} color={c.muted} />
          </Pressable>
        )}
      </View>

      <Field label="Sample type" error={err('sampleType')}>
        <Input value={sp.sampleType} onChangeText={(v) => set('sampleType', v)} invalid={!!err('sampleType')} placeholder="Serum" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {SAMPLE_TYPES.map((x) => (
            <Chip key={x} label={x} active={sp.sampleType === x} onPress={() => set('sampleType', x)} />
          ))}
        </ScrollView>
      </Field>
      <Field label="Volume required" error={err('volume')}>
        <Input mono keyboardType="decimal-pad" value={numStr(sp.volume)} onChangeText={(v) => set('volume', numOrNull(v) ?? 0)} invalid={!!err('volume')} placeholder="3" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {VOLUME_UNITS.map((u) => (
            <Chip key={u} label={u} active={sp.volumeUnit === u} onPress={() => set('volumeUnit', u)} />
          ))}
        </ScrollView>
      </Field>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Field label="Minimum" error={err('minVolume')} hint="Optional">
            <Input mono keyboardType="decimal-pad" value={numStr(sp.minVolume)} onChangeText={(v) => set('minVolume', numOrNull(v))} invalid={!!err('minVolume')} />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Paediatric" error={err('paedVolume')} hint="Optional">
            <Input mono keyboardType="decimal-pad" value={numStr(sp.paedVolume)} onChangeText={(v) => set('paedVolume', numOrNull(v))} invalid={!!err('paedVolume')} />
          </Field>
        </View>
      </View>
      <Field label="Container" error={err('containerId')} hint="In order of draw">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
          {containers.map((k) => {
            const on = sp.containerId === k.id
            return (
              <Pressable
                key={k.id}
                onPress={() => {
                  tap()
                  set('containerId', k.id)
                }}
                style={[styles.tube, { backgroundColor: on ? c.accentSoft : c.surface2, borderColor: on ? c.accent : c.line }]}
              >
                <TubeIcon container={k} size={44} />
                <Text numberOfLines={2} style={{ fontFamily: font.bodySemi, fontSize: 12, color: c.ink, textAlign: 'center' }}>
                  {k.name}
                </Text>
                <Text numberOfLines={2} style={{ fontFamily: font.body, fontSize: 10.5, color: c.muted, textAlign: 'center' }}>
                  {k.additive}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </Field>
      <Field label="Store / transport at">
        <View style={styles.grid2}>
          {TEMPS.map(({ v, icon: Icon }) => {
            const on = sp.storageTemp === v
            const col = c.storage[v]
            return (
              <Pressable
                key={v}
                onPress={() => {
                  tap()
                  set('storageTemp', v)
                }}
                style={[styles.temp, { borderColor: on ? col.fg : c.line, backgroundColor: on ? col.bg : c.surface2 }]}
              >
                <Icon size={18} color={col.fg} />
                <Text style={{ fontFamily: font.bodySemi, fontSize: 13.5, color: c.ink }}>{STORAGE_LABELS[v].label}</Text>
                <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>{STORAGE_LABELS[v].range}</Text>
              </Pressable>
            )
          })}
        </View>
      </Field>
      <Field label="Stability" hint="How long this sample stays valid at each temperature">
        <View style={{ gap: 10 }}>
          {sp.stability.map((r, i) => (
            <View key={i} style={[styles.stab, { backgroundColor: c.surface2, borderColor: err(`stability.${i}`) ? c.danger : c.line }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Segmented value={r.temp} onChange={(v) => set('stability', sp.stability.map((x, j) => (j === i ? { ...x, temp: v } : x)))} options={TEMPS.map((x) => ({ v: x.v, label: x.short }))} />
                </View>
                <Pressable onPress={() => set('stability', sp.stability.filter((_, j) => j !== i))} hitSlop={10} accessibilityLabel="Remove rule">
                  <X size={18} color={c.muted} />
                </Pressable>
              </View>
              <DurationInput value={r} onChange={(d) => set('stability', sp.stability.map((x, j) => (j === i ? { ...x, ...d } : x)))} />
            </View>
          ))}
          <Pressable onPress={() => set('stability', [...sp.stability, { temp: sp.storageTemp, value: 24, unit: 'h' }])} style={[styles.dashed, { borderColor: c.lineStrong }]}>
            <Plus size={15} color={c.muted} />
            <Text style={{ fontFamily: font.bodySemi, color: c.muted }}>Add stability rule</Text>
          </Pressable>
        </View>
      </Field>
      <View style={[styles.switchRow, { backgroundColor: c.surface2, borderColor: c.line }]}>
        <Moon size={17} color={c.ink2} />
        <Text style={{ flex: 1, fontFamily: font.bodySemi, fontSize: 15, color: c.ink }}>Protect from light</Text>
        <Switch value={sp.protectFromLight} onValueChange={(v) => set('protectFromLight', v)} trackColor={{ true: c.accent, false: c.lineStrong }} thumbColor="#fff" />
      </View>
      <Field label="Notes for this sample" hint="Optional">
        <Input value={sp.notes} onChangeText={(v) => set('notes', v)} placeholder="e.g. draw during the urine collection" />
      </Field>
    </View>
  )
}

function DurationInput({ value, onChange, invalid }: { value: Duration; onChange: (d: Duration) => void; invalid?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Input mono style={{ width: 84 }} keyboardType="decimal-pad" value={numStr(value.value)} onChangeText={(v) => onChange({ ...value, value: numOrNull(v) ?? 0 })} invalid={invalid} placeholder="0" />
      <View style={{ flex: 1 }}>
        <Segmented value={value.unit} onChange={(u) => onChange({ ...value, unit: u })} options={UNITS} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  eyebrow: { fontFamily: font.monoMedium, fontSize: 10.5, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8 },
  issues: { marginTop: 14, padding: 14, borderRadius: 12, gap: 3 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tube: { width: 104, alignItems: 'center', gap: 5, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1.5 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  temp: { width: '48.5%', gap: 4, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  stab: { gap: 10, padding: 10, borderRadius: 12, borderWidth: 1 },
  dashed: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' },
  sampleBox: { padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 }
})
