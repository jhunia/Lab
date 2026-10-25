// AUTO-COPIED from labdex/src/shared by `npm run sync-shared`. Do not edit here.
// Upgrades data saved by LabDex v1 (one sample per test, fields on the test itself)
// to v2 (a list of specimens per test). Safe to run on data that is already v2.
import type { HistoryEntry, LabTest, Specimen, StabilityRule, StorageTemp, VolumeUnit } from './types'

/** Field names v1 kept directly on the test. */
export interface LegacySampleFields {
  sampleType?: string
  volume?: number
  volumeUnit?: VolumeUnit
  minVolume?: number | null
  paedVolume?: number | null
  containerId?: string
  storageTemp?: StorageTemp
  stability?: StabilityRule[]
  protectFromLight?: boolean
}

const LEGACY_KEYS: (keyof LegacySampleFields)[] = ['sampleType', 'volume', 'volumeUnit', 'minVolume', 'paedVolume', 'containerId', 'storageTemp', 'stability', 'protectFromLight']

export function blankSpecimen(id: string, containerId = ''): Specimen {
  return {
    id,
    role: 'REQUIRED',
    sampleType: '',
    volume: 0,
    volumeUnit: 'mL',
    minVolume: null,
    paedVolume: null,
    containerId,
    storageTemp: 'ROOM',
    stability: [],
    protectFromLight: false,
    notes: ''
  }
}

export function legacyToSpecimen(id: string, f: LegacySampleFields): Specimen {
  return {
    ...blankSpecimen(id),
    sampleType: f.sampleType ?? '',
    volume: f.volume ?? 0,
    volumeUnit: f.volumeUnit ?? 'mL',
    minVolume: f.minVolume ?? null,
    paedVolume: f.paedVolume ?? null,
    containerId: f.containerId ?? '',
    storageTemp: f.storageTemp ?? 'ROOM',
    stability: f.stability ?? [],
    protectFromLight: f.protectFromLight ?? false
  }
}

/** Returns a v2 test; v1 tests get their sample fields moved into `specimens[0]`. */
export function migrateTest(raw: LabTest & LegacySampleFields): LabTest {
  if (Array.isArray(raw.specimens) && raw.specimens.length) {
    const { specimens, ...rest } = raw
    const clean = { ...rest } as Record<string, unknown>
    LEGACY_KEYS.forEach((k) => delete clean[k])
    return { ...(clean as unknown as LabTest), specimens }
  }
  const t = { ...raw } as Record<string, unknown>
  const specimen = legacyToSpecimen(`${raw.id}-s1`, raw)
  LEGACY_KEYS.forEach((k) => delete t[k])
  return { ...(t as unknown as LabTest), specimens: [specimen] }
}

export function migrateHistory(h: HistoryEntry): HistoryEntry {
  return { ...h, snapshot: migrateTest(h.snapshot as LabTest & LegacySampleFields) }
}
