import { useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { Stack, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CheckSquare, CloudCheck, Library, ListOrdered, Search, TestTubes, WifiOff } from 'lucide-react-native'
import { font, useTheme } from '@/lib/theme'
import { tap } from '@/components/ui'
import { markWelcomed } from '@/lib/welcome'

interface Card {
  icon: ReactNode
  title: string
  body: string
  demo: ReactNode
}

/** A short, one-time walkthrough of what the app does. Reopen it from Settings. */
export default function Welcome() {
  const { c } = useTheme()
  const insets = useSafeAreaInsets()
  const { width: winW } = useWindowDimensions()
  const width = Math.min(winW, 560)
  const scroller = useRef<ScrollView>(null)
  const [page, setPage] = useState(0)
  const [height, setHeight] = useState(0)

  const chip = (children: ReactNode, style?: object) => <View style={[styles.chip, { borderColor: c.lineStrong, backgroundColor: c.surface }, style]}>{children}</View>
  const small = (t: string, color = c.ink2) => <Text style={{ fontFamily: font.body, fontSize: 13, color }}>{t}</Text>

  const cards: Card[] = [
    {
      icon: <Library size={26} color={c.ink} />,
      title: 'Look up any test',
      body: 'Search by name, code or abbreviation. Every test shows the sample, tube, volume, storage and turnaround — what to collect and how to keep it.',
      demo: (
        <View style={{ gap: 8 }}>
          {chip(
            <>
              <Search size={15} color={c.muted} />
              {small('fbs', c.ink)}
            </>
          )}
          {chip(
            <View style={{ gap: 2 }}>
              <Text style={{ fontFamily: font.display, fontSize: 18, color: c.ink }}>Fasting Blood Glucose</Text>
              {small('Fluoride plasma · 2 mL · grey top · 1 hr')}
            </View>
          )}
        </View>
      )
    },
    {
      icon: <TestTubes size={26} color={c.ink} />,
      title: 'Plan a collection',
      body: 'In the Planner, tick the tests ordered for a patient. LabDex works out which tubes to fill, how many, and the order of draw.',
      demo: (
        <View style={{ gap: 8 }}>
          {chip(
            <>
              <CheckSquare size={15} color={c.ink} />
              {small('FBC  ·  U&E  ·  Fasting glucose', c.ink)}
            </>
          )}
          {chip(
            <>
              <ListOrdered size={15} color={c.ink2} />
              {small('1 lavender  →  2 gold  →  3 grey')}
            </>
          )}
        </View>
      )
    },
    {
      icon: <CloudCheck size={26} color={c.ink} />,
      title: 'Always up to date',
      body: 'Everything syncs by itself. When a Senior changes a test, every phone gets the new version automatically — nothing to tap. No signal? LabDex keeps working and catches up when it’s back.',
      demo: (
        <View style={{ gap: 8 }}>
          {chip(
            <>
              <WifiOff size={14} color={c.muted} />
              {small('Offline — using the tests on this phone', c.muted)}
            </>
          )}
          {chip(
            <>
              <CloudCheck size={14} color={c.success} />
              {small('Tests updated by Kofi · just now')}
            </>
          )}
        </View>
      )
    }
  ]

  const last = page === cards.length - 1
  const finish = () => {
    tap()
    void markWelcomed()
    if (router.canGoBack()) router.back()
    else router.replace('/')
  }
  const next = () => {
    tap()
    if (last) return finish()
    scroller.current?.scrollTo({ x: (page + 1) * width, animated: true })
    setPage(page + 1)
  }
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))

  return (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false }} />
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16, alignItems: 'center' }}>
        <View style={{ width, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }}>
          <Text style={{ fontFamily: font.displaySemi, fontSize: 13, letterSpacing: 1.8, color: c.muted }}>HOW LABDEX WORKS</Text>
          {!last && (
            <Pressable onPress={finish} hitSlop={10} accessibilityRole="button">
              <Text style={{ fontFamily: font.bodyMedium, fontSize: 14, color: c.muted }}>Skip</Text>
            </Pressable>
          )}
        </View>

        {/* Cards fill the measured space so each one sits centred between the header and the buttons. */}
        <View style={{ flex: 1, width }} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
          <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} onScroll={onScroll} scrollEventThrottle={64} style={{ width, height }}>
          {cards.map((card, i) => (
            <View key={card.title} style={{ width, height, paddingHorizontal: 24, justifyContent: 'center', gap: 18 }}>
              <View style={[styles.demo, { backgroundColor: c.surface2, borderColor: c.line }]}>{card.demo}</View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {card.icon}
                <Text style={{ fontFamily: font.display, fontSize: 30, lineHeight: 33, color: c.ink, flex: 1 }}>{card.title}</Text>
              </View>
              <Text style={{ fontFamily: font.body, fontSize: 16, lineHeight: 24, color: c.ink2 }}>{card.body}</Text>
              <Text style={{ fontFamily: font.mono, fontSize: 12, color: c.muted }}>
                {i + 1} / {cards.length}
              </Text>
            </View>
          ))}
          </ScrollView>
        </View>

        <View style={{ width, paddingHorizontal: 24, gap: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {cards.map((card, i) => (
              <View key={card.title} style={{ height: 4, width: i === page ? 22 : 8, borderRadius: 2, backgroundColor: i === page ? c.ink : c.lineStrong }} />
            ))}
          </View>
          <Pressable onPress={next} style={({ pressed }) => [styles.next, { backgroundColor: c.ink }, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <Text style={{ fontFamily: font.display, fontSize: 20, letterSpacing: 1.6, color: c.bg }}>{last ? 'GET STARTED' : 'NEXT'}</Text>
          </Pressable>
        </View>
      </View>
    </>
  )
}

const styles = StyleSheet.create({
  demo: { borderWidth: 1, borderRadius: 6, padding: 16, minHeight: 150, justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 4, paddingHorizontal: 12, paddingVertical: 10 },
  next: { height: 54, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }
})
