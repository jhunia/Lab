// AUTO-COPIED from labdex/src/shared by `npm run sync-shared`. Do not edit here.
import { toMinutes, type LabTest, type TestInput } from './types'

export type FieldErrors = Partial<Record<string, string>>

export const CODE_PATTERN = /^[A-Z0-9-]{2,20}$/
export const DESCRIPTION_MAX = 300

/** Error keys: top-level field names, or `specimens.<i>.<field>` / `specimens.<i>.stability.<j>`. */
export function validateTest(input: TestInput, existing: LabTest[]): FieldErrors {
  const e: FieldErrors = {}
  const code = input.code.trim()

  if (!code) e.code = 'Test code is required'
  else if (!CODE_PATTERN.test(code)) e.code = 'Use 2–20 uppercase letters, digits or dashes'
  else if (existing.some((t) => t.code === code && t.id !== input.id)) e.code = `Code ${code} is already in use`

  const name = input.name.trim()
  if (!name) e.name = 'Test name is required'
  else if (name.length > 120) e.name = 'Keep the name under 120 characters'

  if (!input.departmentId) e.departmentId = 'Pick a department'

  if (input.specimens.length === 0) e.specimens = 'Add at least one sample'
  input.specimens.forEach((s, i) => {
    const n = input.specimens.length > 1 ? `Sample ${i + 1}: ` : ''
    const k = (f: string) => `specimens.${i}.${f}`
    if (!s.sampleType.trim()) e[k('sampleType')] = `${n}sample type is required`
    if (!s.containerId) e[k('containerId')] = `${n}pick a container`
    if (!(s.volume > 0)) e[k('volume')] = `${n}volume must be greater than 0`
    if (s.minVolume != null) {
      if (s.minVolume <= 0) e[k('minVolume')] = `${n}minimum must be greater than 0`
      else if (s.minVolume > s.volume) e[k('minVolume')] = `${n}minimum cannot exceed the standard volume`
    }
    if (s.paedVolume != null && s.paedVolume <= 0) e[k('paedVolume')] = `${n}paediatric volume must be greater than 0`
    s.stability.forEach((r, j) => {
      if (!(r.value > 0)) e[`specimens.${i}.stability.${j}`] = `${n}stability duration must be greater than 0`
    })
  })
  const alternatives = input.specimens.filter((s) => s.role === 'ALTERNATIVE').length
  if (alternatives === 1) e.specimens = 'Mark at least two samples as alternatives, or make the single one required'

  if (!(input.tatRoutine.value > 0)) e.tatRoutine = 'Routine TAT must be greater than 0'
  if (input.tatUrgent) {
    if (!(input.tatUrgent.value > 0)) e.tatUrgent = 'Urgent TAT must be greater than 0'
    else if (toMinutes(input.tatUrgent) > toMinutes(input.tatRoutine)) e.tatUrgent = 'Urgent TAT should not be longer than routine'
  }

  if (input.description.length > DESCRIPTION_MAX) e.description = `Keep it brief — max ${DESCRIPTION_MAX} characters`

  return e
}

/** Human-readable list of which fields differ between two versions. */
export function diffTests(a: LabTest, b: LabTest): string[] {
  const labels: Partial<Record<keyof LabTest, string>> = {
    code: 'Code',
    name: 'Name',
    synonyms: 'Synonyms',
    departmentId: 'Department',
    specimens: 'Samples',
    transportNotes: 'Transport notes',
    tatRoutine: 'Routine TAT',
    tatUrgent: 'Urgent TAT',
    daysPerformed: 'Days performed',
    description: 'Description',
    patientPrep: 'Patient preparation',
    suggestions: 'Suggestions',
    rejectionCriteria: 'Rejection criteria',
    status: 'Status'
  }
  return (Object.keys(labels) as (keyof LabTest)[])
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => labels[k]!)
}
