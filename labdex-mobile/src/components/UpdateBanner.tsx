import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { RefreshCw, X } from 'lucide-react-native'
import { relTime } from '@shared/helpers'
import { errMsg, useData } from '@/lib/data'
import { font, useTheme } from '@/lib/theme'
import { Button } from './ui'

/** "Update available — Sync now", shown on the main screens when a newer update is published. */
export function UpdateBanner() {
  const { c } = useTheme()
  const { update, syncNow, dismissUpdate } = useData()
  if (!update?.available) return null

  const sync = async () => {
    try {
      const r = await syncNow()
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
      Alert.alert('Directory updated', `${r.tests} tests · published ${new Date(r.revision).toLocaleString()}`)
    } catch (e) {
      Alert.alert('Sync failed', errMsg(e))
    }
  }

  return (
    <View style={[styles.banner, { backgroundColor: c.accentSoft, borderColor: c.accent }]}>
      <RefreshCw size={17} color={c.accent} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.bodySemi, fontSize: 14.5, color: c.ink }}>Update available</Text>
        <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.ink2 }}>
          {update.publishedBy}
          {update.publishedAt ? ` · ${relTime(update.publishedAt)}` : ''}
        </Text>
      </View>
      <Button small variant="primary" label="Sync now" onPress={sync} />
      <Pressable onPress={dismissUpdate} hitSlop={10} accessibilityLabel="Later">
        <X size={17} color={c.muted} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 }
})
