import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { ChevronRight, KeyRound, Phone, Plus, ShieldCheck } from 'lucide-react-native'
import { ROLE_HINT, ROLE_LABEL, pinError, type Staff, type StaffInput, type StaffRole } from '@shared/staff'
import { errMsg, useData } from '@/lib/data'
import { useRequireStaff } from '@/lib/identity'
import { font, useTheme, type Colors } from '@/lib/theme'
import { Button, Card, Field, Input, SectionTitle, Segmented } from '@/components/ui'
import { PinPrompt } from '@/components/PinPrompt'

const ROLES: StaffRole[] = ['TECH', 'SENIOR', 'VIEWER']

export const roleColors = (c: Colors, r: StaffRole) => (r === 'SENIOR' ? { fg: c.accent, bg: c.accentSoft } : r === 'TECH' ? c.storage.FRIDGE : { fg: c.ink2, bg: c.surface3 })

export default function StaffScreen() {
  const { c } = useTheme()
  const { staff, cloud, changeOwnPin } = useData()
  const requireStaff = useRequireStaff()
  const [editing, setEditing] = useState<{ input: StaffInput; isNew: boolean } | null>(null)
  const [pinFlow, setPinFlow] = useState<{ s: Staff; step: 'old' | 'new'; old?: string } | null>(null)
  const empty = staff.length === 0
  const sorted = [...staff].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

  const open = async (input: StaffInput, isNew: boolean) => {
    if (!empty && !(await requireStaff('SENIOR', isNew ? 'add staff' : 'edit staff details'))) return
    setEditing({ input, isNew })
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Staff' }} />
      <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 22 }}>
        {empty ? (
          <Card style={{ padding: 16, gap: 10, borderColor: c.accent, borderStyle: 'dashed', borderWidth: 1.5 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={18} color={c.accent} />
              <Text style={{ fontFamily: font.display, fontSize: 17, color: c.ink }}>Set up your lab</Text>
            </View>
            <Text style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: c.ink2 }}>
              Add yourself first — the first person becomes a <Text style={{ fontFamily: font.bodySemi }}>Senior</Text>. Seniors add the lab techs, edit tests and publish updates.
              {cloud.connected ? ' The list is kept in the cloud and shared with every device.' : ' Connect the cloud in Settings so every phone shares the same list.'}
            </Text>
            <Button variant="primary" icon={Plus} label="Add yourself as the first Senior" onPress={() => setEditing({ input: { staffNumber: '', name: '', phone: '', role: 'SENIOR', active: true }, isNew: true })} />
          </Card>
        ) : (
          <View>
            <SectionTitle>{`${staff.filter((s) => s.active).length} active staff`}</SectionTitle>
            <Card>
              {sorted.map((s, i) => {
                const rc = roleColors(c, s.role)
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => open({ id: s.id, staffNumber: s.staffNumber, name: s.name, phone: s.phone, role: s.role, active: s.active }, false)}
                    style={({ pressed }) => [styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }, pressed && { backgroundColor: c.surface3 }, !s.active && { opacity: 0.5 }]}
                  >
                    <View style={[styles.avatar, { backgroundColor: c.ink }]}>
                      <Text style={{ fontFamily: font.display, color: c.bg, fontSize: 15 }}>{s.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={{ fontFamily: font.bodySemi, fontSize: 15, color: c.ink, textDecorationLine: s.active ? 'none' : 'line-through' }}>{s.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontFamily: font.mono, fontSize: 11.5, color: c.muted }}>{s.staffNumber}</Text>
                        <View style={{ backgroundColor: rc.bg, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 }}>
                          <Text style={{ fontFamily: font.bodySemi, fontSize: 10.5, color: rc.fg }}>{ROLE_LABEL[s.role]}</Text>
                        </View>
                        {s.phone ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Phone size={11} color={c.muted} />
                            <Text style={{ fontFamily: font.body, fontSize: 11.5, color: c.muted }}>{s.phone}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <Pressable onPress={() => setPinFlow({ s, step: 'old' })} hitSlop={8} style={{ padding: 6 }} accessibilityLabel={`Change PIN for ${s.name}`}>
                      <KeyRound size={17} color={c.muted} />
                    </Pressable>
                    <ChevronRight size={17} color={c.muted} />
                  </Pressable>
                )
              })}
            </Card>
            <Button small icon={Plus} label="Add staff" style={{ alignSelf: 'flex-start', marginTop: 10 }} onPress={() => open({ staffNumber: '', name: '', phone: '', role: 'TECH', active: true }, true)} />
          </View>
        )}

        <View>
          <SectionTitle>Roles</SectionTitle>
          <Card style={{ padding: 14, gap: 10 }}>
            {ROLES.map((r) => {
              const rc = roleColors(c, r)
              return (
                <View key={r} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ backgroundColor: rc.bg, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 2, minWidth: 70, alignItems: 'center' }}>
                    <Text style={{ fontFamily: font.bodySemi, fontSize: 12, color: rc.fg }}>{ROLE_LABEL[r]}</Text>
                  </View>
                  <Text style={{ flex: 1, fontFamily: font.body, fontSize: 13, color: c.ink2 }}>{ROLE_HINT[r]}</Text>
                </View>
              )
            })}
          </Card>
          <Text style={{ fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: c.muted, marginTop: 8 }}>
            No accounts or emails: each person confirms with their staff number and a personal PIN. Tap the key icon to change your own PIN.
          </Text>
        </View>
      </ScrollView>

      {editing && <StaffSheet initial={editing.input} isNew={editing.isNew} first={empty} onClose={() => setEditing(null)} />}
      {pinFlow?.step === 'old' && (
        <PinPrompt title={`Change PIN — ${pinFlow.s.name}`} message="Enter your current PIN." onCancel={() => setPinFlow(null)} onSubmit={(old) => setPinFlow({ ...pinFlow, step: 'new', old })} />
      )}
      {pinFlow?.step === 'new' && (
        <PinPrompt
          title="New PIN"
          message="Choose a new 4–6 digit PIN."
          onCancel={() => setPinFlow(null)}
          onSubmit={async (pin) => {
            const s = pinFlow.s
            const old = pinFlow.old ?? ''
            setPinFlow(null)
            const pe = pinError(pin)
            if (pe) return Alert.alert('Not changed', pe)
            try {
              await changeOwnPin(s.id, old, pin)
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
              Alert.alert('PIN changed')
            } catch (e) {
              Alert.alert('Not changed', errMsg(e))
            }
          }}
        />
      )}
    </>
  )
}

function StaffSheet({ initial, isNew, first, onClose }: { initial: StaffInput; isNew: boolean; first: boolean; onClose: () => void }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { saveStaff, cloud } = useData()
  const [v, setV] = useState(initial)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (pin || isNew) {
      const pe = pinError(pin)
      if (pe) return Alert.alert('Check the PIN', pe)
      if (pin !== pin2) return Alert.alert('Check the PIN', 'The two PINs do not match')
    }
    setBusy(true)
    try {
      await saveStaff(v, pin || null)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      onClose()
    } catch (e) {
      Alert.alert('Could not save', errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(8,11,16,0.45)' }} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16 }]}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 600 }}>
            <Text style={{ fontFamily: font.display, fontSize: 19, color: c.ink, marginBottom: 14 }}>{first ? 'Add yourself (first Senior)' : isNew ? 'Add staff member' : `Edit ${initial.name}`}</Text>
            <Field label="Full name">
              <Input autoFocus={isNew} value={v.name} onChangeText={(name) => setV({ ...v, name })} placeholder="Ama Mensah" />
            </Field>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Staff number">
                  <Input mono autoCapitalize="characters" value={v.staffNumber} onChangeText={(n) => setV({ ...v, staffNumber: n.toUpperCase() })} placeholder="LT-014" />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Phone (optional)">
                  <Input keyboardType="phone-pad" value={v.phone} onChangeText={(phone) => setV({ ...v, phone })} placeholder="024…" />
                </Field>
              </View>
            </View>
            {!first && (
              <Field label="Role" hint={ROLE_HINT[v.role]}>
                <Segmented<StaffRole> value={v.role} onChange={(role) => setV({ ...v, role })} options={ROLES.map((r) => ({ v: r, label: ROLE_LABEL[r] }))} />
              </Field>
            )}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label={isNew ? 'PIN (4–6 digits)' : 'New PIN (optional)'}>
                  <Input mono secureTextEntry keyboardType="number-pad" maxLength={6} value={pin} onChangeText={(p) => setPin(p.replace(/\D/g, ''))} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Repeat PIN">
                  <Input mono secureTextEntry keyboardType="number-pad" maxLength={6} value={pin2} onChangeText={(p) => setPin2(p.replace(/\D/g, ''))} />
                </Field>
              </View>
            </View>
            {!isNew && (
              <View style={[styles.switchRow, { backgroundColor: c.surface2, borderColor: c.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bodySemi, fontSize: 15, color: c.ink }}>Active</Text>
                  <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.muted }}>Inactive staff can’t confirm, but their past entries keep their name.</Text>
                </View>
                <Switch value={v.active} onValueChange={(active) => setV({ ...v, active })} trackColor={{ true: c.accent, false: c.lineStrong }} thumbColor="#fff" />
              </View>
            )}
            <Text style={{ fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: c.muted, marginBottom: 12 }}>
              {cloud.connected ? 'PINs are stored scrambled in the cloud and never shown again.' : 'PINs are stored scrambled on this phone and never shown again.'} Tell the person their PIN privately.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button label="Cancel" style={{ flex: 1 }} onPress={onClose} />
              <Button label={busy ? 'Saving…' : 'Save'} variant="primary" style={{ flex: 1.4 }} disabled={busy} onPress={save} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 14 }
})
