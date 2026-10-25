// AUTO-COPIED from labdex/src/shared by `npm run sync-shared`. Do not edit here.
import { toMinutes, type Container, type LabTest, type Specimen, type TestInput } from './types'
import { blankSpecimen } from './migrate'

export function blankTest(departmentId = '', containerId = ''): TestInput {
  return {
    code: '',
    name: '',
    synonyms: [],
    departmentId,
    specimens: [blankSpecimen('', containerId)],
    transportNotes: '',
    tatRoutine: { value: 0, unit: 'h' },
    tatUrgent: null,
    daysPerformed: '',
    description: '',
    patientPrep: '',
    suggestions: [],
    rejectionCriteria: [],
    status: 'DRAFT'
  }
}

export function toInput(t: LabTest): TestInput {
  const { version: _v, createdAt: _c, updatedAt: _u, ...rest } = t
  return JSON.parse(JSON.stringify(rest)) as TestInput
}

/** A draft copy of an existing test, ready to be saved as a new one. */
export function duplicateInput(t: LabTest): TestInput {
  const { id: _id, ...rest } = toInput(t)
  return {
    ...rest,
    specimens: rest.specimens.map((s) => ({ ...s, id: '' })),
    code: `${t.code}-COPY`.slice(0, 20),
    name: `${t.name} (copy)`,
    status: 'DRAFT'
  }
}

export function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} d ago`
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '')
}

/** Parse "4 mL" → 4. Returns null when the size isn't a plain mL figure. */
export function capacityMl(size: string): number | null {
  const m = size.match(/^(\d+(?:\.\d+)?)\s*mL$/i)
  return m ? Number(m[1]) : null
}

/** "1 of 2 alternatives" style label for a test's sample list. */
export function specimenSummary(t: Pick<LabTest, 'specimens'>): string {
  const req = t.specimens.filter((s) => s.role === 'REQUIRED').length
  const alt = t.specimens.filter((s) => s.role === 'ALTERNATIVE').length
  if (req && alt) return `${req} required + 1 of ${alt} alternatives`
  if (alt) return `Any 1 of ${alt} samples`
  return req > 1 ? `${req} samples required` : '1 sample'
}

// ---------- Collection planner ----------

export interface PlannedSample {
  test: LabTest
  specimen: Specimen
  /** Other acceptable samples when this one was chosen from alternatives. */
  alternatives: Specimen[]
}

export interface Draw {
  container: Container
  samples: PlannedSample[]
  totalVolume: number
  unit: string
  tubes: number
}

export interface CollectionPlan {
  /** Blood draws in CLSI order of draw. */
  blood: Draw[]
  /** Urine, swabs, tissue, cytology… */
  other: Draw[]
  totalContainers: number
  /** Minimum blood volume, mL. */
  minBloodMl: number
  slowest: LabTest | null
}

/** Works out which containers to collect for a set of tests, in order of draw. */
export function planCollection(tests: LabTest[], con: (id: string) => Container | undefined): CollectionPlan {
  const picked: PlannedSample[] = []
  for (const t of tests) {
    for (const s of t.specimens.filter((x) => x.role === 'REQUIRED')) picked.push({ test: t, specimen: s, alternatives: [] })
    const alts = t.specimens.filter((x) => x.role === 'ALTERNATIVE')
    if (alts.length) picked.push({ test: t, specimen: alts[0], alternatives: alts.slice(1) })
  }

  const groups = new Map<string, PlannedSample[]>()
  for (const p of picked) groups.set(p.specimen.containerId, [...(groups.get(p.specimen.containerId) ?? []), p])

  const draws: Draw[] = []
  for (const [cid, samples] of groups) {
    const container = con(cid)
    if (!container) continue
    // Tests sharing a container share the draw, so size it on the minimum each one needs.
    const totalVolume = samples.reduce((sum, p) => sum + (p.specimen.minVolume ?? p.specimen.volume), 0)
    const unit = samples[0].specimen.volumeUnit
    const cap = capacityMl(container.size)
    const tubes = cap && unit === 'mL' ? Math.max(1, Math.ceil(totalVolume / cap)) : 1
    draws.push({ container, samples, totalVolume, unit, tubes })
  }
  draws.sort((a, b) => a.container.drawOrder - b.container.drawOrder || a.container.name.localeCompare(b.container.name))

  const blood = draws.filter((d) => d.container.drawOrder < 99)
  const other = draws.filter((d) => d.container.drawOrder >= 99)
  return {
    blood,
    other,
    totalContainers: draws.reduce((n, d) => n + d.tubes, 0),
    minBloodMl: blood.reduce((n, d) => n + (d.unit === 'mL' ? d.totalVolume : 0), 0),
    slowest: tests.reduce<LabTest | null>((m, t) => (!m || toMinutes(t.tatRoutine) > toMinutes(m.tatRoutine) ? t : m), null)
  }
}
