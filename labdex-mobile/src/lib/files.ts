// Saving and opening files on phones and in the browser. expo-file-system and the share sheet have no
// browser implementation, so on web a saved file is a normal download and a picked file is read directly.
import { Platform } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'

export type ShareOptions = { mimeType: string; dialogTitle: string; UTI?: string }

/** Phone: writes the file and opens the share sheet (save to Files/Drive, WhatsApp, email…). Web: downloads it. */
export async function saveTextFile(name: string, text: string, opts: ShareOptions): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: opts.mimeType }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    return
  }
  const file = new File(Paths.cache, name)
  if (file.exists) file.delete()
  file.create()
  await file.write(text)
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device')
  await Sharing.shareAsync(file.uri, opts)
}

/** Lets the person pick a file and returns its text, or null if they cancelled. */
export async function pickTextFile(types: string[]): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true })
  const asset = res.canceled ? null : res.assets[0]
  if (!asset) return null
  if (Platform.OS === 'web') return asset.file ? asset.file.text() : (await fetch(asset.uri)).text()
  return new File(asset.uri).text()
}
