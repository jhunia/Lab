import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Plus } from 'lucide-react-native'
import type { Container, ContainerKind, Department } from '@shared/types'
import { errMsg, useData } from '@/lib/data'
import { font, useTheme } from '@/lib/theme'
import { Button, Card, Chip, Field, Input, SectionTitle } from '@/components/ui'
import { CapDot, TubeIcon } from '@/components/Visuals'
import { useRequireStaff } from '@/lib/identity'

const KINDS: ContainerKind[] = ['tube', 'cup', 'bottle', 'swab', 'jar', 'vial', 'slide', 'other']
const SWATCHES = ['#3C4A5C', '#7FB6E0', '#C8352E', '#D9A928', '#3E8E5A', '#9B7BC8', '#E58FB0', '#8A9099', '#E3C33A', '#2F5DA8', '#E07B2A', '#C9C2A8', '#F1F1EE', '#8FA3B8', '#111111', '#B8BEC6']
const DEP_SWATCHES = ['#C0392B', '#D08A10', '#0F8A7E', '#6D4AB0', '#C2457A', '#3A5BC7', '#8C5A3C', '#5B6472', '#2E8B57', '#B5651D']

type Editing = { kind: 'container'; item: Container } | { kind: 'department'; item: Department } | null

export default function Lookups() {
  const { c } = useTheme()
  const { containers, departments, tests, mutate } = useData()
  const requireStaff = useRequireStaff()
  const canEdit = true
  const [editing, setEditing] = useState<Editing>(null)

  const usedC = (id: string) => tests.filter((t) => t.specimens.some((s) => s.containerId === id)).length
  const usedD = (id: string) => tests.filter((t) => t.departmentId === id).length

  return (
    <>
      <Stack.Screen options={{ title: 'Containers & departments' }} />
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 24 }}>
        <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted }}>Tap a row to edit. Changes need a Senior to confirm.</Text>
        <View>
          <SectionTitle>Containers · order of draw</SectionTitle>
          <Card>
            {[...containers]
              .sort((a, b) => a.drawOrder - b.drawOrder)
              .map((k, i) => (
                <Pressable
                  key={k.id}
                  disabled={!canEdit}
                  onPress={() => setEditing({ kind: 'container', item: k })}
                  style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }, pressed && { backgroundColor: c.surface3 }]}
                >
                  <View style={{ width: 32, alignItems: 'center' }}>
                    <TubeIcon container={k} size={34} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: font.bodySemi, fontSize: 14.5, color: c.ink }}>{k.name}</Text>
                    <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.muted }}>
                      {k.additive} · {k.size}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: font.mono, fontSize: 12, color: c.muted }}>{k.drawOrder < 99 ? `#${k.drawOrder}` : '—'}</Text>
                  <Text style={{ fontFamily: font.mono, fontSize: 12, color: c.ink2, width: 24, textAlign: 'right' }}>{usedC(k.id)}</Text>
                </Pressable>
              ))}
          </Card>
          {canEdit && (
            <Button
              small
              icon={Plus}
              label="Add container"
              style={{ alignSelf: 'flex-start', marginTop: 10 }}
              onPress={() => setEditing({ kind: 'container', item: { id: '', name: '', capColor: '#B8BEC6', additive: '', size: '', kind: 'tube', drawOrder: 99 } })}
            />
          )}
        </View>

        <View>
          <SectionTitle>Departments</SectionTitle>
          <Card>
            {departments.map((dep, i) => (
              <Pressable
                key={dep.id}
                disabled={!canEdit}
                onPress={() => setEditing({ kind: 'department', item: dep })}
                style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }, pressed && { backgroundColor: c.surface3 }]}
              >
                <CapDot color={dep.color} size={13} />
                <Text style={{ flex: 1, fontFamily: font.bodySemi, fontSize: 14.5, color: c.ink }}>{dep.name}</Text>
                <Text style={{ fontFamily: font.mono, fontSize: 12, color: c.ink2 }}>{usedD(dep.id)}</Text>
              </Pressable>
            ))}
          </Card>
          {canEdit && <Button small icon={Plus} label="Add department" style={{ alignSelf: 'flex-start', marginTop: 10 }} onPress={() => setEditing({ kind: 'department', item: { id: '', name: '', color: '#5B6472' } })} />}
        </View>
      </ScrollView>

      {editing && (
        <EditSheet
          editing={editing}
          used={editing.kind === 'container' ? usedC(editing.item.id) : usedD(editing.item.id)}
          onClose={() => setEditing(null)}
          onSave={async (e) => {
            if (!(await requireStaff('SENIOR', 'change containers and departments'))) return
            try {
              mutate((x) => (e.kind === 'container' ? x.saveContainer(e.item) : x.saveDepartment(e.item)))
              setEditing(null)
            } catch (err) {
              Alert.alert('Could not save', errMsg(err))
            }
          }}
          onDelete={(e) =>
            Alert.alert(`Delete ${e.item.name}?`, 'This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  if (!(await requireStaff('SENIOR', `delete ${e.item.name}`))) return
                  try {
                    mutate((x) => (e.kind === 'container' ? x.deleteContainer(e.item.id) : x.deleteDepartment(e.item.id)))
                    setEditing(null)
                  } catch (err) {
                    Alert.alert('Could not delete', errMsg(err))
                  }
                }
              }
            ])
          }
        />
      )}
    </>
  )
}

function EditSheet({ editing, used, onClose, onSave, onDelete }: { editing: NonNullable<Editing>; used: number; onClose: () => void; onSave: (e: NonNullable<Editing>) => void; onDelete: (e: NonNullable<Editing>) => void }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const [e, setE] = useState(editing)
  const isNew = !editing.item.id
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(8,11,16,0.45)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>
            <Text style={{ fontFamily: font.display, fontSize: 19, color: c.ink, marginBottom: 14 }}>
              {isNew ? 'New' : 'Edit'} {e.kind}
            </Text>
            {e.kind === 'container' ? (
              <>
                <View style={{ alignItems: 'center', marginBottom: 12 }}>
                  <TubeIcon container={e.item} size={64} />
                </View>
                <Field label="Name">
                  <Input value={e.item.name} onChangeText={(v) => setE({ ...e, item: { ...e.item, name: v } })} placeholder="Lavender top" />
                </Field>
                <Field label="Cap colour">
                  <View style={styles.swatches}>
                    {SWATCHES.map((s) => (
                      <Pressable key={s} onPress={() => setE({ ...e, item: { ...e.item, capColor: s } })} style={[styles.swatch, { backgroundColor: s, borderColor: e.item.capColor === s ? c.accent : c.lineStrong, borderWidth: e.item.capColor === s ? 3 : 1 }]} />
                    ))}
                  </View>
                  <Input mono value={e.item.capColor} onChangeText={(v) => setE({ ...e, item: { ...e.item, capColor: v } })} autoCapitalize="characters" />
                </Field>
                <Field label="Additive">
                  <Input value={e.item.additive} onChangeText={(v) => setE({ ...e, item: { ...e.item, additive: v } })} placeholder="K2-EDTA" />
                </Field>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field label="Size">
                      <Input mono value={e.item.size} onChangeText={(v) => setE({ ...e, item: { ...e.item, size: v } })} placeholder="4 mL" />
                    </Field>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="Draw # (99 = n/a)">
                      <Input mono keyboardType="number-pad" value={String(e.item.drawOrder)} onChangeText={(v) => setE({ ...e, item: { ...e.item, drawOrder: Number(v) || 99 } })} />
                    </Field>
                  </View>
                </View>
                <Field label="Shape">
                  <View style={styles.swatches}>
                    {KINDS.map((k) => (
                      <Chip key={k} label={k} active={e.item.kind === k} onPress={() => setE({ ...e, item: { ...e.item, kind: k } })} />
                    ))}
                  </View>
                </Field>
              </>
            ) : (
              <>
                <Field label="Name">
                  <Input value={e.item.name} onChangeText={(v) => setE({ ...e, item: { ...e.item, name: v } })} placeholder="Haematology" />
                </Field>
                <Field label="Colour">
                  <View style={styles.swatches}>
                    {DEP_SWATCHES.map((s) => (
                      <Pressable key={s} onPress={() => setE({ ...e, item: { ...e.item, color: s } })} style={[styles.swatch, { backgroundColor: s, borderColor: e.item.color === s ? c.ink : 'transparent', borderWidth: 3 }]} />
                    ))}
                  </View>
                </Field>
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              {!isNew && <Button label={used ? `In use (${used})` : 'Delete'} variant="dangerGhost" disabled={used > 0} onPress={() => onDelete(e)} />}
              <View style={{ flex: 1 }} />
              <Button label="Cancel" onPress={onClose} />
              <Button label="Save" variant="primary" onPress={() => onSave(e)} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11 },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 34, height: 34, borderRadius: 9 }
})
