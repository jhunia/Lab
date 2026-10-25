import { useMemo, useState, type ReactNode } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { ArrowUpDown, FlaskConical, LayoutGrid, Plus, Rows3, Search, TestTube, X, Zap } from 'lucide-react-native'
import { STORAGE_LABELS, formatDuration, primarySpecimen, toMinutes, type LabTest, type StorageTemp } from '@shared/types'
import { useData } from '@/lib/data'
import { font, useTheme } from '@/lib/theme'
import { TestCard } from '@/components/TestCard'
import { Chip, tap } from '@/components/ui'
import { CapDot, StorageBadge } from '@/components/Visuals'
import { OptionSheet } from '@/components/OptionSheet'
import { UpdateBanner } from '@/components/UpdateBanner'
import { SessionChip } from '@/components/SessionChip'
import { useRequireStaff } from '@/lib/identity'

type Scope = 'active' | 'DRAFT' | 'ARCHIVED'
type Sort = 'name' | 'code' | 'tat' | 'updated'
const TEMPS = Object.keys(STORAGE_LABELS) as StorageTemp[]
const SORT_LABEL: Record<Sort, string> = { name: 'Name', code: 'Code', tat: 'Fastest TAT', updated: 'Recently updated' }

export default function Directory() {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { tests, departments, containers, dep, con, search } = useData()
  const requireStaff = useRequireStaff()
  const [q, setQ] = useState('')
  const [depId, setDepId] = useState<string | null>(null)
  const [scope, setScope] = useState<Scope>('active')
  const [temp, setTemp] = useState<StorageTemp | null>(null)
  const [containerId, setContainerId] = useState('')
  const [sort, setSort] = useState<Sort>('name')
  const [compact, setCompact] = useState(false)
  const [sheet, setSheet] = useState<'sort' | 'container' | null>(null)

  const active = useMemo(() => tests.filter((t) => t.status !== 'ARCHIVED'), [tests])
  const rows = useMemo(() => {
    let list = scope === 'active' ? active : tests.filter((t) => t.status === scope)
    if (depId) list = list.filter((t) => t.departmentId === depId)
    if (temp) list = list.filter((t) => t.specimens.some((s) => s.storageTemp === temp))
    if (containerId) list = list.filter((t) => t.specimens.some((s) => s.containerId === containerId))
    if (q.trim()) return search(q, list)
    return [...list].sort((a, b) =>
      sort === 'code'
        ? a.code.localeCompare(b.code)
        : sort === 'tat'
          ? toMinutes(a.tatRoutine) - toMinutes(b.tatRoutine)
          : sort === 'updated'
            ? b.updatedAt.localeCompare(a.updatedAt)
            : a.name.localeCompare(b.name)
    )
  }, [tests, active, scope, depId, temp, containerId, q, sort, search])

  const counts = {
    drafts: tests.filter((t) => t.status === 'DRAFT').length,
    archived: tests.filter((t) => t.status === 'ARCHIVED').length,
    stat: active.filter((t) => t.tatUrgent).length
  }
  const usedContainers = containers.filter((k) => tests.some((t) => t.specimens.some((s) => s.containerId === k.id)))
  const filtering = !!(q || depId || temp || containerId || scope !== 'active')

  const header = (
    <View style={{ paddingTop: insets.top + 12, gap: 14, paddingBottom: 12 }}>
      <View style={styles.titleRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <BrandMark />
          <Text numberOfLines={1} style={[styles.title, { color: c.ink }]}>
            {scope === 'DRAFT' ? 'Drafts' : scope === 'ARCHIVED' ? 'Archived' : depId ? dep(depId)?.name : 'Test directory'}
          </Text>
        </View>
        <SessionChip />
        <Text style={{ fontFamily: font.mono, fontSize: 12, color: c.muted }}>{String(rows.length).padStart(3, '0')}</Text>
      </View>

      <UpdateBanner />

      {!filtering && (
        <View style={styles.readouts}>
          {[
            ['Active', active.length, null],
            ['STAT', counts.stat, <Zap key="z" size={10} color="#5ee0bc" />],
            ['Drafts', counts.drafts, null]
          ].map(([label, n, icon]) => (
            <View key={label as string} style={[styles.readout, { backgroundColor: c.readout }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {icon}
                <Text style={styles.readoutLabel}>{label as string}</Text>
              </View>
              <Text style={styles.readoutValue}>{String(n).padStart(3, '0')}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.lineStrong }]}>
        <Search size={17} color={c.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name, code, synonym…"
          placeholderTextColor={c.muted}
          selectionColor={c.accent}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{ flex: 1, fontFamily: font.body, fontSize: 15.5, color: c.ink, paddingVertical: 0 }}
        />
        {q ? (
          <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="Clear search">
            <X size={17} color={c.muted} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Chip label="All" active={scope === 'active' && !depId} onPress={() => (setScope('active'), setDepId(null))} />
        {departments.map((d) => (
          <Chip key={d.id} label={d.name} color={d.color} active={scope === 'active' && depId === d.id} onPress={() => (setScope('active'), setDepId(depId === d.id ? null : d.id))} />
        ))}
        <View style={{ width: 1, backgroundColor: c.lineStrong, marginHorizontal: 4 }} />
        <Chip label={`Drafts · ${counts.drafts}`} active={scope === 'DRAFT'} onPress={() => (setDepId(null), setScope(scope === 'DRAFT' ? 'active' : 'DRAFT'))} />
        <Chip label={`Archived · ${counts.archived}`} active={scope === 'ARCHIVED'} onPress={() => (setDepId(null), setScope(scope === 'ARCHIVED' ? 'active' : 'ARCHIVED'))} />
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {TEMPS.map((t) => (
          <Pressable
            key={t}
            onPress={() => {
              tap()
              setTemp(temp === t ? null : t)
            }}
            style={{ borderRadius: 8, borderWidth: 1.5, borderColor: temp === t ? c.storage[t].fg : 'transparent', padding: 1.5, opacity: temp && temp !== t ? 0.55 : 1 }}
          >
            <StorageBadge temp={t} compact />
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.tools}>
        <ToolButton icon={<TestTube size={14} color={containerId ? c.accent : c.ink2} />} label={containerId ? (con(containerId)?.name ?? 'Container') : 'All containers'} active={!!containerId} onPress={() => setSheet('container')} />
        <ToolButton icon={<ArrowUpDown size={14} color={c.ink2} />} label={q ? 'Best match' : SORT_LABEL[sort]} onPress={() => !q && setSheet('sort')} />
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => (tap(), setCompact(!compact))} style={[styles.viewToggle, { borderColor: c.lineStrong, backgroundColor: c.surface }]} accessibilityLabel={compact ? 'Card view' : 'List view'}>
          {compact ? <LayoutGrid size={16} color={c.ink2} /> : <Rows3 size={16} color={c.ink2} />}
        </Pressable>
      </View>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
        ItemSeparatorComponent={() => <View style={{ height: compact ? 6 : 10 }} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={({ item }) =>
          compact ? <CompactRow test={item} onPress={() => router.push(`/test/${item.id}`)} /> : <TestCard test={item} dep={dep(item.departmentId)} conOf={con} onPress={() => router.push(`/test/${item.id}`)} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <FlaskConical size={36} color={c.muted} strokeWidth={1.4} />
            <Text style={{ fontFamily: font.display, fontSize: 17, color: c.ink }}>{q ? `Nothing matches “${q}”` : 'No tests here'}</Text>
            <Text style={{ fontFamily: font.body, color: c.muted, textAlign: 'center' }}>{q ? 'Try a code, abbreviation or synonym.' : 'Tap + to add a test, or sync from Settings to get the lab’s tests.'}</Text>
          </View>
        }
      />
      {(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New test"
          onPress={async () => {
            tap()
            if (await requireStaff('SENIOR', 'add a test')) router.push({ pathname: '/test/edit', params: depId ? { dep: depId } : {} })
          }}
          style={({ pressed }) => [styles.fab, { backgroundColor: c.accent, shadowColor: c.accent }, pressed && { transform: [{ scale: 0.94 }] }]}
        >
          <Plus size={26} color={c.accentInk} strokeWidth={2.4} />
        </Pressable>
      )}

      <OptionSheet<Sort>
        visible={sheet === 'sort'}
        title="Sort by"
        value={sort}
        options={(Object.keys(SORT_LABEL) as Sort[]).map((v) => ({ v, label: SORT_LABEL[v] }))}
        onPick={setSort}
        onClose={() => setSheet(null)}
      />
      <OptionSheet<string>
        visible={sheet === 'container'}
        title="Filter by container"
        value={containerId}
        options={[{ v: '', label: 'All containers' }, ...usedContainers.map((k) => ({ v: k.id, label: k.name, icon: <CapDot color={k.capColor} size={13} /> }))]}
        onPick={setContainerId}
        onClose={() => setSheet(null)}
      />
    </View>
  )
}

function CompactRow({ test, onPress }: { test: LabTest; onPress: () => void }) {
  const { c } = useTheme()
  const { dep, con } = useData()
  const main = primarySpecimen(test)
  return (
    <Pressable onPress={() => (tap(), onPress())} style={({ pressed }) => [styles.compact, { backgroundColor: c.surface, borderColor: c.line }, pressed && { opacity: 0.7 }]}>
      <View style={{ width: 3, alignSelf: 'stretch', borderRadius: 2, backgroundColor: dep(test.departmentId)?.color ?? c.lineStrong }} />
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {test.specimens.map((s) => (
          <CapDot key={s.id} color={con(s.containerId)?.capColor} size={10} />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: font.bodySemi, fontSize: 14.5, color: c.ink }}>
          {test.name}
        </Text>
        <Text numberOfLines={1} style={{ fontFamily: font.mono, fontSize: 11, color: c.muted }}>
          {test.code} · {test.specimens.length > 1 ? `${test.specimens.length} samples` : main?.sampleType}
        </Text>
      </View>
      <Text style={{ fontFamily: font.mono, fontSize: 11.5, color: c.ink2 }}>{formatDuration(test.tatRoutine)}</Text>
    </Pressable>
  )
}

function ToolButton({ icon, label, active, onPress }: { icon: ReactNode; label: string; active?: boolean; onPress: () => void }) {
  const { c } = useTheme()
  return (
    <Pressable onPress={() => (tap(), onPress())} style={[styles.toolBtn, { borderColor: active ? c.accent : c.lineStrong, backgroundColor: active ? c.accentSoft : c.surface }]}>
      {icon}
      <Text numberOfLines={1} style={{ fontFamily: font.bodySemi, fontSize: 12.5, color: active ? c.ink : c.ink2, maxWidth: 140 }}>
        {label}
      </Text>
    </Pressable>
  )
}

function BrandMark() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2.5, height: 22 }}>
      {[
        ['#9B7BC8', 16],
        ['#D9A928', 22],
        ['#0E7C66', 13]
      ].map(([col, h]) => (
        <View key={col as string} style={{ width: 6, height: h as number, borderRadius: 2, borderWidth: 1, borderColor: col as string, overflow: 'hidden', justifyContent: 'flex-start' }}>
          <View style={{ height: '32%', backgroundColor: col as string }} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: font.display, fontSize: 27, letterSpacing: -0.5, flexShrink: 1 },
  viewer: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 11 },
  readouts: { flexDirection: 'row', gap: 8 },
  readout: { flex: 1, borderRadius: 10, padding: 10, gap: 2 },
  readoutLabel: { fontFamily: font.monoMedium, fontSize: 9.5, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(230,233,238,0.7)' },
  readoutValue: { fontFamily: font.monoMedium, fontSize: 24, color: '#5ee0bc' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  chipRow: { gap: 8, paddingRight: 16 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 9, borderWidth: 1 },
  viewToggle: { width: 36, height: 34, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 60, paddingHorizontal: 30 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6
  }
})
