import { useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, View } from 'react-native'
import { font, useTheme } from '@/lib/theme'
import { Button, Input } from './ui'

/** Small "enter your PIN" dialog (re-confirming an upload, changing a PIN…). */
export function PinPrompt({ title, message, onSubmit, onCancel }: { title: string; message: string; onSubmit: (pin: string) => void; onCancel: () => void }) {
  const { c } = useTheme()
  const [pin, setPin] = useState('')
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.scrim} behavior="padding">
        <View style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={{ fontFamily: font.display, fontSize: 18, color: c.ink }}>{title}</Text>
          <Text style={{ fontFamily: font.body, fontSize: 14, lineHeight: 20, color: c.ink2 }}>{message}</Text>
          <Input
            mono
            autoFocus
            secureTextEntry
            keyboardType="number-pad"
            maxLength={6}
            value={pin}
            onChangeText={(v) => setPin(v.replace(/\D/g, ''))}
            onSubmitEditing={() => pin.length >= 4 && onSubmit(pin)}
            style={{ textAlign: 'center', fontSize: 22, letterSpacing: 8 }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button label="Cancel" style={{ flex: 1 }} onPress={onCancel} />
            <Button label="Confirm" variant="primary" style={{ flex: 1 }} disabled={pin.length < 4} onPress={() => onSubmit(pin)} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,11,16,0.55)', justifyContent: 'center', padding: 22 },
  box: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 12 }
})
