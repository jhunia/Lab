// AUTO-COPIED from labdex/src/shared by `npm run sync-shared`. Do not edit here.
// Platform-neutral data engine shared by the desktop (Electron) and mobile (Expo) apps.
// Persistence is injected, so this file has no Node, browser or React Native imports.
import type { Container, Department, HistoryAction, HistoryEntry, LabTest, TestInput } from './types'
import { diffTests, validateTest } from './validate'
import { buildSeedTests, seedContainers, seedDepartments } from './seed'
import { migrateHistory, migrateTest, type LegacySampleFields } from './migrate'
import { hasRole, makePinCheck, newSalt, validateStaff, type Staff, type StaffInput } from './staff'

export interface DbFile {
  schemaVersion: 2
  /** Revision of the update file this data came from or was published as (0 = local only). */
  revision: number
  /** Hash of the admin PIN needed to switch a device to Editor ('' = no PIN set). */
  editorPinHash: string
  /** Which built-in additions this directory has received (2 = v2 samples/tests). Missing = 1. */
  seedLevel?: number
  tests: LabTest[]
  containers: Container[]
  departments: Department[]
  history: HistoryEntry[]
  /** Staff list. In cloud mode this is a cache of the cloud list (without PIN data). */
  staff: Staff[]
}

/** The update file an editor publishes and every other device syncs from. */
export interface UpdatePackage {
  format: 'labdex-update'
  formatVersion: 2
  revision: number
  publishedAt: string
  publishedBy: string
  editorPinHash: string
  tests: LabTest[]
  containers: Container[]
  departments: Department[]
  history: HistoryEntry[]
  /** Staff list travels with update files (update-file mode only; the cloud keeps its own). */
  staff?: Staff[]
}

/** Keep at most this many history entries per test. */
const HISTORY_LIMIT = 50

export function uid(): string {
  const r = () => Math.random().toString(16).slice(2, 10).padEnd(8, '0')
  return `${r()}-${r().slice(0, 4)}-${r().slice(0, 4)}-${r().slice(0, 4)}-${r()}${r().slice(0, 4)}`
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Small non-cryptographic hash (cyrb53). The editor PIN is a speed bump, not real security. */
export function hashPin(pin: string): string {
  let h1 = 0xdeadbeef ^ 7
  let h2 = 0x41c6ce57 ^ 7
  for (const ch of `labdex:${pin}`) {
    const c = ch.charCodeAt(0)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/** Brings any saved database (v1 or v2) up to the current shape. */
export function migrateDb(raw: unknown): DbFile {
  const d = raw as Omit<Partial<DbFile>, 'schemaVersion'> & { schemaVersion?: number }
  const db: DbFile = {
    schemaVersion: 2,
    revision: d.revision ?? 0,
    editorPinHash: d.editorPinHash ?? '',
    seedLevel: d.seedLevel ?? 1,
    tests: (d.tests ?? []).map((t) => migrateTest(t as LabTest & LegacySampleFields)),
    containers: d.containers ?? clone(seedContainers),
    departments: d.departments ?? clone(seedDepartments),
    history: (d.history ?? []).map(migrateHistory),
    staff: d.staff ?? []
  }
  // Keyed on its own marker (not the schema version) so it still runs if an earlier
  // upgrade converted the format without adding these.
  if ((db.seedLevel ?? 1) < SEED_LEVEL) {
    addV2Additions(db)
    db.seedLevel = SEED_LEVEL
  }
  return db
}

/** Current level of built-in additions; bump when new built-in containers/tests ship. */
const SEED_LEVEL = 2

/** Tests introduced with v2. Added once to directories upgraded from v1 (if their codes are free). */
const V2_TEST_CODES = ['HISTO-BX', 'CYTO-PAP', 'CHEM-CRCL']

function addV2Additions(db: DbFile): void {
  for (const c of seedContainers) if (!db.containers.some((x) => x.id === c.id)) db.containers.push(clone(c))
  for (const dep of seedDepartments) if (!db.departments.some((x) => x.id === dep.id)) db.departments.push(clone(dep))
  for (const t of buildSeedTests().filter((x) => V2_TEST_CODES.includes(x.code))) {
    if (db.tests.some((x) => x.code === t.code || x.id === t.id)) continue
    db.tests.push(t)
    db.history.push({ id: uid(), testId: t.id, version: 1, action: 'created', at: t.updatedAt, changes: [], snapshot: clone(t) })
  }
}

/** Parses an update file, throwing a readable error if it isn't one. */
export function parsePackage(text: string): UpdatePackage {
  let p: Partial<UpdatePackage>
  try {
    p = JSON.parse(text.replace(/^\uFEFF/, '')) as Partial<UpdatePackage>
  } catch {
    throw new Error('This is not a LabDex update file (it is not valid JSON)')
  }
  if (p.format !== 'labdex-update' || !Array.isArray(p.tests)) throw new Error('This is not a LabDex update file')
  if ((p.formatVersion ?? 0) > 2) throw new Error('This update was made by a newer LabDex. Update the app first.')
  return p as UpdatePackage
}

export function createSeedDb(): DbFile {
  const tests = buildSeedTests()
  return {
    schemaVersion: 2,
    revision: 0,
    editorPinHash: '',
    seedLevel: SEED_LEVEL,
    tests,
    containers: clone(seedContainers),
    departments: clone(seedDepartments),
    history: tests.map((t) => ({ id: uid(), testId: t.id, version: 1, action: 'created', at: t.updatedAt, changes: [], snapshot: clone(t) })),
    staff: []
  }
}

export class LabCore {
  private db: DbFile

  constructor(
    db: DbFile | unknown,
    private readonly persist: (db: DbFile) => void
  ) {
    const before = JSON.stringify(db)
    this.db = migrateDb(db)
    if (JSON.stringify(this.db) !== before) this.persist(this.db)
  }

  private save(): void {
    this.persist(this.db)
  }

  private record(t: LabTest, action: HistoryAction, changes: string[]): void {
    this.db.history.push({ id: uid(), testId: t.id, version: t.version, action, at: t.updatedAt, changes, snapshot: clone(t) })
    const mine = this.db.history.filter((h) => h.testId === t.id)
    if (mine.length > HISTORY_LIMIT) {
      const drop = new Set(mine.slice(0, mine.length - HISTORY_LIMIT).map((h) => h.id))
      this.db.history = this.db.history.filter((h) => !drop.has(h.id))
    }
  }

  private find(id: string): LabTest {
    const t = this.db.tests.find((x) => x.id === id)
    if (!t) throw new Error('Test not found')
    return t
  }

  snapshot() {
    return {
      tests: this.db.tests,
      containers: this.db.containers,
      departments: this.db.departments,
      revision: this.db.revision,
      editorPinSet: this.db.editorPinHash !== '',
      staff: this.db.staff
    }
  }

  // ---------- Staff list (local / update-file mode) ----------

  findStaff(staffNumber: string): Staff | undefined {
    const n = staffNumber.trim().toLowerCase()
    return this.db.staff.find((x) => x.staffNumber.toLowerCase() === n)
  }

  /** Adds or edits a staff member. `pin` is required for new staff, optional otherwise. */
  saveStaff(input: StaffInput, pin: string | null): Staff {
    const isNew = !input.id
    const err = validateStaff(input, this.db.staff, pin, isNew)
    if (err) throw new Error(err)
    const prev = this.db.staff.find((x) => x.id === input.id)
    const seniorsLeft = this.db.staff.filter((x) => x.active && x.role === 'SENIOR' && x.id !== input.id).length
    if (prev && prev.role === 'SENIOR' && (!input.active || !hasRole(input.role, 'SENIOR')) && seniorsLeft === 0) {
      throw new Error('Keep at least one active Senior — otherwise nobody can manage staff or edit tests')
    }
    const salt = pin ? newSalt() : (prev?.pinSalt ?? '')
    const item: Staff = {
      id: prev?.id ?? uid(),
      staffNumber: input.staffNumber.trim(),
      name: input.name.trim(),
      phone: input.phone.trim(),
      role: input.role,
      active: input.active,
      pinSalt: salt,
      pinCheck: pin ? makePinCheck(salt, pin) : (prev?.pinCheck ?? ''),
      updatedAt: new Date().toISOString()
    }
    this.db.staff = prev ? this.db.staff.map((x) => (x.id === item.id ? item : x)) : [...this.db.staff, item]
    this.save()
    return item
  }

  /** Replaces the cached staff list with the cloud's (keeping PIN checks this device already knows). */
  replaceStaff(list: Staff[]): void {
    const known = new Map(this.db.staff.map((x) => [x.id, x]))
    this.db.staff = list.map((x) => {
      const k = known.get(x.id)
      return k && !x.pinCheck ? { ...x, pinSalt: k.pinSalt, pinCheck: k.pinCheck } : x
    })
    this.save()
  }

  /** Remembers a PIN the cloud just confirmed, so this device can check it offline next time. */
  rememberPin(staffId: string, pin: string): void {
    const salt = newSalt()
    this.db.staff = this.db.staff.map((x) => (x.id === staffId ? { ...x, pinSalt: salt, pinCheck: makePinCheck(salt, pin) } : x))
    this.save()
  }

  // ---------- Sync (update file) ----------

  checkPin(pin: string): boolean {
    return this.db.editorPinHash === '' || hashPin(pin) === this.db.editorPinHash
  }

  setEditorPin(pin: string): void {
    if (pin && !/^\d{4,8}$/.test(pin)) throw new Error('PIN must be 4–8 digits')
    this.db.editorPinHash = pin ? hashPin(pin) : ''
    this.save()
  }

  /** Builds the update file and stamps this database with its revision. */
  exportPackage(publishedBy: string): UpdatePackage {
    const revision = Math.max(Date.now(), this.db.revision + 1)
    this.db.revision = revision
    this.save()
    return {
      format: 'labdex-update',
      formatVersion: 2,
      revision,
      publishedAt: new Date(revision).toISOString(),
      publishedBy: publishedBy.trim() || 'LabDex',
      editorPinHash: this.db.editorPinHash,
      tests: this.db.tests,
      containers: this.db.containers,
      departments: this.db.departments,
      history: this.db.history,
      staff: this.db.staff
    }
  }

  /** Replaces the local directory with an update file's contents. */
  applyPackage(pkg: UpdatePackage): { revision: number; tests: number } {
    // A published update is already complete — never add built-in tests the editor removed.
    const next = migrateDb({ ...pkg, schemaVersion: 2, seedLevel: SEED_LEVEL })
    this.db = { ...next, revision: pkg.revision, editorPinHash: pkg.editorPinHash ?? '', seedLevel: SEED_LEVEL, staff: pkg.staff ?? this.db.staff }
    this.save()
    return { revision: pkg.revision, tests: this.db.tests.length }
  }

  saveTest(input: TestInput, action: HistoryAction = 'updated'): LabTest {
    const clean: TestInput = {
      ...input,
      code: input.code.trim().toUpperCase(),
      name: input.name.trim(),
      specimens: input.specimens.map((s) => ({ ...s, id: s.id || uid(), sampleType: s.sampleType.trim() }))
    }
    const errors = validateTest(clean, this.db.tests)
    const first = Object.values(errors)[0]
    if (first) throw new Error(first)

    const now = new Date().toISOString()
    if (clean.id) {
      const prev = this.find(clean.id)
      const next: LabTest = { ...prev, ...clean, id: prev.id, createdAt: prev.createdAt, updatedAt: now, version: prev.version + 1 }
      const changes = diffTests(prev, next)
      if (changes.length === 0) return prev
      this.db.tests = this.db.tests.map((t) => (t.id === prev.id ? next : t))
      this.record(next, action, changes)
      this.save()
      return next
    }
    const created: LabTest = { ...clean, id: uid(), version: 1, createdAt: now, updatedAt: now }
    this.db.tests.push(created)
    this.record(created, action === 'imported' ? 'imported' : 'created', [])
    this.save()
    return created
  }

  setStatus(id: string, status: LabTest['status'], action: HistoryAction): LabTest {
    const prev = this.find(id)
    const next: LabTest = { ...prev, status, version: prev.version + 1, updatedAt: new Date().toISOString() }
    this.db.tests = this.db.tests.map((t) => (t.id === id ? next : t))
    this.record(next, action, ['Status'])
    this.save()
    return next
  }

  archiveTest(id: string): LabTest {
    return this.setStatus(id, 'ARCHIVED', 'archived')
  }

  restoreTest(id: string): LabTest {
    return this.setStatus(id, 'PUBLISHED', 'restored')
  }

  /** Permanent delete is only allowed for archived tests. */
  deleteTest(id: string): void {
    const t = this.find(id)
    if (t.status !== 'ARCHIVED') throw new Error('Archive the test before deleting it permanently')
    this.db.tests = this.db.tests.filter((x) => x.id !== id)
    this.db.history = this.db.history.filter((h) => h.testId !== id)
    this.save()
  }

  history(testId: string): HistoryEntry[] {
    return this.db.history.filter((h) => h.testId === testId).sort((a, b) => b.version - a.version)
  }

  revertTo(historyId: string): LabTest {
    const h = this.db.history.find((x) => x.id === historyId)
    if (!h) throw new Error('Version not found')
    const { version: _v, createdAt: _c, updatedAt: _u, ...rest } = h.snapshot
    return this.saveTest(rest, 'reverted')
  }

  saveContainer(c: Container): Container {
    if (!c.name.trim()) throw new Error('Container name is required')
    const item = { ...c, id: c.id || uid(), name: c.name.trim() }
    const exists = this.db.containers.some((x) => x.id === item.id)
    this.db.containers = exists ? this.db.containers.map((x) => (x.id === item.id ? item : x)) : [...this.db.containers, item]
    this.save()
    return item
  }

  deleteContainer(id: string): void {
    const used = this.db.tests.filter((t) => t.specimens.some((s) => s.containerId === id)).length
    if (used) throw new Error(`Container is used by ${used} test${used > 1 ? 's' : ''}`)
    this.db.containers = this.db.containers.filter((x) => x.id !== id)
    this.save()
  }

  saveDepartment(d: Department): Department {
    if (!d.name.trim()) throw new Error('Department name is required')
    const item = { ...d, id: d.id || uid(), name: d.name.trim() }
    const exists = this.db.departments.some((x) => x.id === item.id)
    this.db.departments = exists ? this.db.departments.map((x) => (x.id === item.id ? item : x)) : [...this.db.departments, item]
    this.save()
    return item
  }

  deleteDepartment(id: string): void {
    const used = this.db.tests.filter((t) => t.departmentId === id).length
    if (used) throw new Error(`Department is used by ${used} test${used > 1 ? 's' : ''}`)
    this.db.departments = this.db.departments.filter((x) => x.id !== id)
    this.save()
  }
}
