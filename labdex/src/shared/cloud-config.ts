// The lab's Supabase project, built into both apps so phones and PCs connect without typing anything.
// The anon key is public by design: every write goes through PIN-checked database functions.
// Never put the service_role / secret key here.
import type { SyncSettings } from './types'

export const BUILT_IN_CLOUD = {
  url: 'https://hrxvkoefzhxcikepfito.supabase.co',
  anonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeHZrb2Vmemh4Y2lrZXBmaXRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4NzAxMzIsImV4cCI6MjEwODQ0NjEzMn0.ZE3mY1PUYJkM_uCdpnU2L9eTTfr1c1u8QFi8nk9NELg'
}

/** Use the built-in project unless this device chose another one or deliberately disconnected. */
export function withBuiltInCloud(s: SyncSettings): SyncSettings {
  if (s.cloudUrl || s.cloudDisconnected || !BUILT_IN_CLOUD.url) return s
  return { ...s, cloudUrl: BUILT_IN_CLOUD.url, cloudKey: BUILT_IN_CLOUD.anonKey }
}
