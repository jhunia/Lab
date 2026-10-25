import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as DocumentPicker from 'expo-document-picker'
import * as Haptics from 'expo-haptics'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'
import { CheckCircle2, ChevronRight, Cloud, CloudOff, Download, FileUp, Monitor, Moon, RefreshCcw, RefreshCw, Send, SlidersHorizontal, Sun, Upload, UsersRound } from 'lucide-react-native'
import { importCsv, toCsv } from '@shared/csv'
import { relTime } from '@shared/helpers'
import { errMsg, useData } from '@/lib/data'
import { useRequireStaff } from '@/lib/identity'
import { font, useTheme, type ThemePref } from '@/lib/theme'
import { Button, Card, Input, SectionTitle, Segmented } from '@/components/ui'
import { SessionChip } from '@/components/SessionChip'

export default function Settings() {
  const { c, pref, setPref } = useTheme()
  const insets = useSafeAreaInsets()
  const d = useData()
  const requireStaff = useRequireStaff()
  const { tests, staff, core, mutate, resetToSample, sync, update, checking, revision, cloud } = d
  const [feed, setFeed] = useState(sync.feedUrl)
  const [url, setUrl] = useState(sync.cloudUrl)
  const [key, setKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [publisher, setPublisher] = useState('')

  useEffect(() => setFeed(sync.feedUrl), [sync.feedUrl])
  useEffect(() => setUrl(sync.cloudUrl), [sync.cloudUrl])
  useEffect(() => {
    AsyncStorage.getItem('labdex.publisher')
      .then((v) => v && setPublisher(v))
      .catch(() => {})
  }, [])

  const ok = (title: string, body?: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    Alert.alert(title, body)
  }
  const fail = (title: string, e: unknown) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
    Alert.alert(title, errMsg(e))
  }

  const connect = async () => {
    setConnecting(true)
    try {
      const r = await d.setCloud({ url, anonKey: key })
      setKey('')
      ok('Connected to the cloud', r.staff ? `${r.staff} staff on the list.` : 'The staff list is empty — add yourself as the first Senior in Staff.')
    } catch (e) {
      fail('Could not connect', e)
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = () =>
    Alert.alert('Disconnect from the cloud?', 'This phone will stop sharing logs and receiving updates until you connect again. Nothing is deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: () => void d.setCloud(null) }
    ])

  const exportCsv = async () => {
    try {
      const file = new File(Paths.cache, `labdex-tests-${new Date().toISOString().slice(0, 10)}.csv`)
      if (file.exists) file.delete()
      file.create()
      await file.write(toCsv(core))
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export LabDex tests', UTI: 'public.comma-separated-values-text' })
    } catch (e) {
      fail('Export failed', e)
    }
  }

  const importFile = async () => {
    if (!(await requireStaff('SENIOR', 'import tests'))) return
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'], copyToCacheDirectory: true })
      if (res.canceled || !res.assets[0]) return
      const text = await new File(res.assets[0].uri).text()
      const r = mutate((x) => importCsv(x, text))
      ok(`Imported: ${r.added} added, ${r.updated} updated`, r.errors.length ? `${r.errors.length} row(s) skipped:\n\n${r.errors.slice(0, 5).join('\n')}` : 'All rows imported.')
    } catch (e) {
      fail('Import failed', e)
    }
  }

  const check = async () => {
    const r = await d.checkUpdate()
    if (r.error) Alert.alert('Could not check for updates', r.error)
    else if (!r.available) ok('Up to date', 'This phone already has the latest published tests.')
  }

  const syncNow = async () => {
    try {
      const r = await d.syncNow()
      ok('Directory updated', `${r.tests} tests · published ${new Date(r.revision).toLocaleString()}`)
    } catch (e) {
      fail('Sync failed', e)
    }
  }

  const publish = async () => {
    if (!(await requireStaff('SENIOR', 'publish test changes'))) return
    try {
      await AsyncStorage.setItem('labdex.publisher', publisher)
      const where = await d.publish(publisher)
      if (where === 'cloud') ok('Published', 'Every device will be told within a minute.')
    } catch (e) {
      fail('Could not publish', e)
    }
  }

  const reset = async () => {
    if (!(await requireStaff('SENIOR', 'reset the test directory'))) return
    Alert.alert('Replace all tests with the sample directory?', 'Every test on this phone will be replaced (the staff list and sample log are kept). Export a CSV first if you want to keep them.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetToSample }
    ])
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 40, gap: 24 }} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: font.display, fontSize: 27, letterSpacing: -0.5, color: c.ink }}>Settings</Text>
        <SessionChip />
      </View>

      <View>
        <SectionTitle>Cloud</SectionTitle>
        <Card style={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {cloud.connected ? <Cloud size={18} color={c.accent} /> : <CloudOff size={18} color={c.muted} />}
            <Text style={{ flex: 1, fontFamily: font.bodySemi, fontSize: 15, color: c.ink }}>{cloud.connected ? 'Connected' : 'Not connected'}</Text>
            {cloud.connected && cloud.lastSyncAt ? <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>synced {relTime(cloud.lastSyncAt)}</Text> : null}
          </View>
          {cloud.connected ? (
            <>
              <Text style={{ fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>
                Staff list, published tests and the sample log are shared through {sync.cloudUrl.replace('https://', '')}. Syncs every minute and when you open the app.
              </Text>
              {cloud.error ? (
                <Text style={{ fontFamily: font.body, fontSize: 13, color: c.danger }}>{cloud.error}</Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} color={c.accent} />
                  <Text style={{ fontFamily: font.bodySemi, fontSize: 13, color: c.accent }}>Working</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button small icon={RefreshCw} label="Sync now" style={{ flex: 1 }} onPress={() => void d.teamSync()} />
                <Button small variant="ghost" label="Disconnect" onPress={disconnect} />
              </View>
            </>
          ) : (
            <>
              <Text style={{ fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>
                Connect to share the staff list, sample log and test updates between all phones and PCs. Use the Project URL and the <Text style={{ fontFamily: font.bodySemi }}>anon / publishable</Text> key from Supabase → Project Settings → API (never the secret key).
              </Text>
              <Input value={url} onChangeText={setUrl} placeholder="https://abcd1234.supabase.co" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              <Input value={key} onChangeText={setKey} placeholder="anon / publishable key" autoCapitalize="none" autoCorrect={false} />
              <Button icon={Cloud} variant="primary" label={connecting ? 'Connecting…' : 'Connect'} disabled={connecting || !url.trim() || !key.trim()} onPress={connect} />
            </>
          )}
        </Card>
      </View>

      <View>
        <SectionTitle>Team</SectionTitle>
        <Card>
          <Row icon={<UsersRound size={17} color={c.ink2} />} label="Staff" detail={staff.length ? `${staff.filter((s) => s.active).length} active` : 'Set up'} onPress={() => router.push('/staff')} last />
        </Card>
      </View>

      <View>
        <SectionTitle>Test updates</SectionTitle>
        <Card style={{ padding: 14, gap: 12 }}>
          {cloud.connected ? (
            <Text style={{ fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>Published test changes arrive from the cloud automatically — you’ll get “Update available” and a notification.</Text>
          ) : (
            <>
              <Text style={{ fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>No cloud yet? Paste the share link of a published update file (OneDrive, Google Drive, Dropbox…).</Text>
              <Input value={feed} onChangeText={setFeed} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              <Button small label="Save link" disabled={feed.trim() === sync.feedUrl} onPress={() => void d.setFeedUrl(feed).then(check)} />
            </>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Button small icon={RefreshCw} label={checking ? 'Checking…' : 'Check now'} disabled={(!cloud.connected && !sync.feedUrl) || checking} onPress={check} />
            <Text style={{ flex: 1, fontFamily: font.mono, fontSize: 11, color: c.muted }}>
              {revision ? `Tests from ${new Date(revision).toLocaleString()}` : 'Local tests only'}
              {sync.lastCheckedAt ? ` · checked ${relTime(sync.lastCheckedAt)}` : ''}
            </Text>
          </View>
          {update?.error ? <Text style={{ fontFamily: font.body, fontSize: 13, color: c.danger }}>{update.error}</Text> : null}
          {update?.available && (
            <View style={[styles.callout, { backgroundColor: c.accentSoft, borderColor: c.accent }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: font.bodySemi, fontSize: 14, color: c.ink }}>New update from {update.publishedBy}</Text>
                <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.ink2 }}>{update.publishedAt ? `Published ${relTime(update.publishedAt)}` : ''}</Text>
              </View>
              <Button small variant="primary" icon={Download} label="Sync now" onPress={syncNow} />
            </View>
          )}
          {!cloud.connected && (
            <Button
              small
              variant="ghost"
              icon={FileUp}
              label="Open an update file…"
              onPress={() =>
                d
                  .openUpdateFile()
                  .then((r) => r && ok('Update applied', `${r.tests} tests`))
                  .catch((e) => fail('Could not open update', e))
              }
              style={{ alignSelf: 'flex-start', marginLeft: -12 }}
            />
          )}
        </Card>
      </View>

      <View>
        <SectionTitle>Publish test changes (Seniors)</SectionTitle>
        <Card style={{ padding: 14, gap: 10 }}>
          <Text style={{ fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>
            {cloud.connected ? 'After editing tests, publish so every device gets them.' : 'Creates an update file and opens the share menu — save it over the same file in your shared folder, or send it directly.'}
          </Text>
          <Input placeholder="Name shown to staff (optional)" value={publisher} onChangeText={setPublisher} />
          <Button icon={Send} variant="primary" label="Publish update" onPress={publish} />
        </Card>
      </View>

      <View>
        <SectionTitle>Appearance</SectionTitle>
        <Segmented<ThemePref>
          value={pref}
          onChange={setPref}
          options={[
            { v: 'light', label: 'Light', icon: Sun },
            { v: 'system', label: 'System', icon: Monitor },
            { v: 'dark', label: 'Dark', icon: Moon }
          ]}
        />
      </View>

      <View>
        <SectionTitle>Data</SectionTitle>
        <Card>
          <Row icon={<SlidersHorizontal size={17} color={c.ink2} />} label="Containers & departments" onPress={() => router.push('/lookups')} />
          <Row icon={<Upload size={17} color={c.ink2} />} label="Import CSV" onPress={importFile} />
          <Row icon={<Download size={17} color={c.ink2} />} label="Export CSV" onPress={exportCsv} />
          <Row icon={<RefreshCcw size={17} color={c.danger} />} label="Reset tests to sample data" danger onPress={reset} last />
        </Card>
      </View>

      <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted, textAlign: 'center' }}>LabDex mobile · {tests.length} tests</Text>
    </ScrollView>
  )
}

function Row({ icon, label, detail, onPress, danger, last }: { icon: ReactNode; label: string; detail?: string; onPress: () => void; danger?: boolean; last?: boolean }) {
  const { c } = useTheme()
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }, pressed && { backgroundColor: c.surface3 }]}>
      {icon}
      <Text style={{ flex: 1, fontFamily: font.bodySemi, fontSize: 15, color: danger ? c.danger : c.ink }}>{label}</Text>
      {detail ? <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted }}>{detail}</Text> : null}
      <ChevronRight size={17} color={c.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  callout: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 }
})
