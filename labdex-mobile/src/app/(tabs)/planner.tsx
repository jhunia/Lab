import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { AlertTriangle, Check, Droplets, Moon, Printer, Search, Trash2, Zap } from 'lucide-react-native'
import { formatDuration } from '@shared/types'
import { fmtNum, planCollection, type Draw } from '@shared/helpers'
import { errMsg, useData } from '@/lib/data'
import { printPlan } from '@/lib/print'
import { font, useTheme } from '@/lib/theme'
import { CapDot, StorageBadge, TubeIcon } from '@/components/Visuals'
import { Button, Card, Eyebrow, tap } from '@/components/ui'

export default function Planner() {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { tests: all, con, dep, search } = useData()
  const tests = useMemo(() => all.filter((t) => t.status === 'PUBLISHED'), [all])
  const [selected, setSelected] = useState<string[]>([])
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState(true)

  const list = q.trim() ? search(q, tests) : [...tests].sort((a, b) => a.name.localeCompare(b.name))
  const picked = tests.filter((t) => selected.includes(t.id))
  const toggle = (id: string) => {
    tap()
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  const plan = useMemo(() => planCollection(picked, con), [picked, con])
  const draws: Draw[] = [...plan.blood, ...plan.other]
  const prep = picked.filter((t) => t.patientPrep)
  const light = [...new Set(draws.flatMap((d) => d.samples.filter((p) => p.specimen.protectFromLight).map((p) => p.test.code)))]

  const sampleLines = (d: Draw) =>
    d.samples.map((p) => (
      <Text key={p.test.id + p.specimen.id} style={{ fontFamily: font.body, fontSize: 13, color: c.ink2 }}>
        <Text style={{ fontFamily: font.mono, fontSize: 10.5, color: c.muted }}>{p.test.code} </Text>
        {p.test.name}
        {p.alternatives.length > 0 ? <Text style={{ color: c.amber }}>{` · or ${p.alternatives.map((a) => con(a.containerId)?.name ?? a.sampleType).join(' / ')}`}</Text> : null}
      </Text>
    ))

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 12 }}>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text style={{ fontFamily: font.display, fontSize: 27, letterSpacing: -0.5, color: c.ink }}>Collection planner</Text>
          <Text style={{ fontFamily: font.mono, fontSize: 12, color: c.muted }}>{String(picked.length).padStart(2, '0')} sel.</Text>
        </View>
        <View style={[styles.toggle, { backgroundColor: c.surface3, borderColor: c.line }]}>
          {(
            [
              ['Pick tests', true],
              [`Tray${plan.totalContainers ? ` · ${plan.totalContainers}` : ''}`, false]
            ] as const
          ).map(([label, val]) => (
            <Pressable key={String(val)} onPress={() => (tap(), setPicking(val))} style={[styles.toggleBtn, picking === val && { backgroundColor: c.surface }]}>
              <Text style={{ fontFamily: font.bodySemi, color: picking === val ? c.ink : c.muted }}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {picking ? (
        <>
          <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.lineStrong }]}>
            <Search size={17} color={c.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder="Find a test…" placeholderTextColor={c.muted} autoCorrect={false} style={{ flex: 1, fontFamily: font.body, fontSize: 15.5, color: c.ink, paddingVertical: 0 }} />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110, gap: 6 }} keyboardShouldPersistTaps="handled">
            {list.map((t) => {
              const on = selected.includes(t.id)
              return (
                <Pressable key={t.id} onPress={() => toggle(t.id)} style={[styles.pick, { backgroundColor: on ? c.surface : 'transparent', borderColor: on ? c.lineStrong : 'transparent' }]}>
                  <View style={[styles.box, { borderColor: on ? c.accent : c.lineStrong, backgroundColor: on ? c.accent : 'transparent' }]}>{on && <Check size={13} color={c.accentInk} strokeWidth={3} />}</View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: font.bodySemi, fontSize: 15, color: c.ink }}>
                      {t.name}
                    </Text>
                    <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>
                      {t.code} · {dep(t.departmentId)?.name}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 3 }}>
                    {t.specimens.map((sp) => (
                      <CapDot key={sp.id} color={con(sp.containerId)?.capColor} size={12} />
                    ))}
                  </View>
                </Pressable>
              )
            })}
          </ScrollView>
          {picked.length > 0 && (
            <View style={[styles.bar, { backgroundColor: c.ink }]}>
              <Text style={{ flex: 1, fontFamily: font.bodySemi, color: c.bg }}>
                {picked.length} test{picked.length > 1 ? 's' : ''} · {plan.totalContainers} containers
              </Text>
              <Button small variant="primary" label="View tray" onPress={() => setPicking(false)} />
            </View>
          )}
        </>
      ) : picked.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 80, paddingHorizontal: 30 }}>
          <Droplets size={36} color={c.muted} strokeWidth={1.4} />
          <Text style={{ fontFamily: font.display, fontSize: 17, color: c.ink }}>The tray is empty</Text>
          <Text style={{ fontFamily: font.body, color: c.muted, textAlign: 'center' }}>Pick the tests ordered for a patient. LabDex works out the tubes and the order of draw.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Eyebrow>Order of draw</Eyebrow>
              <Text style={{ fontFamily: font.display, fontSize: 21, color: c.ink }}>
                {plan.totalContainers} containers
                {plan.minBloodMl > 0 ? <Text style={{ fontFamily: font.mono, fontSize: 13, color: c.muted }}>{`  ≥${fmtNum(plan.minBloodMl)} mL`}</Text> : null}
              </Text>
            </View>
            <Button small variant="ghost" icon={Printer} onPress={() => printPlan(plan, picked).catch((e) => Alert.alert('Could not print', errMsg(e)))} />
            <Button small variant="ghost" icon={Trash2} label="Clear" onPress={() => (setSelected([]), setPicking(true))} />
          </View>

          {plan.blood.map((d, i) => (
            <Card key={d.container.id} style={{ flexDirection: 'row', padding: 14, gap: 14, alignItems: 'center' }}>
              <View style={[styles.step, { backgroundColor: c.ink }]}>
                <Text style={{ fontFamily: font.monoSemi, fontSize: 12, color: c.bg }}>{i + 1}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 3 }}>
                {Array.from({ length: d.tubes }, (_, k) => (
                  <TubeIcon key={k} container={d.container} size={64} />
                ))}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: font.display, fontSize: 16, color: c.ink }}>{d.container.name}</Text>
                <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.muted }}>
                  {d.container.additive} ·{' '}
                  <Text style={{ fontFamily: font.mono }}>
                    {d.tubes > 1 ? `${d.tubes} × ` : ''}
                    {d.container.size}
                  </Text>
                </Text>
                <View style={{ marginTop: 6, gap: 2 }}>{sampleLines(d)}</View>
              </View>
            </Card>
          ))}

          {plan.other.length > 0 && (
            <View style={{ gap: 8 }}>
              <Eyebrow>Other specimens</Eyebrow>
              {plan.other.map((d) => (
                <Card key={d.container.id} style={{ flexDirection: 'row', padding: 14, gap: 14, alignItems: 'center' }}>
                  <TubeIcon container={d.container} size={46} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ fontFamily: font.bodySemi, fontSize: 15, color: c.ink }}>{d.container.name}</Text>
                    {sampleLines(d)}
                  </View>
                </Card>
              ))}
            </View>
          )}

          {prep.length > 0 && (
            <Card style={{ padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <AlertTriangle size={15} color={c.amber} />
                <Text style={{ fontFamily: font.display, fontSize: 15, color: c.ink }}>Patient preparation</Text>
              </View>
              {prep.map((t) => (
                <Text key={t.id} style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: c.ink2 }}>
                  <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>{t.code} </Text>
                  {t.patientPrep}
                </Text>
              ))}
            </Card>
          )}

          <Card style={{ padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Zap size={15} color={c.accent} />
              <Text style={{ fontFamily: font.display, fontSize: 15, color: c.ink }}>Handling</Text>
            </View>
            {draws.map((d) => (
              <View key={d.container.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CapDot color={d.container.capColor} />
                <Text style={{ flex: 1, fontFamily: font.bodySemi, fontSize: 14, color: c.ink }}>{d.container.name.replace(/ top.*$/i, '')}</Text>
                <StorageBadge temp={d.samples[0].specimen.storageTemp} compact size="sm" />
              </View>
            ))}
            {light.length > 0 && (
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <Moon size={14} color={c.ink2} />
                <Text style={{ fontFamily: font.body, fontSize: 13.5, color: c.ink2 }}>Protect from light: {light.join(', ')}</Text>
              </View>
            )}
            {plan.slowest && (
              <Text style={{ fontFamily: font.body, fontSize: 13.5, color: c.muted }}>
                Full results within <Text style={{ fontFamily: font.monoSemi, color: c.ink }}>{formatDuration(plan.slowest.tatRoutine)}</Text> ({plan.slowest.code})
              </Text>
            )}
          </Card>
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  toggle: { flexDirection: 'row', padding: 3, borderRadius: 10, borderWidth: 1 },
  toggleBtn: { flex: 1, height: 36, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, margin: 16, marginBottom: 8 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', left: 16, right: 16, bottom: 16, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, paddingLeft: 16, borderRadius: 14 },
  step: { position: 'absolute', top: 10, left: 10, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', zIndex: 1 }
})
