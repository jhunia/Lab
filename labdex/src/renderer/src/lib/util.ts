import type { Container, Department, LabTest } from '@shared/types'
import { searchTests } from '@shared/search'

export { blankTest, toInput, duplicateInput, relTime, fmtNum } from '@shared/helpers'

export const api = window.labdex

/** Strip Electron's "Error invoking remote method 'x': Error:" prefix. */
export function errMsg(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export type Lookups = {
  dep: (id: string) => Department | undefined
  con: (id: string) => Container | undefined
  /** Search tests, best match first (shared ranking — same as mobile). */
  search: (tests: LabTest[], query: string) => LabTest[]
}

export function makeLookups(departments: Department[], containers: Container[]): Lookups {
  const d = new Map(departments.map((x) => [x.id, x]))
  const c = new Map(containers.map((x) => [x.id, x]))
  return { dep: (id) => d.get(id), con: (id) => c.get(id), search: (tests, q) => searchTests(tests, q, { departments }) }
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')
