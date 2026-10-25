import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Stack, router } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { Keyboard, X } from 'lucide-react-native'
import { useData } from '@/lib/data'
import { font, useTheme } from '@/lib/theme'
import { Button } from '@/components/ui'

/** Scan the lab-number barcode on a request form. Opens the sample if it's already logged. */
export default function ScanLabNumber() {
  const { c } = useTheme()
  const { logs } = useData()
  const [perm, requestPerm] = useCameraPermissions()
  const [torch, setTorch] = useState(false)
  const done = useRef(false)

  const onScan = (data: string) => {
    if (done.current) return
    const lab = data.trim().toUpperCase()
    if (!lab) return
    done.current = true
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    const open = logs.find((v) => v.open && v.log.labNumber.toUpperCase() === lab)
    if (open) router.replace(`/log/${open.log.id}`)
    else router.replace({ pathname: '/log/new', params: { lab } })
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {perm?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ['code128', 'code39', 'code93', 'qr', 'datamatrix', 'ean13', 'ean8', 'codabar', 'itf14', 'pdf417'] }}
            onBarcodeScanned={({ data }) => onScan(data)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: 30, gap: 14, backgroundColor: c.bg }]}>
            <Text style={{ fontFamily: font.display, fontSize: 26, color: c.ink, textAlign: 'center' }}>Scan lab numbers</Text>
            <Text style={{ fontFamily: font.body, fontSize: 14.5, lineHeight: 21, color: c.ink2, textAlign: 'center' }}>
              Allow the camera to read the barcode on request forms. Nothing is photographed or stored — only the lab number.
            </Text>
            {perm && !perm.canAskAgain ? (
              <Text style={{ fontFamily: font.body, fontSize: 13, color: c.danger, textAlign: 'center' }}>Camera access is off. Turn it on for LabDex in your phone’s settings.</Text>
            ) : (
              <Button variant="primary" label="Allow camera" onPress={() => void requestPerm()} />
            )}
            <Button variant="ghost" icon={Keyboard} label="Type it instead" onPress={() => router.replace('/log/new')} />
          </View>
        )}

        {perm?.granted && (
          <>
            <View pointerEvents="none" style={styles.frameWrap}>
              <View style={styles.frame}>
                {['tl', 'tr', 'bl', 'br'].map((k) => (
                  <View key={k} style={[styles.corner, k.includes('t') ? { top: -2 } : { bottom: -2 }, k.includes('l') ? { left: -2 } : { right: -2 }, cornerBorders(k)]} />
                ))}
              </View>
              <Text style={styles.hint}>Point at the lab-number barcode</Text>
            </View>
            <View style={styles.bottom}>
              <Pressable onPress={() => setTorch((t) => !t)} style={[styles.pill, torch && { backgroundColor: '#F4F1E8' }]}>
                <Text style={{ fontFamily: font.displaySemi, fontSize: 15, letterSpacing: 1, color: torch ? '#1B1A17' : '#F4F1E8' }}>{torch ? 'LIGHT ON' : 'LIGHT'}</Text>
              </Pressable>
              <Pressable onPress={() => router.replace('/log/new')} style={styles.pill}>
                <Keyboard size={16} color="#F4F1E8" />
                <Text style={{ fontFamily: font.displaySemi, fontSize: 15, letterSpacing: 1, color: '#F4F1E8' }}>TYPE IT</Text>
              </Pressable>
            </View>
          </>
        )}

        <Pressable onPress={() => router.back()} style={styles.close} accessibilityLabel="Close scanner" hitSlop={10}>
          <X size={22} color={perm?.granted ? '#F4F1E8' : c.ink} />
        </Pressable>
      </View>
    </>
  )
}

const cornerBorders = (k: string) => ({
  borderTopWidth: k.includes('t') ? 4 : 0,
  borderBottomWidth: k.includes('b') ? 4 : 0,
  borderLeftWidth: k.includes('l') ? 4 : 0,
  borderRightWidth: k.includes('r') ? 4 : 0
})

const styles = StyleSheet.create({
  frameWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 18 },
  frame: { width: '78%', height: 150, borderWidth: 1, borderColor: 'rgba(244,241,232,0.35)' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#F4F1E8' },
  hint: { fontFamily: font.displaySemi, fontSize: 17, letterSpacing: 1, color: '#F4F1E8' },
  bottom: { position: 'absolute', bottom: 48, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 12 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1.5, borderColor: '#F4F1E8' },
  close: { position: 'absolute', top: 56, right: 20, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }
})
