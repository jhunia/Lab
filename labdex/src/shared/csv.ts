// Dependency-free CSV import/export, shared by desktop and mobile so files move between them.
// One row per sample: a test with two samples has two rows with the same code; the test's
// own fields are read from its first row. Files from LabDex v1 (one row per test) still import.
import { VOLUME_UNITS, type Duration, type ImportResult, type LabTest, type Specimen, type StabilityRule, type StorageTemp, type TestInput, type TimeUnit, type VolumeUnit } from './types'
import { uid, type LabCore } from './core'

const TEST_COLUMNS = [
  'code', 'name', 'synonyms', 'department', 'transportNotes', 'tatRoutine', 'tatUrgent',
  'daysPerformed', 'description', 'patientPrep', 'suggestions', 'rejectionCriteria', 'status'
] as const
const SAMPLE_COLUMNS = [
  'sampleRole', 'sampleType', 'volume', 'volumeUnit', 'minVolume', 'paedVolume', 'container',
  'storageTemp', 'stability', 'protectFromLight', 'sampleNotes'
] as const
const COLUMNS = [...TEST_COLUMNS, ...SAMPLE_COLUMNS]

type Row = Record<(typeof COLUMNS)[number], string>

const LIST_SEP = ' | '
const TEMPS: StorageTemp[] = ['ROOM', 'FRIDGE', 'FROZEN', 'DEEP_FROZEN']

// ---------- minimal RFC 4180 CSV ----------

function escapeCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function unparse(rows: string[][]): string {
  return rows.map((r) => r.map(escapeCell).join(',')).join('\r\n')
}

export function parse(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(cell)
      cell = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += c
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

// ---------- LabDex mapping ----------

const dur = (d: Duration | null) => (d ? `${d.value}${d.unit}` : '')

function parseDur(s: string): Duration | null {
  const m = s.trim().match(/^(\d+(?:\.\d+)?)\s*(min|h|d|wk)$/i)
  if (!m) return null
  return { value: Number(m[1]), unit: m[2].toLowerCase() as TimeUnit }
}

const list = (s: string) => s.split('|').map((x) => x.trim()).filter(Boolean)
const num = (s: string) => (s.trim() === '' ? null : Number(s))

export function toCsv(core: LabCore): string {
  const { tests, containers, departments } = core.snapshot()
  const rows: Row[] = tests.flatMap((t) =>
    t.specimens.map((s) => ({
      code: t.code,
      name: t.name,
      synonyms: t.synonyms.join(LIST_SEP),
      department: departments.find((d) => d.id === t.departmentId)?.name ?? '',
      transportNotes: t.transportNotes,
      tatRoutine: dur(t.tatRoutine),
      tatUrgent: dur(t.tatUrgent),
      daysPerformed: t.daysPerformed,
      description: t.description,
      patientPrep: t.patientPrep,
      suggestions: t.suggestions.join(LIST_SEP),
      rejectionCriteria: t.rejectionCriteria.join(LIST_SEP),
      status: t.status,
      sampleRole: s.role,
      sampleType: s.sampleType,
      volume: String(s.volume),
      volumeUnit: s.volumeUnit,
      minVolume: s.minVolume == null ? '' : String(s.minVolume),
      paedVolume: s.paedVolume == null ? '' : String(s.paedVolume),
      container: containers.find((c) => c.id === s.containerId)?.name ?? '',
      storageTemp: s.storageTemp,
      stability: s.stability.map((r) => `${r.temp}:${r.value}${r.unit}`).join(LIST_SEP),
      protectFromLight: s.protectFromLight ? 'yes' : 'no',
      sampleNotes: s.notes
    }))
  )
  // BOM so Excel opens UTF-8 (°C, µL, en dashes) correctly.
  return '﻿' + unparse([[...COLUMNS], ...rows.map((r) => COLUMNS.map((c) => r[c]))])
}

function rowToSpecimen(core: LabCore, r: Row): Specimen {
  const conName = (r.container ?? '').trim()
  let con = core.snapshot().containers.find((c) => c.name.toLowerCase() === conName.toLowerCase())
  if (!con && conName) con = core.saveContainer({ id: '', name: conName, capColor: '#B8BEC6', additive: '', size: '', kind: 'other', drawOrder: 99 })

  const temp = (r.storageTemp ?? '').trim().toUpperCase() as StorageTemp
  const stability: StabilityRule[] = list(r.stability ?? '').map((s) => {
    const [t, d] = s.split(':')
    const parsedDur = parseDur(d ?? '')
    const tt = (t ?? '').trim().toUpperCase() as StorageTemp
    if (!parsedDur || !TEMPS.includes(tt)) throw new Error(`invalid stability "${s}" (use e.g. FRIDGE:72h)`)
    return { temp: tt, ...parsedDur }
  })
  const volUnit = (r.volumeUnit ?? 'mL').trim() as VolumeUnit
  return {
    id: uid(),
    role: (r.sampleRole ?? '').trim().toUpperCase() === 'ALTERNATIVE' ? 'ALTERNATIVE' : 'REQUIRED',
    sampleType: r.sampleType ?? '',
    volume: Number(r.volume),
    volumeUnit: VOLUME_UNITS.includes(volUnit) ? volUnit : 'mL',
    minVolume: num(r.minVolume ?? ''),
    paedVolume: num(r.paedVolume ?? ''),
    containerId: con?.id ?? '',
    storageTemp: TEMPS.includes(temp) ? temp : 'ROOM',
    stability,
    protectFromLight: /^(y|yes|true|1)$/i.test((r.protectFromLight ?? '').trim()),
    notes: r.sampleNotes ?? ''
  }
}

export function importCsv(core: LabCore, text: string): ImportResult {
  const [header = [], ...body] = parse(text.replace(/^﻿/, ''))
  const keys = header.map((h) => h.trim())
  const result: ImportResult = { added: 0, updated: 0, errors: [] }

  // Group rows by test code, keeping file order and each row's line number.
  const groups = new Map<string, { line: number; row: Row }[]>()
  body.forEach((cells, i) => {
    const row = Object.fromEntries(keys.map((k, j) => [k, cells[j] ?? ''])) as Row
    const code = (row.code ?? '').trim().toUpperCase()
    groups.set(code, [...(groups.get(code) ?? []), { line: i + 2, row }])
  })

  for (const [code, rows] of groups) {
    const { line, row: r } = rows[0]
    const label = `Row ${line}${code ? ` (${code})` : ''}`
    try {
      const snap = core.snapshot()
      const depName = (r.department ?? '').trim()
      let dep = snap.departments.find((d) => d.name.toLowerCase() === depName.toLowerCase())
      if (!dep && depName) dep = core.saveDepartment({ id: '', name: depName, color: '#5B6472' })

      const tatRoutine = parseDur(r.tatRoutine ?? '')
      if (!tatRoutine) throw new Error(`invalid routine TAT "${r.tatRoutine ?? ''}" (use e.g. 4h, 2d)`)
      const status = (r.status ?? '').trim().toUpperCase()

      const existing: LabTest | undefined = snap.tests.find((t) => t.code === code)
      const input: TestInput = {
        id: existing?.id,
        code,
        name: r.name ?? '',
        synonyms: list(r.synonyms ?? ''),
        departmentId: dep?.id ?? '',
        // Keep existing sample ids so re-importing an unchanged file changes nothing.
        specimens: rows.map((x, j) => ({ ...rowToSpecimen(core, x.row), id: existing?.specimens[j]?.id ?? uid() })),
        transportNotes: r.transportNotes ?? '',
        tatRoutine,
        tatUrgent: parseDur(r.tatUrgent ?? ''),
        daysPerformed: r.daysPerformed ?? '',
        description: r.description ?? '',
        patientPrep: r.patientPrep ?? '',
        suggestions: list(r.suggestions ?? ''),
        rejectionCriteria: list(r.rejectionCriteria ?? ''),
        status: status === 'DRAFT' || status === 'ARCHIVED' ? status : 'PUBLISHED'
      }
      core.saveTest(input, 'imported')
      if (existing) result.updated++
      else result.added++
    } catch (err) {
      result.errors.push(`${label}: ${(err as Error).message}`)
    }
  }
  return result
}
