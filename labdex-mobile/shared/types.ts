// AUTO-COPIED from labdex/src/shared by `npm run sync-shared`. Do not edit here.
import type { LogView, SampleLog, SampleStatus } from './logs'
import type { Staff, StaffInput, StaffRole, StaffSession } from './staff'

export type StorageTemp = 'ROOM' | 'FRIDGE' | 'FROZEN' | 'DEEP_FROZEN'
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type TimeUnit = 'min' | 'h' | 'd' | 'wk'
export type VolumeUnit = 'mL' | 'µL' | 'g' | 'swab' | 'slide' | 'piece' | 'vial'
export type ContainerKind = 'tube' | 'cup' | 'bottle' | 'swab' | 'jar' | 'vial' | 'slide' | 'other'
/** REQUIRED: must be collected. ALTERNATIVE: any one of the alternatives will do. */
export type SpecimenRole = 'REQUIRED' | 'ALTERNATIVE'

export const VOLUME_UNITS: VolumeUnit[] = ['mL', 'µL', 'g', 'swab', 'slide', 'piece', 'vial']

export interface Duration {
  value: number
  unit: TimeUnit
}

export interface StabilityRule {
  temp: StorageTemp
  value: number
  unit: TimeUnit
}

export interface Container {
  id: string
  name: string
  capColor: string
  additive: string
  size: string
  kind: ContainerKind
  /** CLSI order of draw position; lower draws first. 99 = not applicable. */
  drawOrder: number
}

export interface Department {
  id: string
  name: string
  color: string
}

/** One sample a test needs. A test has one or more. */
export interface Specimen {
  id: string
  role: SpecimenRole
  sampleType: string
  volume: number
  volumeUnit: VolumeUnit
  minVolume: number | null
  paedVolume: number | null
  containerId: string
  storageTemp: StorageTemp
  stability: StabilityRule[]
  protectFromLight: boolean
  notes: string
}

export interface LabTest {
  id: string
  code: string
  name: string
  synonyms: string[]
  departmentId: string

  specimens: Specimen[]
  transportNotes: string

  tatRoutine: Duration
  tatUrgent: Duration | null
  daysPerformed: string

  description: string
  patientPrep: string
  suggestions: string[]
  rejectionCriteria: string[]

  status: TestStatus
  version: number
  createdAt: string
  updatedAt: string
}

/** Payload for create/update: server-managed fields are optional. */
export type TestInput = Omit<LabTest, 'id' | 'version' | 'createdAt' | 'updatedAt'> & {
  id?: string
}

export type HistoryAction = 'created' | 'updated' | 'archived' | 'restored' | 'reverted' | 'imported'

export interface HistoryEntry {
  id: string
  testId: string
  version: number
  action: HistoryAction
  at: string
  changes: string[]
  snapshot: LabTest
}


/** Sync settings stored per device (not inside the shared directory). */
export interface SyncSettings {
  /** https link to the published update file — used when no cloud is connected. */
  feedUrl: string
  /** Revision of the last update this device applied (0 = never). */
  syncedRevision: number
  lastCheckedAt: string | null
  /** Supabase project URL + public anon key ('' = not connected). */
  cloudUrl: string
  cloudKey: string
  /** Set when someone pressed Disconnect, so the built-in project is not re-applied. */
  cloudDisconnected?: boolean
  /** Sample log syncs by itself (default). false = entries stay on this device until someone taps Sync. */
  autoSync?: boolean
}

export const DEFAULT_SYNC: SyncSettings = { feedUrl: '', syncedRevision: 0, lastCheckedAt: null, cloudUrl: '', cloudKey: '' }

/** Who is confirmed on this device (the PIN never leaves the main process). */
export type PublicSession = Omit<StaffSession, 'pin'>

export interface CloudStatus {
  connected: boolean
  lastSyncAt: string | null
  /** Last problem talking to the cloud, e.g. offline. */
  error: string
}

export interface LogState {
  views: LogView[]
  waitingUpload: number
  /** Entries the cloud refused because the PIN didn't match — the person must re-confirm. */
  needsPin: { eventId: string; staffName: string; staffNumber: string; labNumber: string; error: string }[]
}

export interface Snapshot {
  tests: LabTest[]
  containers: Container[]
  departments: Department[]
  dataPath: string
  revision: number
  sync: SyncSettings
  staff: Staff[]
  session: PublicSession | null
  cloud: CloudStatus
}

export interface ImportResult {
  added: number
  updated: number
  errors: string[]
}

export interface SyncCheck {
  available: boolean
  remoteRevision: number
  publishedAt: string | null
  publishedBy: string
  error?: string
}

export type ThemeMode = 'light' | 'dark'

export interface LabDexApi {
  getAll(): Promise<Snapshot>
  saveTest(input: TestInput): Promise<LabTest>
  archiveTest(id: string): Promise<LabTest>
  restoreTest(id: string): Promise<LabTest>
  deleteTest(id: string): Promise<void>
  getHistory(testId: string): Promise<HistoryEntry[]>
  revertTo(historyId: string): Promise<LabTest>
  saveContainer(c: Container): Promise<Container>
  deleteContainer(id: string): Promise<void>
  saveDepartment(d: Department): Promise<Department>
  deleteDepartment(id: string): Promise<void>
  exportCsv(): Promise<string | null>
  importCsv(): Promise<ImportResult | null>
  openDataFolder(): Promise<void>
  setTheme(mode: ThemeMode): void
  // Sync (update-file workaround until the Supabase backend is connected)
  publishUpdate(publishedBy: string): Promise<string | null>
  openUpdateFile(): Promise<{ revision: number; tests: number } | null>
  checkForUpdate(): Promise<SyncCheck>
  syncNow(): Promise<{ revision: number; tests: number }>
  setSyncSettings(patch: Partial<Pick<SyncSettings, 'feedUrl'>>): Promise<SyncSettings>
  // Staff identity (no logins: staff number + PIN)
  identify(staffId: string, pin: string, minRole: StaffRole, allowProvisional: boolean): Promise<{ session: PublicSession; provisional: boolean }>
  lockSession(): Promise<void>
  saveStaff(input: StaffInput, newPin: string | null): Promise<Staff>
  changeOwnPin(staffId: string, oldPin: string, newPin: string): Promise<void>
  // Cloud (Supabase)
  setCloud(cfg: { url: string; anonKey: string } | null): Promise<{ staff: number }>
  /** Connects (back) to the lab's own built-in cloud project. */
  reconnectLabCloud(): Promise<{ staff: number }>
  syncTeam(): Promise<void>
  // Sample log
  getLogs(): Promise<LogState>
  createLog(input: { labNumber: string; testIds: string[]; status: SampleStatus; note: string }): Promise<SampleLog>
  addLogEvent(logId: string, status: SampleStatus, note: string): Promise<void>
  reconfirmUpload(eventId: string, pin: string): Promise<void>
  /** Called when background sync changed something (new logs, release, staff). Returns an unsubscribe. */
  onChanged(cb: () => void): () => void
}

export const STORAGE_LABELS: Record<StorageTemp, { label: string; range: string }> = {
  ROOM: { label: 'Room temp', range: '15–25 °C' },
  FRIDGE: { label: 'Refrigerated', range: '2–8 °C' },
  FROZEN: { label: 'Frozen', range: '−20 °C' },
  DEEP_FROZEN: { label: 'Deep frozen', range: '−70 °C' }
}

export const TIME_UNIT_LABELS: Record<TimeUnit, [string, string]> = {
  min: ['min', 'min'],
  h: ['hr', 'hrs'],
  d: ['day', 'days'],
  wk: ['wk', 'wks']
}

export function toMinutes(d: { value: number; unit: TimeUnit }): number {
  const m = { min: 1, h: 60, d: 1440, wk: 10080 }[d.unit]
  return d.value * m
}

export function formatDuration(d: Duration | null | undefined): string {
  if (!d) return '—'
  return `${d.value} ${TIME_UNIT_LABELS[d.unit][d.value === 1 ? 0 : 1]}`
}

/** The specimen shown on cards and lists: the first required one, else the first. */
export function primarySpecimen(t: Pick<LabTest, 'specimens'>): Specimen | undefined {
  return t.specimens.find((s) => s.role === 'REQUIRED') ?? t.specimens[0]
}
