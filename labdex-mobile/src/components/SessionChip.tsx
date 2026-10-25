import { Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Lock } from 'lucide-react-native'
import { ROLE_LABEL } from '@shared/staff'
import { useData } from '@/lib/data'
import { font, useTheme } from '@/lib/theme'

/** "Ama · Lab tech  🔒" — who is confirmed on this phone; tap the lock to hand the phone over. */
export function SessionChip() {
  const { c } = useTheme()
  const { session, lock, staff } = useData()
  if (!session) {
    if (staff.length === 0) return null
    return (
      <View style={[styles.chip, { backgroundColor: c.surface3 }]}>
        <Lock size={12} color={c.muted} />
        <Text style={{ fontFamily: font.bodySemi, fontSize: 11.5, color: c.muted }}>Locked</Text>
      </View>
    )
  }
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {})
        lock()
      }}
      style={[styles.chip, { backgroundColor: c.accentSoft, borderColor: c.accent, borderWidth: StyleSheet.hairlineWidth }]}
      accessibilityLabel={`${session.name} is confirmed. Tap to lock.`}
    >
      <View style={[styles.avatar, { backgroundColor: c.accent }]}>
        <Text style={{ fontFamily: font.display, fontSize: 10, color: c.accentInk }}>{session.name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <Text numberOfLines={1} style={{ fontFamily: font.bodySemi, fontSize: 11.5, color: c.ink, maxWidth: 110 }}>
        {session.name.split(' ')[0]} · {ROLE_LABEL[session.role]}
      </Text>
      <Lock size={12} color={c.ink2} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 26, paddingHorizontal: 8, borderRadius: 13 },
  avatar: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }
})
