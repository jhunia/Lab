import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { Platform, View, useWindowDimensions } from 'react-native'
import { useFonts } from 'expo-font'
import { BarlowCondensed_500Medium } from '@expo-google-fonts/barlow-condensed/500Medium'
import { BarlowCondensed_600SemiBold } from '@expo-google-fonts/barlow-condensed/600SemiBold'
import { BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed/700Bold'
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular'
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium'
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold'
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular'
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium'
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold'
import { SafeAreaProvider } from 'react-native-safe-area-context'
// Defines the background update-check task; must load before the app renders.
import '@/lib/background'
import '@/lib/web-alert'
import { DataProvider, useData } from '@/lib/data'
import { IdentityProvider } from '@/lib/identity'
import { hasSeenWelcome } from '@/lib/welcome'
import { ThemeProvider, font, useTheme } from '@/lib/theme'

function Navigator() {
  const { c, mode } = useTheme()
  const { ready } = useData()
  // First launch only: open the short walkthrough once the app has loaded.
  useEffect(() => {
    if (!ready) return
    let alive = true
    void hasSeenWelcome().then((seen) => {
      if (!seen && alive) setTimeout(() => router.push('/welcome'), 300)
    })
    return () => {
      alive = false
    }
  }, [ready])
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />
  return (
    <WebFrame>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerShadowVisible: false,
          headerTintColor: c.accent,
          headerTitleStyle: { fontFamily: font.display, color: c.ink },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.bg }
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="test/[id]" options={{ title: '' }} />
        <Stack.Screen name="test/edit" options={{ presentation: 'modal', title: 'Test' }} />
        <Stack.Screen name="lookups" options={{ title: 'Containers & departments' }} />
        <Stack.Screen name="staff" options={{ title: 'Staff' }} />
        <Stack.Screen name="log/new" options={{ presentation: 'modal', title: 'Log a sample' }} />
        <Stack.Screen name="log/[id]" options={{ title: '' }} />
        <Stack.Screen name="log/scan" options={{ presentation: 'fullScreenModal', headerShown: false }} />
        <Stack.Screen name="welcome" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
      </Stack>
    </WebFrame>
  )
}

/** In a wide browser window keep the app phone-width and centred instead of stretched edge to edge. */
function WebFrame({ children }: { children: ReactNode }) {
  const { c } = useTheme()
  const { width } = useWindowDimensions()
  if (Platform.OS !== 'web') return <>{children}</>
  const framed = width > 560
  return (
    <View style={{ flex: 1, backgroundColor: c.surface3, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 560, overflow: 'hidden', backgroundColor: c.bg, borderLeftWidth: framed ? 1 : 0, borderRightWidth: framed ? 1 : 0, borderColor: c.line }}>{children}</View>
    </View>
  )
}

export default function RootLayout() {
  const [loaded] = useFonts({
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold
  })
  if (!loaded) return null
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <DataProvider>
          <IdentityProvider>
            <Navigator />
          </IdentityProvider>
        </DataProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
