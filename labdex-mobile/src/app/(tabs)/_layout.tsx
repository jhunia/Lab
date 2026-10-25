import { Tabs } from 'expo-router'
import { NotebookPen, Library, Settings2, TestTubes } from 'lucide-react-native'
import { useData } from '@/lib/data'
import { font, useTheme } from '@/lib/theme'

export default function TabsLayout() {
  const { c } = useTheme()
  const { update, logs, needsPin, staff, cloud } = useData()
  const open = logs.filter((v) => v.open).length
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontFamily: font.bodySemi, fontSize: 11 }
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Directory', tabBarIcon: ({ color, size }) => <Library color={color} size={size - 2} /> }} />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Register',
          tabBarBadge: needsPin.length ? '!' : open || undefined,
          tabBarBadgeStyle: { backgroundColor: needsPin.length ? c.amber : c.accent, color: c.accentInk },
          tabBarIcon: ({ color, size }) => <NotebookPen color={color} size={size - 2} />
        }}
      />
      <Tabs.Screen name="planner" options={{ title: 'Planner', tabBarIcon: ({ color, size }) => <TestTubes color={color} size={size - 2} /> }} />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarBadge: update?.available || (staff.length === 0 && cloud.connected) ? '1' : undefined, tabBarBadgeStyle: { backgroundColor: c.urgent }, tabBarIcon: ({ color, size }) => <Settings2 color={color} size={size - 2} /> }}
      />
    </Tabs>
  )
}
