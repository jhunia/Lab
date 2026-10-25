import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { AlertTriangle, Barcode, RefreshCw, Copy, CloudAlert, Clock, CloudCheck, CloudOff, CloudUpload, KeyRound, Lock, NotebookPen, Plus, Search, X } from 'lucide-react-native'
import { sampleAlerts, type LogView, type SampleAlert } from '@shared/logs'
import type { LabTest } from '@shared/types'
import { relTime } from '@shared/helpers'
import { useData } from '@/lib/data'
import { useRequireStaff } from '@/lib/identity'
import { font, useTheme } from '@/lib/theme'
import { tap } from '@/components/ui'
import { TubeIcon } from '@/components/Visuals'
import { MarginCell, NoteSlip, ProgressTrack, SectionRule, Stamp, SummaryStrip, elapsedSince, hhmm, initials, shiftLabel } from '@/components/Logbook'
import { PinPrompt } from '@/components/PinPrompt'

type Filter = 'open' | 'today' | 'all'

interface Entry {
  v: LogView
  tests: LabTest[]
  alerts: SampleAlert[]
  late: boolean
  soon: boolean
  deadline: number
}

const CLOSED_WINDOW_MS = 12 * 3600 * 1000

export default function Register() {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { logs, tests, con, cloud, waitingUpload, needsPin, uploadProblems, reconfirmUpload, staff, session, lock, teamSync, autoSync } = useData()
  const requireStaff = useRequireStaff()
  const [filter, setFilter] = useState<Filter>('open')
  const [searching, setSearching] = useState(false)
  const [q, setQ] = useState('')
  const [reconfirm, setReconfirm] = useState<(typeof needsPin)[number] | null>(null)
  const [, tick] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncNote, setSyncNote] = useState<{ text: string; bad: boolean } | null>(null)

  // Keep elapsed times and deadlines current.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  const byId = useMemo(() => new Map(tests.map((t) => [t.id, t])), [tests])
  const now = Date.now()
  const today = new Date().toDateString()

  const entries: Entry[] = logs.map((v) => {
    const ts = v.log.testIds.map((id) => byId.get(id)).filter((t): t is LabTest => !!t)
    const alerts = v.open && v.first ? sampleAlerts(v.first.at, ts) : []
    return {
      v,
      tests: ts,
      alerts,
      late: alerts.some((a) => a.level === 'late'),
      soon: !alerts.some((a) => a.level === 'late') && alerts.some((a) => a.level === 'soon'),
      deadline: Math.min(...alerts.map((a) => a.due.getTime()), Number.MAX_SAFE_INTEGER)
    }
  })

  const matches = (e: Entry) => !q.trim() || `${e.v.log.labNumber} ${e.v.log.testCodes.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())
  const inFilter = (e: Entry) =>
    filter === 'all' ? true : filter === 'today' ? new Date(e.v.last?.at ?? e.v.log.createdAt).toDateString() === today : e.v.open || now - new Date(e.v.last?.at ?? 0).getTime() < CLOSED_WINDOW_MS
  const shown = entries.filter((e) => matches(e) && inFilter(e))
  const actNow = shown.filter((e) => e.v.open && e.late).sort((a, b) => a.deadline - b.deadline)
  const inLab = shown.filter((e) => e.v.open && !e.late).sort((a, b) => a.deadline - b.deadline)
  const closed = shown.filter((e) => !e.v.open)

  const open = entries.filter((e) => e.v.open)
  // Two phones offline can each log the same sample; flag it so someone checks.
  const openPerLab = new Map<string, number>()
  for (const e of open) openPerLab.set(e.v.log.labNumber.toUpperCase(), (openPerLab.get(e.v.log.labNumber.toUpperCase()) ?? 0) + 1)
  // One warning per person, not per entry; re-confirming once covers all of their entries.
  const byPerson = <T extends { staffNumber: string }>(xs: T[]) => [...new Map(xs.map((x) => [x.staffNumber, { ...x, count: xs.filter((y) => y.staffNumber === x.staffNumber).length }])).values()]
  const pinGroups = byPerson(needsPin)
  const problemGroups = byPerson(uploadProblems)
  const counts = { overdue: open.filter((e) => e.late).length, soon: open.filter((e) => e.soon).length, waiting: open.filter((e) => !e.late && !e.soon).length }
  const waiting = waitingUpload - needsPin.length - uploadProblems.length

  const needsSetup = staff.length === 0 && !cloud.connected

  // Entries sync by themselves (unless this phone turned auto-sync off); Sync sends them right now.
  const syncNow = async () => {
    tap()
    setSyncing(true)
    setSyncNote(null)
    try {
      const r = await teamSync()
      if (r?.offline) setSyncNote({ text: 'Couldn’t reach the cloud — your entries are safe on this phone. Try again later.', bad: true })
      else if (r) {
        const parts = [r.sent ? `sent ${r.sent}` : '', r.received ? `received ${r.received}` : ''].filter(Boolean)
        setSyncNote({ text: parts.length ? `Synced — ${parts.join(', ')}.` : 'Synced — nothing new.', bad: r.needsPin + r.failed > 0 })
      }
    } catch {
      setSyncNote({ text: 'Couldn’t reach the cloud — your entries are safe on this phone. Try again later.', bad: true })
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncNote(null), 6000)
    }
  }
  const begin = async (path: '/log/new' | '/log/scan') => {
    if (needsSetup) {
      Alert.alert('Set up the staff list first', 'Add yourself as the first Senior in Settings → Staff, then add the lab techs.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Open Staff', onPress: () => router.push('/staff') }
      ])
      return
    }
    if (await requireStaff('TECH', 'log a sample', { allowProvisional: true })) router.push(path)
  }

  const row = (e: Entry) => {
    const v = e.v
    const firstReq = (t: LabTest) => t.specimens.find((s) => s.role === 'REQUIRED') ?? t.specimens[0]
    const testLabel = e.tests.length === 1 ? e.tests[0].name : v.log.testCodes.map((code) => code.replace(/^[A-Z]+-/, '')).join(' · ')
    const stability = e.alerts.find((a) => a.kind === 'stability')
    const tat = e.alerts.find((a) => a.kind === 'tat')
    const lastNote = v.events
      .slice()
      .reverse()
      .find((x) => x.note)
    return (
      <Pressable
        key={v.log.id}
        onPress={() => {
          tap()
          router.push(`/log/${v.log.id}`)
        }}
        style={({ pressed }) => [styles.row, { borderBottomColor: c.line, backgroundColor: e.late ? c.dangerSoft : 'transparent' }, pressed && { backgroundColor: c.surface3 }]}
      >
        <MarginCell time={hhmm(v.log.createdAt)} elapsed={elapsedSince(v.first?.at ?? v.log.createdAt, now)} initials={initials(v.last?.staffName ?? v.log.createdByName)} />
        <View style={styles.body}>
          <View style={styles.top}>
            <Text style={[styles.lab, { color: c.ink }]}>{v.log.labNumber}</Text>
            <Stamp status={v.status} />
          </View>
          <View style={styles.tests}>
            {e.tests.slice(0, 3).map((t) => (
              <TubeIcon key={t.id} container={con(firstReq(t)?.containerId ?? '')} size={20} />
            ))}
            <Text numberOfLines={1} style={{ flex: 1, fontFamily: font.body, fontSize: 13.5, color: c.ink2 }}>
              {testLabel}
              {e.tests.length === 1 ? <Text style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>{`  ${v.log.testCodes[0]}`}</Text> : null}
            </Text>
            {v.pendingUploads > 0 && <CloudUpload size={13} color={c.muted} />}
          </View>
          {v.open && (openPerLab.get(v.log.labNumber.toUpperCase()) ?? 0) > 1 ? (
            <View style={[styles.chip, { backgroundColor: c.warnBg }]}>
              <Copy size={12} color={c.warnInk} />
              <Text style={{ fontFamily: font.bodyMedium, fontSize: 12, color: c.warnInk }}>Logged twice — check both entries and close one</Text>
            </View>
          ) : null}
          {e.late ? (
            <View style={[styles.banner, { backgroundColor: c.danger }]}>
              <AlertTriangle size={14} color="#fff" />
              <Text style={{ flex: 1, fontFamily: font.bodyMedium, fontSize: 12.5, color: '#fff' }}>
                {stability?.level === 'late' ? `${stability.text.replace(/\s*\(.*\)$/, '')} — process or reject now` : `${tat?.text ?? 'Overdue'}`}
              </Text>
            </View>
          ) : e.soon && (tat?.level === 'soon' || stability?.level === 'soon') ? (
            <View style={[styles.chip, { backgroundColor: c.warnBg }]}>
              <Clock size={13} color={c.warnInk} />
              <Text style={{ fontFamily: font.bodyMedium, fontSize: 12, color: c.warnInk }}>{(stability?.level === 'soon' ? stability : tat)!.text.replace(/\s*\(.*\)$/, '')}</Text>
            </View>
          ) : null}
          {lastNote && v.status !== 'RECEIVED' ? <NoteSlip by={initials(lastNote.staffName)} at={hhmm(lastNote.at)} text={lastNote.note} /> : null}
          <ProgressTrack status={v.status} />
        </View>
      </Pressable>
    )
  }

  const closedRow = (e: Entry) => {
    const v = e.v
    const rejected = v.status === 'REJECTED'
    return (
      <Pressable
        key={v.log.id}
        onPress={() => router.push(`/log/${v.log.id}`)}
        style={({ pressed }) => [styles.row, { borderBottomColor: c.line, backgroundColor: pressed ? c.surface3 : c.surface2 }]}
      >
        <MarginCell time={hhmm(v.last?.at ?? v.log.createdAt)} initials={initials(v.last?.staffName ?? '')} />
        <View style={[styles.body, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.lab, { fontSize: 19, color: c.muted, textDecorationLine: rejected ? 'line-through' : 'none', textDecorationColor: c.danger }]}>{v.log.labNumber}</Text>
            <Text numberOfLines={1} style={{ fontFamily: font.body, fontSize: 12.5, color: rejected ? c.danger : c.muted }}>
              {v.log.testCodes.map((code) => code.replace(/^[A-Z]+-/, '')).join(' · ')}
              {v.last?.note ? ` · ${v.last.note}` : ''}
            </Text>
          </View>
          <Stamp status={v.status} size="sm" />
        </View>
      </Pressable>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 170 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 16 }}>
          <View style={styles.headRow}>
            <Text style={{ fontFamily: font.body, fontSize: 12.5, color: c.muted }}>{shiftLabel()}</Text>
            {session ? (
              <Pressable onPress={lock} style={[styles.who, { backgroundColor: c.ink }]} accessibilityLabel={`${session.name} confirmed. Tap to lock.`}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#7FD1A8' }} />
                <Text style={{ fontFamily: font.bodyMedium, fontSize: 11.5, color: c.bg }}>
                  {session.name.split(' ')[0]} · {session.staffNumber}
                </Text>
                <Lock size={11} color={c.bg} />
              </Pressable>
            ) : staff.length ? (
              <View style={[styles.who, { borderWidth: 1, borderColor: c.lineStrong }]}>
                <Lock size={11} color={c.muted} />
                <Text style={{ fontFamily: font.bodyMedium, fontSize: 11.5, color: c.muted }}>Locked</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ fontFamily: font.display, fontSize: 36, lineHeight: 38, color: c.ink, marginTop: 8 }}>Specimen register</Text>
          <View style={{ marginTop: 12 }}>
            <SummaryStrip overdue={counts.overdue} soon={counts.soon} waiting={counts.waiting} />
          </View>

          <View style={[styles.tabs, { borderBottomColor: c.ink }]}>
            {(['open', 'today', 'all'] as Filter[]).map((f) => (
              <Pressable
                key={f}
                onPress={() => {
                  tap()
                  setFilter(f)
                }}
                style={[styles.tab, filter === f && { borderBottomColor: c.ink }]}
              >
                <Text style={{ fontFamily: filter === f ? font.bodySemi : font.body, fontSize: 14, color: filter === f ? c.ink : c.muted }}>
                  {f === 'open' ? `Open ${String(open.length).padStart(2, '0')}` : f === 'today' ? 'Today' : 'All'}
                </Text>
              </Pressable>
            ))}
            <Pressable onPress={() => (setSearching(!searching), setQ(''))} style={[styles.tab, { marginLeft: 'auto', flexDirection: 'row', gap: 5, alignItems: 'center' }]} accessibilityLabel="Search lab number">
              {searching ? <X size={15} color={c.muted} /> : <Search size={15} color={c.muted} />}
              <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted }}>Lab no.</Text>
            </Pressable>
          </View>
          {searching && (
            <View style={[styles.search, { borderColor: c.ink, backgroundColor: c.surface }]}>
              <TextInput
                autoFocus
                value={q}
                onChangeText={setQ}
                placeholder="L-2026-…"
                placeholderTextColor={c.muted}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ flex: 1, fontFamily: font.mono, fontSize: 15, color: c.ink, paddingVertical: 0 }}
              />
            </View>
          )}
        </View>

        {pinGroups.map((n) => (
          <Pressable key={n.staffNumber} onPress={() => setReconfirm(n)} style={[styles.strip, { backgroundColor: c.warnBg }]}>
            <KeyRound size={15} color={c.warnInk} />
            <Text style={{ flex: 1, fontFamily: font.body, fontSize: 12.5, color: c.warnInk }}>
              {n.count > 1 ? `${n.staffName}’s ${n.count} entries weren’t accepted (wrong PIN).` : (
                <>
                  {n.staffName}’s entry for <Text style={{ fontFamily: font.monoSemi }}>{n.labNumber}</Text> wasn’t accepted (wrong PIN).
                </>
              )}{' '}
              <Text style={{ fontFamily: font.bodySemi }}>Tap to re-enter the PIN.</Text>
            </Text>
          </Pressable>
        ))}
        {problemGroups.map((n) => (
          <View key={n.staffNumber} style={[styles.strip, { backgroundColor: c.dangerSoft }]}>
            <CloudAlert size={15} color={c.danger} />
            <Text style={{ flex: 1, fontFamily: font.body, fontSize: 12.5, color: c.ink }}>
              {n.count > 1 ? `${n.count} entries by ${n.staffName}` : `${n.staffName}’s entry for ${n.labNumber}`} can’t upload: {n.error}.{' '}
              {/unknown|inactive/i.test(n.error) ? 'A Senior can re-activate them in Settings → Staff.' : 'It will retry by itself.'}
            </Text>
          </View>
        ))}

        {actNow.length > 0 && (
          <>
            <SectionRule color={c.danger}>ACTION NOW</SectionRule>
            {actNow.map(row)}
          </>
        )}
        {inLab.length > 0 && (
          <>
            <SectionRule>IN PROGRESS</SectionRule>
            {inLab.map(row)}
          </>
        )}
        {closed.length > 0 && (
          <>
            <SectionRule>{filter === 'open' ? 'CLOSED THIS SHIFT' : 'CLOSED'}</SectionRule>
            {closed.map(closedRow)}
          </>
        )}
        {shown.length === 0 && (
          <View style={styles.empty}>
            <NotebookPen size={34} color={c.muted} strokeWidth={1.4} />
            <Text style={{ fontFamily: font.display, fontSize: 22, color: c.ink }}>{q ? `No entry for “${q}”` : 'The page is clear'}</Text>
            <Text style={{ fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: c.muted, textAlign: 'center' }}>
              Log each sample as it arrives so the next shift can pick it up. Only the lab number is written down — never the patient’s name.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.bar, { backgroundColor: c.bg, borderTopColor: c.ink }]}>
        <View style={styles.sync}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!cloud.connected ? (
              <>
                <CloudOff size={14} color={c.muted} />
                <Text style={[styles.syncText, { color: c.muted }]}>Cloud off — entries stay on this phone</Text>
              </>
            ) : syncNote ? (
              <Text style={[styles.syncText, { color: syncNote.bad ? c.danger : c.success }]}>{syncNote.text}</Text>
            ) : waiting > 0 ? (
              <>
                <CloudUpload size={14} color={c.amber} />
                <Text style={[styles.syncText, { color: c.amber }]}>
                  {waiting} entr{waiting === 1 ? 'y' : 'ies'} only on this phone{autoSync ? ' — sending automatically' : ' — tap Sync to send'}
                </Text>
              </>
            ) : (
              <>
                <CloudCheck size={14} color={c.success} />
                <Text style={[styles.syncText, { color: c.ink2 }]}>{cloud.lastSyncAt ? `All synced · ${relTime(cloud.lastSyncAt)}` : 'Not synced yet'}</Text>
              </>
            )}
          </View>
          {cloud.connected && (
            <Pressable
              onPress={() => void syncNow()}
              disabled={syncing}
              style={({ pressed }) => [styles.syncBtn, { borderColor: c.ink, backgroundColor: waiting > 0 ? c.ink : 'transparent' }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel="Sync with the team"
            >
              <RefreshCw size={14} color={waiting > 0 ? c.bg : c.ink} />
              <Text style={{ fontFamily: font.displaySemi, fontSize: 15, letterSpacing: 1, color: waiting > 0 ? c.bg : c.ink }}>{syncing ? 'SYNCING…' : 'SYNC'}</Text>
            </Pressable>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => {
              tap()
              void begin('/log/new')
            }}
            style={({ pressed }) => [styles.primary, { backgroundColor: c.ink }, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityLabel="Log sample"
          >
            <Plus size={20} color={c.bg} strokeWidth={2.6} />
            <Text style={{ fontFamily: font.display, fontSize: 21, letterSpacing: 1.6, color: c.bg }}>LOG SAMPLE</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              tap()
              void begin('/log/scan')
            }}
            style={({ pressed }) => [styles.scan, { borderColor: c.ink }, pressed && { backgroundColor: c.surface3 }]}
            accessibilityRole="button"
            accessibilityLabel="Scan lab number barcode"
          >
            <Barcode size={24} color={c.ink} />
          </Pressable>
        </View>
      </View>

      {reconfirm && (
        <PinPrompt
          title="Re-confirm entry"
          message={`${reconfirm.staffName} (${reconfirm.staffNumber}), enter your current PIN so your waiting entries can upload.`}
          onCancel={() => setReconfirm(null)}
          onSubmit={(pin) => {
            reconfirmUpload(reconfirm.eventId, pin)
            setReconfirm(null)
          }}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 24, paddingHorizontal: 9, borderRadius: 12 },
  tabs: { flexDirection: 'row', alignItems: 'flex-end', gap: 18, marginTop: 14, borderBottomWidth: 2 },
  tab: { paddingBottom: 7, borderBottomWidth: 3, borderBottomColor: 'transparent', marginBottom: -2 },
  search: { flexDirection: 'row', alignItems: 'center', height: 44, borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 12, marginTop: 10 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, marginHorizontal: 16, marginTop: 10, borderRadius: 4 },
  row: { flexDirection: 'row', borderBottomWidth: 1 },
  body: { flex: 1, paddingTop: 10, paddingBottom: 12, paddingLeft: 12, paddingRight: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  lab: { fontFamily: font.display, fontSize: 23, lineHeight: 26 },
  tests: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, paddingVertical: 3, paddingHorizontal: 7, borderRadius: 2, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 34 },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 12, borderTopWidth: 2 },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8, minHeight: 34 },
  syncText: { flexShrink: 1, fontFamily: font.body, fontSize: 12.5, lineHeight: 16 },
  syncBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 5, borderWidth: 1.5 },
  primary: { flex: 1, height: 54, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  scan: { width: 54, height: 54, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }
})
