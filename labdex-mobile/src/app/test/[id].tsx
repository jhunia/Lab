import { useState, type ReactNode } from 'react'
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Archive, ArchiveRestore, CheckSquare, Clock, Copy, Moon, Pencil, Printer, RotateCcw, Trash2, Truck, User, XOctagon } from 'lucide-react-native'
import { STORAGE_LABELS, formatDuration, type HistoryEntry, type Specimen } from '@shared/types'
import { fmtNum, relTime, specimenSummary } from '@shared/helpers'
import { printTest } from '@/lib/print'
import { useRequireStaff } from '@/lib/identity'
import { useSeniorMode } from '@/lib/senior'
import { errMsg, useData } from '@/lib/data'
import { font, useTheme } from '@/lib/theme'
import { Barcode, ContainerChip, StorageBadge, TatBar, TubeIcon, TubeStack } from '@/components/Visuals'
import { Button, Card, Input, SectionTitle, Segmented, StatusPill } from '@/components/ui'

const ACTION_LABEL: Record<HistoryEntry['action'], string> = {
  created: 'Created',
  updated: 'Edited',
  archived: 'Archived',
  restored: 'Restored',
  reverted: 'Reverted',
  imported: 'Imported'
}

export default function TestDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { c } = useTheme()
  const { tests, dep, con, core, mutate } = useData()
  const requireStaff = useRequireStaff()
  // Techs get the reference card only; editing tools and version history appear while a Senior is confirmed.
  const canEdit = useSeniorMode().on
  const [pickedTab, setTab] = useState<'details' | 'history'>('details')
  const tab = canEdit ? pickedTab : 'details'
  const [deleting, setDeleting] = useState(false)
  const t = tests.find((x) => x.id === id)

  if (!t) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg }}>
        <Text style={{ fontFamily: font.body, color: c.muted }}>This test no longer exists.</Text>
      </View>
    )
  }

  const d = dep(t.departmentId)
  const archived = t.status === 'ARCHIVED'

  const run = (fn: () => void, ok?: () => void) => {
    try {
      fn()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      ok?.()
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      Alert.alert('Something went wrong', errMsg(e))
    }
  }

  const asSenior = async (reason: string, fn: () => void) => {
    if (await requireStaff('SENIOR', reason)) fn()
  }
  const goEdit = () => asSenior(`edit ${t.code}`, () => router.push({ pathname: '/test/edit', params: { id: t.id } }))

  const archive = () =>
    Alert.alert(`Archive ${t.code}?`, `“${t.name}” will be hidden from the directory. You can restore it any time.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Archive', onPress: () => asSenior(`archive ${t.code}`, () => run(() => mutate((x) => x.archiveTest(t.id)))) }
    ])

  const revert = (h: HistoryEntry) =>
    Alert.alert(`Restore version ${h.version}?`, 'The current version stays in the history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Restore', onPress: () => asSenior(`restore version ${h.version}`, () => run(() => mutate((x) => x.revertTo(h.id)))) }
    ])

  const history = tab === 'history' ? core.history(t.id) : []

  return (
    <>
      <Stack.Screen
        options={{
          title: t.code,
          headerTitleStyle: { fontFamily: font.monoSemi, color: c.ink, fontSize: 15 },
          headerRight: () =>
            !canEdit || archived ? null : (
              <Pressable onPress={goEdit} hitSlop={10} accessibilityLabel="Edit">
                <Text style={{ fontFamily: font.bodySemi, fontSize: 16, color: c.accent }}>Edit</Text>
              </Pressable>
            )
        }}
      />
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}>
        {/* Specimen label */}
        <View style={[styles.label, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: d?.color ?? c.muted }} />
          <View style={[styles.labelTop, { borderBottomColor: c.lineStrong }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontFamily: font.monoSemi, fontSize: 13, letterSpacing: 0.6, color: c.ink }}>{t.code}</Text>
              <Barcode value={t.code} />
            </View>
            {canEdit && <StatusPill status={t.status} />}
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: font.display, fontSize: 24, lineHeight: 28, color: c.ink }}>{t.name}</Text>
              {t.synonyms.length > 0 && <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted, marginTop: 4 }}>aka {t.synonyms.join(' · ')}</Text>}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: d?.color ?? c.muted }} />
                <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: c.ink2 }}>{d?.name ?? 'Unassigned'}</Text>
              </View>
            </View>
            <TubeStack containers={t.specimens.map((x) => con(x.containerId))} size={70} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canEdit && !archived && <Button label="Edit" icon={Pencil} variant="primary" style={{ flex: 1 }} onPress={goEdit} />}
          {canEdit && <Button label="Duplicate" icon={Copy} style={{ flex: 1 }} onPress={() => asSenior(`duplicate ${t.code}`, () => router.push({ pathname: '/test/edit', params: { from: t.id } }))} />}
          <Button
            icon={Printer}
            label={canEdit ? undefined : 'Print / PDF'}
            style={canEdit ? undefined : { flex: 1 }}
            onPress={() => printTest(t, d, con).catch((e) => Alert.alert('Could not print', errMsg(e)))}
          />
          {!canEdit ? null : archived ? (
            <>
              <Button label="Restore" icon={ArchiveRestore} style={{ flex: 1 }} onPress={() => asSenior(`restore ${t.code}`, () => run(() => mutate((x) => x.restoreTest(t.id))))} />
              <Button icon={Trash2} variant="dangerGhost" onPress={() => asSenior(`delete ${t.code}`, () => setDeleting(true))} />
            </>
          ) : (
            <Button icon={Archive} onPress={archive} />
          )}
        </View>

        {canEdit && (
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { v: 'details', label: 'Details' },
              { v: 'history', label: `History · v${t.version}` }
            ]}
          />
        )}

        {tab === 'details' ? (
          <View style={{ gap: 22 }}>
            {t.description ? <Text style={{ fontFamily: font.body, fontSize: 15.5, lineHeight: 23, color: c.ink2 }}>{t.description}</Text> : null}

            <View>
              <SectionTitle>{`Samples · ${specimenSummary(t)}`}</SectionTitle>
              <View style={{ gap: 10 }}>
                {t.specimens.map((sp, i) => (
                  <SampleCard key={sp.id} sp={sp} index={i} total={t.specimens.length} />
                ))}
              </View>
              {t.transportNotes ? <Note icon={<Truck size={15} color={c.muted} />} text={t.transportNotes} /> : null}
            </View>

            <View>
              <SectionTitle>Turnaround</SectionTitle>
              <Card style={{ flexDirection: 'row', marginBottom: 12 }}>
                <Spec label="Routine" value={formatDuration(t.tatRoutine)} big mono />
                <Spec label="Urgent / STAT" value={formatDuration(t.tatUrgent)} big mono color={t.tatUrgent ? c.urgent : undefined} />
                <Spec label="Performed" value={t.daysPerformed || '—'} />
              </Card>
              <TatBar routine={t.tatRoutine} urgent={t.tatUrgent} ticks />
            </View>

            {t.patientPrep ? (
              <View>
                <SectionTitle>Patient preparation</SectionTitle>
                <Note icon={<User size={15} color={c.muted} />} text={t.patientPrep} />
              </View>
            ) : null}

            {t.suggestions.length > 0 && (
              <View>
                <SectionTitle>Collection tips</SectionTitle>
                <View style={{ gap: 10 }}>
                  {t.suggestions.map((s, i) => (
                    <View key={i} style={styles.listItem}>
                      <CheckSquare size={16} color={c.accent} style={{ marginTop: 2 }} />
                      <Text style={[styles.listText, { color: c.ink }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {t.rejectionCriteria.length > 0 && (
              <View>
                <SectionTitle danger>Reject if</SectionTitle>
                <View style={{ gap: 6 }}>
                  {t.rejectionCriteria.map((s, i) => (
                    <View key={i} style={[styles.listItem, { backgroundColor: c.dangerSoft, padding: 10, borderRadius: 9 }]}>
                      <XOctagon size={16} color={c.danger} style={{ marginTop: 2 }} />
                      <Text style={[styles.listText, { color: c.ink }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.lineStrong }}>
              <Clock size={12} color={c.muted} />
              <Text style={{ fontFamily: font.mono, fontSize: 11.5, color: c.muted }}>
                v{t.version} · updated {relTime(t.updatedAt)}
              </Text>
            </View>
          </View>
        ) : (
          <View style={{ paddingLeft: 8 }}>
            {history.map((h, i) => (
              <View key={h.id} style={{ flexDirection: 'row', gap: 14 }}>
                <View style={{ alignItems: 'center', width: 12 }}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 4, borderWidth: 2, borderColor: i === 0 ? c.accent : c.lineStrong, backgroundColor: i === 0 ? c.accent : c.bg }} />
                  {i < history.length - 1 && <View style={{ flex: 1, width: 1, backgroundColor: c.lineStrong }} />}
                </View>
                <View style={{ flex: 1, paddingBottom: 20, gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontFamily: font.bodySemi, fontSize: 14.5, color: c.ink }}>
                      v{h.version} · {ACTION_LABEL[h.action]}
                    </Text>
                    <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.muted }}>{relTime(h.at)}</Text>
                  </View>
                  {h.changes.length > 0 && <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted }}>{h.changes.join(', ')}</Text>}
                  {canEdit && i > 0 && <Button small variant="ghost" icon={RotateCcw} label="Restore this version" onPress={() => revert(h)} style={{ alignSelf: 'flex-start', marginLeft: -12 }} />}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <DeleteDialog
        visible={deleting}
        code={t.code}
        name={t.name}
        onCancel={() => setDeleting(false)}
        onConfirm={() =>
          run(
            () => mutate((x) => x.deleteTest(t.id)),
            () => {
              setDeleting(false)
              router.back()
            }
          )
        }
      />
    </>
  )
}

function SampleCard({ sp, index, total }: { sp: Specimen; index: number; total: number }) {
  const { c } = useTheme()
  const { con } = useData()
  const k = con(sp.containerId)
  const alt = sp.role === 'ALTERNATIVE'
  return (
    <View style={[styles.sample, { backgroundColor: c.surface, borderColor: c.line, borderLeftColor: alt ? c.amber : c.accent, borderStyle: alt ? 'dashed' : 'solid' }]}>
      {total > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>Sample {index + 1}</Text>
          <View style={{ backgroundColor: alt ? `${c.amber}22` : c.accentSoft, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 1 }}>
            <Text style={{ fontFamily: font.monoMedium, fontSize: 9.5, letterSpacing: 0.8, color: alt ? c.amber : c.accent }}>{alt ? 'OR — ALTERNATIVE' : 'REQUIRED'}</Text>
          </View>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TubeIcon container={k} size={48} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: font.display, fontSize: 16, color: c.ink }}>{sp.sampleType}</Text>
          <ContainerChip container={k} />
          {k && (
            <Text style={{ fontFamily: font.body, fontSize: 12, color: c.muted }}>
              {k.additive} · {k.size}
              {k.drawOrder < 99 ? ` · draw #${k.drawOrder}` : ''}
            </Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontFamily: font.monoSemi, fontSize: 20, color: c.ink }}>
            {fmtNum(sp.volume)}
            <Text style={{ fontSize: 11, color: c.muted }}> {sp.volumeUnit}</Text>
          </Text>
          {sp.minVolume != null && <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>min {fmtNum(sp.minVolume)}</Text>}
          {sp.paedVolume != null && <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>paed {fmtNum(sp.paedVolume)}</Text>}
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <StorageBadge temp={sp.storageTemp} />
        {sp.protectFromLight && (
          <View style={[styles.lightBadge, { backgroundColor: c.surface3 }]}>
            <Moon size={13} color={c.ink2} />
            <Text style={{ fontFamily: font.monoMedium, fontSize: 12, color: c.ink2 }}>Protect from light</Text>
          </View>
        )}
      </View>
      {sp.stability.map((r, i) => (
        <View key={i} style={[styles.stabRow, { borderBottomColor: c.line }]}>
          <Text style={{ flex: 1, fontFamily: font.body, fontSize: 13.5, color: c.ink }}>Stable · {STORAGE_LABELS[r.temp].label}</Text>
          <Text style={{ width: 80, fontFamily: font.mono, fontSize: 12, color: c.muted }}>{STORAGE_LABELS[r.temp].range}</Text>
          <Text style={{ fontFamily: font.monoMedium, fontSize: 13, color: c.ink }}>{formatDuration(r)}</Text>
        </View>
      ))}
      {sp.notes ? <Text style={{ fontFamily: font.body, fontSize: 13, lineHeight: 19, color: c.ink2, backgroundColor: c.surface2, padding: 10, borderRadius: 8 }}>{sp.notes}</Text> : null}
    </View>
  )
}

function Spec({ label, value, big, mono, color }: { label: string; value: string; big?: boolean; mono?: boolean; color?: string }) {
  const { c } = useTheme()
  return (
    <View style={{ flex: 1, padding: 14, gap: 2 }}>
      <Text style={{ fontFamily: font.body, fontSize: 12, color: c.muted }}>{label}</Text>
      <Text style={{ fontFamily: mono ? font.monoSemi : font.bodySemi, fontSize: big ? 19 : 14.5, color: color ?? c.ink, letterSpacing: big ? -0.3 : 0 }}>{value}</Text>
    </View>
  )
}

function Note({ icon, text }: { icon: ReactNode; text: string }) {
  const { c } = useTheme()
  return (
    <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 10, backgroundColor: c.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: c.lineStrong, marginTop: 8 }}>
      <View style={{ marginTop: 2 }}>{icon}</View>
      <Text style={{ flex: 1, fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: c.ink2 }}>{text}</Text>
    </View>
  )
}

function DeleteDialog({ visible, code, name, onCancel, onConfirm }: { visible: boolean; code: string; name: string; onCancel: () => void; onConfirm: () => void }) {
  const { c } = useTheme()
  const [typed, setTyped] = useState('')
  const ok = typed.trim().toUpperCase() === code
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} onShow={() => setTyped('')}>
      <View style={styles.scrim}>
        <View style={[styles.dialog, { backgroundColor: c.surface, borderColor: c.line }]}>
          <View style={{ width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: c.dangerSoft }}>
            <Trash2 size={19} color={c.danger} />
          </View>
          <Text style={{ fontFamily: font.display, fontSize: 18, color: c.ink }}>Permanently delete {code}?</Text>
          <Text style={{ fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: c.ink2 }}>This removes “{name}” and its entire version history. This cannot be undone.</Text>
          <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: c.ink2, marginTop: 4 }}>
            Type <Text style={{ fontFamily: font.monoSemi }}>{code}</Text> to confirm
          </Text>
          <Input mono value={typed} onChangeText={setTyped} autoCapitalize="characters" autoCorrect={false} autoFocus />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
            <Button label="Cancel" variant="default" style={{ flex: 1 }} onPress={onCancel} />
            <Button label="Delete forever" variant="danger" style={{ flex: 1.4 }} disabled={!ok} onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  label: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingVertical: 14, paddingLeft: 22, paddingRight: 16, overflow: 'hidden' },
  labelTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 10, marginBottom: 12, borderBottomWidth: 1, borderStyle: 'dashed' },
  specRow: { flexDirection: 'row' },
  sample: { gap: 10, padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3 },
  stabRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  lightBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 8, borderRadius: 6 },
  listItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  listText: { flex: 1, fontFamily: font.body, fontSize: 14.5, lineHeight: 21 },
  scrim: { flex: 1, backgroundColor: 'rgba(8,11,16,0.55)', justifyContent: 'center', padding: 22 },
  dialog: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 10 }
})
