// Background update check: every ~15+ minutes (the OS decides exactly when), even when
// LabDex is closed, check for a newer published update and show a notification.
// Uses the cloud when connected, otherwise the update-file link.
// Imported once from the root layout so the task is defined globally.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import * as BackgroundTask from 'expo-background-task'
import * as Notifications from 'expo-notifications'
import * as TaskManager from 'expo-task-manager'
import { checkFeed, httpGetText } from '@shared/sync'
import { CloudClient } from '@shared/cloud'
import { DEFAULT_SYNC, type SyncSettings } from '@shared/types'

export const DB_KEY = 'labdex.db.v1'
export const SYNC_KEY = 'labdex.sync.v1'
export const LOGS_KEY = 'labdex.logs.v1'
const NOTIFIED_KEY = 'labdex.notifiedRevision'
const TASK = 'labdex-update-check'

export async function loadSync(): Promise<SyncSettings> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_KEY)
    return raw ? { ...DEFAULT_SYNC, ...(JSON.parse(raw) as Partial<SyncSettings>) } : { ...DEFAULT_SYNC }
  } catch {
    return { ...DEFAULT_SYNC }
  }
}

async function localRevision(sync: SyncSettings): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(DB_KEY)
    const rev = raw ? ((JSON.parse(raw) as { revision?: number }).revision ?? 0) : 0
    return Math.max(rev, sync.syncedRevision)
  } catch {
    return sync.syncedRevision
  }
}

/** Shows "update available" once per published revision. */
export async function notifyUpdate(revision: number, publishedBy: string): Promise<void> {
  const already = Number((await AsyncStorage.getItem(NOTIFIED_KEY)) ?? 0)
  if (already >= revision) return
  await AsyncStorage.setItem(NOTIFIED_KEY, String(revision))
  await Notifications.scheduleNotificationAsync({
    content: { title: 'LabDex update available', body: `${publishedBy} published new test information. Open LabDex and tap Sync now.` },
    trigger: null
  })
}

TaskManager.defineTask(TASK, async () => {
  try {
    const sync = await loadSync()
    const local = await localRevision(sync)
    if (sync.cloudUrl && sync.cloudKey) {
      const rel = await new CloudClient({ url: sync.cloudUrl, anonKey: sync.cloudKey }, fetch as never).latestRelease()
      if (rel && rel.revision > local) await notifyUpdate(rel.revision, rel.publisherName)
    } else if (sync.feedUrl) {
      const { check } = await checkFeed(sync.feedUrl, local, httpGetText)
      if (check.available) await notifyUpdate(check.remoteRevision, check.publishedBy)
    }
    return BackgroundTask.BackgroundTaskResult.Success
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed
  }
})

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true })
})

/** Asks for notification permission and schedules the background check. Safe to call repeatedly. */
export async function enableUpdateNotifications(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Updates', importance: Notifications.AndroidImportance.HIGH })
    }
    const current = await Notifications.getPermissionsAsync()
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted
    if ((await BackgroundTask.getStatusAsync()) === BackgroundTask.BackgroundTaskStatus.Available && !(await TaskManager.isTaskRegisteredAsync(TASK))) {
      await BackgroundTask.registerTaskAsync(TASK, { minimumInterval: 15 })
    }
    return granted
  } catch {
    return false
  }
}
