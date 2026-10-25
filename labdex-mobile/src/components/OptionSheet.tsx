import type { ReactNode } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Check } from 'lucide-react-native'
import { font, useTheme } from '@/lib/theme'
import { tap } from './ui'

export interface SheetOption<T extends string> {
  v: T
  label: string
  icon?: ReactNode
}

/** Bottom sheet for picking one option (sort order, container filter…). */
export function OptionSheet<T extends string>({
  visible,
  title,
  value,
  options,
  onPick,
  onClose
}: {
  visible: boolean
  title: string
  value: T
  options: SheetOption<T>[]
  onPick: (v: T) => void
  onClose: () => void
}) {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.grabber, { backgroundColor: c.lineStrong }]} />
        <Text style={{ fontFamily: font.display, fontSize: 18, color: c.ink, paddingHorizontal: 20, marginBottom: 8 }}>{title}</Text>
        <ScrollView style={{ maxHeight: 420 }}>
          {options.map((o) => (
            <Pressable
              key={o.v}
              onPress={() => {
                tap()
                onPick(o.v)
                onClose()
              }}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surface3 }]}
            >
              {o.icon}
              <Text style={{ flex: 1, fontFamily: font.bodyMedium, fontSize: 15.5, color: c.ink }}>{o.label}</Text>
              {o.v === value && <Check size={18} color={c.accent} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,11,16,0.45)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14 }
})
