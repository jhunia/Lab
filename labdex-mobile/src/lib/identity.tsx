import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { Delete, Search, ShieldCheck, X } from 'lucide-react-native'
import { ROLE_LABEL, hasRole, type StaffRole } from '@shared/staff'
import { errMsg, useData } from './data'
import { font, useTheme } from './theme'

const LAST_KEY = 'labdex.lastStaffId'

type RequireStaff = (minRole: StaffRole, reason: string, opts?: { allowProvisional?: boolean }) => Promise<boolean>

const Ctx = createContext<RequireStaff>(async () => false)

interface Ask {
  minRole: StaffRole
  reason: string
  allowProvisional: boolean
  resolve: (ok: boolean) => void
}

/**
 * `await requireStaff('SENIOR', 'edit tests')` → true when someone suitable is confirmed
 * (asking for name + PIN only if needed), false when cancelled.
 */
export function IdentityProvider({ children }: { children: ReactNode }) {
  const { allowedNow } = useData()
  const [ask, setAsk] = useState<Ask | null>(null)

  const requireStaff = useCallback<RequireStaff>(
    (minRole, reason, opts) => {
      if (allowedNow(minRole)) return Promise.resolve(true)
      return new Promise((resolve) => setAsk({ minRole, reason, allowProvisional: !!opts?.allowProvisional, resolve }))
    },
    [allowedNow]
  )

  return (
    <Ctx.Provider value={requireStaff}>
      {children}
      {ask && (
        <IdentitySheet
          ask={ask}
          onDone={(ok) => {
            ask.resolve(ok)
            setAsk(null)
          }}
        />
      )}
    </Ctx.Provider>
  )
}

export const useRequireStaff = () => useContext(Ctx)

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

function IdentitySheet({ ask, onDone }: { ask: Ask; onDone: (ok: boolean) => void }) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { staff, identify } = useData()
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<string | null>(null)
  const busyRef = useRef(false)

  useEffect(() => {
    AsyncStorage.getItem(LAST_KEY)
      .then((v) => {
        setLast(v)
        if (v && staff.some((s) => s.id === v && s.active && hasRole(s.role, ask.minRole))) setPicked(v)
      })
      .catch(() => {})
  }, [staff, ask.minRole])

  const eligible = staff
    .filter((s) => s.active && hasRole(s.role, ask.minRole))
    .sort((a, b) => (a.id === last ? -1 : b.id === last ? 1 : a.name.localeCompare(b.name)))
  const list = eligible.filter((s) => !q.trim() || `${s.name} ${s.staffNumber}`.toLowerCase().includes(q.trim().toLowerCase()))
  const person = eligible.find((s) => s.id === picked)

  const confirm = async (value = pin) => {
    if (!person || value.length < 4 || busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setErr('')
    try {
      await identify(person.id, value, ask.minRole, ask.allowProvisional)
      await AsyncStorage.setItem(LAST_KEY, person.id).catch(() => {})
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      onDone(true)
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
      setErr(errMsg(e))
      setPin('')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const press = (k: (typeof KEYS)[number]) => {
    if (!person || busy) return
    Haptics.selectionAsync().catch(() => {})
    setErr('')
    if (k === 'del') return setPin((p) => p.slice(0, -1))
    if (!k || pin.length >= 6) return
    setPin(pin + k)
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => onDone(false)}>
      <Pressable style={styles.scrim} onPress={() => onDone(false)} />
      <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 14 }]}>
        <View style={[styles.grabber, { backgroundColor: c.lineStrong }]} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
            <ShieldCheck size={18} color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.display, fontSize: 19, color: c.ink }}>Confirm it’s you</Text>
            <Text style={{ fontFamily: font.body, fontSize: 13, color: c.ink2 }}>
              To {ask.reason}
              {ask.minRole === 'SENIOR' ? ' (Seniors only)' : ''}
            </Text>
          </View>
          <Pressable onPress={() => onDone(false)} hitSlop={10} accessibilityLabel="Cancel">
            <X size={20} color={c.muted} />
          </Pressable>
        </View>

        {eligible.length === 0 ? (
          <Text style={{ fontFamily: font.body, color: c.danger, marginTop: 16 }}>Nobody on the staff list can do this yet. A Senior can add people in Settings → Staff.</Text>
        ) : (
          <>
            {eligible.length > 5 && (
              <View style={[styles.search, { borderColor: c.lineStrong, backgroundColor: c.surface2 }]}>
                <Search size={16} color={c.muted} />
                <TextInput value={q} onChangeText={setQ} placeholder="Find your name or staff number" placeholderTextColor={c.muted} style={{ flex: 1, fontFamily: font.body, fontSize: 15, color: c.ink, paddingVertical: 0 }} />
              </View>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              {list.map((s) => {
                const on = s.id === picked
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {})
                      setPicked(s.id)
                      setPin('')
                      setErr('')
                    }}
                    style={[styles.person, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accentSoft : c.surface2 }]}
                  >
                    <View style={[styles.avatar, { backgroundColor: on ? c.accent : c.ink }]}>
                      <Text style={{ fontFamily: font.display, color: on ? c.accentInk : c.bg, fontSize: 15 }}>{s.name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                    <Text numberOfLines={1} style={{ fontFamily: font.bodySemi, fontSize: 13.5, color: c.ink, maxWidth: 110 }}>
                      {s.name}
                    </Text>
                    <Text style={{ fontFamily: font.mono, fontSize: 10.5, color: c.muted }}>
                      {s.staffNumber} · {ROLE_LABEL[s.role]}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View style={styles.dots}>
              {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
                <View key={i} style={[styles.dot, { borderColor: person ? c.ink2 : c.lineStrong, backgroundColor: i < pin.length ? c.ink : 'transparent' }]} />
              ))}
            </View>
            <Text style={{ fontFamily: font.body, fontSize: 13, color: err ? c.danger : c.muted, textAlign: 'center', minHeight: 20 }}>
              {err || (person ? `PIN for ${person.name}` : 'Tap your name first')}
            </Text>

            <View style={styles.keypad}>
              {KEYS.map((k, i) => (
                <Pressable
                  key={i}
                  disabled={!k || !person}
                  onPress={() => press(k)}
                  style={({ pressed }) => [styles.key, { backgroundColor: k ? (pressed ? c.surface3 : c.surface2) : 'transparent', opacity: person ? 1 : 0.4 }]}
                  accessibilityLabel={k === 'del' ? 'Delete' : k}
                >
                  {k === 'del' ? <Delete size={22} color={c.ink2} /> : <Text style={{ fontFamily: font.display, fontSize: 24, color: c.ink }}>{k}</Text>}
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => confirm()}
              disabled={!person || pin.length < 4 || busy}
              style={[styles.confirm, { backgroundColor: c.accent, opacity: !person || pin.length < 4 || busy ? 0.4 : 1 }]}
            >
              {busy ? <ActivityIndicator color={c.accentInk} /> : <Text style={{ fontFamily: font.bodySemi, fontSize: 16, color: c.accentInk }}>Confirm</Text>}
            </Pressable>
            <Text style={{ fontFamily: font.body, fontSize: 12, color: c.muted, textAlign: 'center', marginTop: 8 }}>This phone remembers you for 5 minutes. Lock it from the top of the screen when you hand it over.</Text>
          </>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,11,16,0.5)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  icon: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, marginTop: 14 },
  person: { alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, minWidth: 104 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginVertical: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: 6 },
  key: { width: '31.5%', height: 54, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  confirm: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 12 }
})
