import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Haptics from 'expo-haptics'
import { CheckCircle2, ChevronRight, KeyRound, ShieldCheck, Cloud, CloudOff, Download, FileUp, Monitor, Moon, RefreshCcw, RefreshCw, Send, SlidersHorizontal, Sun, Upload, UsersRound } from 'lucide-react-native'
import { importCsv, toCsv } from '@shared/csv'
import { relTime } from '@shared/helpers'
import { BUILT_IN_CLOUD } from '@shared/cloud-config'
import { errMsg, useData } from '@/lib/data'
import { pickTextFile, saveTextFile } from '@/lib/files'
import { useRequireStaff } from '@/lib/identity'
import { useSeniorMode } from '@/lib/senior'
import { font, useTheme, type ThemePref } from '@/lib/theme'
import { Button, Card, Input, SectionTitle, Segmented } from '@/components/ui'
import { SessionChip } from '@/components/SessionChip'

export default function Settings() {
  const { c, pref, setPref } = useTheme()
  const insets = useSafeAreaInsets()
  const d = useData()
  const requireStaff = useRequireStaff()
  const senior = useSeniorMode()
  const { tests, staff, core, mutate, resetToSample, sync, update, checking, revision, cloud } = d
  const [feed, setFeed] = useState(sync.feedUrl)
  const [url, setUrl] = useState(sync.cloudUrl)
  const [key, setKey] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [otherCloud, setOtherCloud] = useState(false)
  const onLabCloud = sync.cloudUrl === BUILT_IN_CLOUD.url
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

  const connected = (r: { staff: number }) =>
    ok('Connected to the lab cloud', r.staff ? `${r.staff} staff on the list. Logs and updates are shared again.` : 'The staff list is empty — add yourself as the first Senior in Staff.')

  // Anyone may reconnect: it only restores the lab's own project, nothing to type.
  const reconnect = async () => {
    setConnecting(true)
    try {
      connected(await d.reconnectLabCloud())
      setOtherCloud(false)
    } catch (e) {
      fail('Could not connect', e)
    } finally {
      setConnecting(false)
    }
  }

  // Pointing a phone at a different project is a Senior's job (it changes whose staff list and logs it sees).
  const connectOther = async () => {
    if (!(await requireStaff('SENIOR', 'connect to a different cloud'))) return
    setConnecting(true)
    try {
      connected(await d.setCloud({ url, anonKey: key }))
      setKey('')
      setOtherCloud(false)
    } catch (e) {
      fail('Could not connect', e)
    } finally {
      setConnecting(false)
    }
  }

  const pause = async () => {
    if (!(await requireStaff('SENIOR', 'pause the cloud on this phone'))) return
    Alert.alert('Pause the cloud on this phone?', 'This phone stops sharing sample logs and receiving test updates. Nothing is deleted — tap “Reconnect” any time to carry on.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Pause', style: 'destructive', onPress: () => void d.setCloud(null) }
    ])
  }

  const exportCsv = async () => {
    try {
      await saveTextFile(`labdex-tests-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(core), { mimeType: 'text/csv', dialogTitle: 'Export LabDex tests', UTI: 'public.comma-separated-values-text' })
    } catch (e) {
      fail('Export failed', e)
    }
  }

  const importFile = async () => {
    if (!(await requireStaff('SENIOR', 'import tests'))) return
    try {
      const text = await pickTextFile(['text/csv', 'text/comma-separated-values', 'text/plain', 'application/vnd.ms-excel'])
      if (text === null) return
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
            {cloud.connected ? <Cloud size={18} color={c.ink} /> : <CloudOff size={18} color={c.danger} />}
            <Text style={{ flex: 1, fontFamily: font.bodySemi, fontSize: 15, color: c.ink }}>
              {cloud.connected ? (onLabCloud ? 'Connected to the lab cloud' : 'Connected to another cloud') : 'Cloud is paused on this phone'}
            </Text>
            {cloud.connected && cloud.lastSyncAt ? <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>synced {relTime(cloud.lastSyncAt)}</Text> : null}
          </View>
          {cloud.connected ? (
            <>
              {cloud.error ? (
                <View style={{ gap: 3 }}>
                  <Text style={{ fontFamily: font.bodySemi, fontSize: 13.5, color: c.danger }}>Can’t reach the cloud right now</Text>
                  <Text style={{ fontFamily: font.body, fontSize: 13, lineHeight: 18, color: c.ink2 }}>
                    Keep working — entries are saved on this phone and upload by themselves when the connection is back.
                  </Text>
                  <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>{cloud.error}</Text>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={14} color={c.success} />
                  <Text style={{ fontFamily: font.body, fontSize: 13, color: c.ink2 }}>Staff, sample logs and test updates are shared. Syncs every minute.</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: font.bodySemi, fontSize: 14, color: c.ink }}>Sync automatically</Text>
                  <Text style={{ fontFamily: font.body, fontSize: 12.5, lineHeight: 17, color: c.muted }}>
                    {d.autoSync ? 'Entries upload as soon as you save and every minute.' : 'Entries stay on this phone until you tap Sync on the Register.'}
                  </Text>
                </View>
                <Switch value={d.autoSync} onValueChange={d.setAutoSync} trackColor={{ true: c.ink, false: c.lineStrong }} thumbColor={c.surface} accessibilityLabel="Sync automatically" />
              </View>
              <Button small icon={RefreshCw} label="Sync now" onPress={() => void d.teamSync().catch(() => {})} />
              {!onLabCloud && <Button small icon={Cloud} label={connecting ? 'Connecting…' : 'Switch back to the lab cloud'} disabled={connecting} onPress={reconnect} />}
              {senior.on && (
                <Pressable onPress={pause} hitSlop={8} style={{ alignSelf: 'center' }}>
                  <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.muted, textDecorationLine: 'underline' }}>Pause cloud on this phone</Text>
                </Pressable>
              )}
            </>
          ) : (
            <>
              <Text style={{ fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>
                This phone isn’t sharing with the team. Sample logs stay on this phone until you reconnect.
              </Text>
              <Button icon={Cloud} variant="primary" label={connecting ? 'Connecting…' : 'Reconnect to the lab cloud'} disabled={connecting} onPress={reconnect} />
            </>
          )}
          {senior.on && (
            <Pressable onPress={() => setOtherCloud((v) => !v)} hitSlop={8} style={{ alignSelf: 'center' }}>
              <Text style={{ fontFamily: font.body, fontSize: 12, color: c.muted }}>{otherCloud ? 'Hide' : 'Use a different cloud project…'}</Text>
            </Pressable>
          )}
          {senior.on && otherCloud && (
            <View style={{ gap: 8, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line }}>
              <Text style={{ fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: c.muted }}>
                Only for moving to a new Supabase project. Use its Project URL and anon key (Project Settings → API) — never the secret key.
              </Text>
              <Input value={url} onChangeText={setUrl} placeholder="https://abcd1234.supabase.co" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
              <Input value={key} onChangeText={setKey} placeholder="anon key" autoCapitalize="none" autoCorrect={false} />
              <Button small label={connecting ? 'Connecting…' : 'Connect'} disabled={connecting || !url.trim() || !key.trim()} onPress={connectOther} />
            </View>
          )}
        </Card>
      </View>

      {/* Techs only see test updates when there is one to take (or no cloud to bring them automatically). */}
      {(senior.on || update?.available || !cloud.connected) && (
        <View>
          <SectionTitle>Test updates</SectionTitle>
          <Card style={{ padding: 14, gap: 12 }}>
            {cloud.connected ? (
              <Text style={{ fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>Published test changes arrive from the cloud automatically — you’ll get “Update available” and a notification.</Text>
            ) : (
              senior.on && (
                <>
                  <Text style={{ fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>No cloud yet? Paste the share link of a published update file (OneDrive, Google Drive, Dropbox…).</Text>
                  <Input value={feed} onChangeText={setFeed} placeholder="https://…" autoCapitalize="none" autoCorrect={false} keyboardType="url" />
                  <Button small label="Save link" disabled={feed.trim() === sync.feedUrl} onPress={() => void d.setFeedUrl(feed).then(check)} />
                </>
              )
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
      )}

      {senior.on ? (
        <>
          <View>
            <SectionTitle>Team</SectionTitle>
            <Card>
              <Row icon={<UsersRound size={17} color={c.ink2} />} label="Staff" detail={staff.length ? `${staff.filter((s) => s.active).length} active` : 'Set up'} onPress={() => router.push('/staff')} last />
            </Card>
          </View>

          <View>
            <SectionTitle>Publish test changes</SectionTitle>
            <Card style={{ padding: 14, gap: 10 }}>
              <Text style={{ fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: c.ink2 }}>
                {cloud.connected
              ? 'Test edits (new tests, changed volumes, TATs…) stay on this phone until you publish. Publishing sends the whole directory to the cloud; every phone gets “Update available” and switches to it with one tap. Sample logs and the staff list are not affected.'
              : 'Test edits stay on this phone until you publish. Without the cloud, publishing makes an update file to share (WhatsApp, Drive, email); others open it in Settings → Test updates.'}
              </Text>
              <Input placeholder="Name shown to staff (optional)" value={publisher} onChangeText={setPublisher} />
              <Button icon={Send} variant="primary" label="Publish update" onPress={publish} />
            </Card>
          </View>

          <View>
            <SectionTitle>Data</SectionTitle>
            <Card>
              <Row icon={<SlidersHorizontal size={17} color={c.ink2} />} label="Containers & departments" hint="Tube colours, order of draw and departments used on test cards." onPress={() => router.push('/lookups')} />
              <Row icon={<Download size={17} color={c.ink2} />} label="Export CSV" hint="Saves every test as a spreadsheet (Excel / Google Sheets) — a backup, or to edit many tests at once." onPress={exportCsv} />
              <Row icon={<Upload size={17} color={c.ink2} />} label="Import CSV" hint="Reads that spreadsheet back: an existing code updates that test, a new code adds a test. Nothing is deleted. Publish afterwards so other phones get it." onPress={importFile} />
              <Row icon={<RefreshCcw size={17} color={c.danger} />} label="Reset tests to sample data" hint="Replaces every test on this phone with the built-in examples (staff and sample logs are kept). For training or starting over — export a CSV first." danger onPress={reset} last />
            </Card>
          </View>
        </>
      ) : (
        <View>
          <SectionTitle>You</SectionTitle>
          <Card>
            <Row icon={<KeyRound size={17} color={c.ink2} />} label="Change my PIN" onPress={() => router.push('/staff')} last />
          </Card>
        </View>
      )}

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

      {!senior.on && (
        <Pressable
          onPress={() => void senior.unlock()}
          style={({ pressed }) => [styles.gate, { borderColor: c.lineStrong }, pressed && { backgroundColor: c.surface3 }]}
          accessibilityRole="button"
        >
          <ShieldCheck size={18} color={c.ink2} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bodySemi, fontSize: 14.5, color: c.ink }}>Senior tools</Text>
            <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.muted }}>Edit tests, manage staff, publish updates</Text>
          </View>
          <ChevronRight size={17} color={c.muted} />
        </Pressable>
      )}

      <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted, textAlign: 'center' }}>LabDex mobile · {tests.length} tests</Text>
    </ScrollView>
  )
}

function Row({ icon, label, detail, hint, onPress, danger, last }: { icon: ReactNode; label: string; detail?: string; hint?: string; onPress: () => void; danger?: boolean; last?: boolean }) {
  const { c } = useTheme()
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }, pressed && { backgroundColor: c.surface3 }]}>
      {icon}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.bodySemi, fontSize: 15, color: danger ? c.danger : c.ink }}>{label}</Text>
        {hint ? <Text style={{ fontFamily: font.body, fontSize: 12.5, lineHeight: 17, color: c.muted }}>{hint}</Text> : null}
      </View>
      {detail ? <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted }}>{detail}</Text> : null}
      <ChevronRight size={17} color={c.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  callout: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  gate: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1, borderStyle: 'dashed', borderRadius: 4 }
})
