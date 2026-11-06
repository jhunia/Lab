import { LabCore, createSeedDb, parsePackage } from '../src/shared/core'
import { toCsv, importCsv } from '../src/shared/csv'
import { searchTests } from '../src/shared/search'
import { planCollection } from '../src/shared/helpers'
import { validateTest } from '../src/shared/validate'

let fails = 0
const check = (label: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  → ' + extra : ''}`)
  if (!ok) fails++
}

// 1. Migration from a v1 database (one sample on the test itself)
const v1 = {
  schemaVersion: 1,
  tests: [{ id: 'x1', code: 'OLD-1', name: 'Old Test', synonyms: [], departmentId: 'd-chem', sampleType: 'Serum', volume: 3, volumeUnit: 'mL', minVolume: 1, paedVolume: null, containerId: 'c-gold', storageTemp: 'FRIDGE', stability: [{ temp: 'FRIDGE', value: 2, unit: 'd' }], protectFromLight: true, transportNotes: '', tatRoutine: { value: 4, unit: 'h' }, tatUrgent: null, daysPerformed: '', description: '', patientPrep: '', suggestions: [], rejectionCriteria: [], status: 'PUBLISHED', version: 3, createdAt: '2026-01-01', updatedAt: '2026-01-02' }],
  containers: [], departments: [], history: []
}
let persisted: any = null
const m = new LabCore(v1, (db) => (persisted = db))
const mt = m.snapshot().tests[0] as any
check('v1 test migrated to specimens', mt.specimens?.length === 1 && mt.specimens[0].sampleType === 'Serum' && mt.specimens[0].protectFromLight === true && mt.specimens[0].minVolume === 1)
check('legacy fields removed', !('sampleType' in mt) && !('containerId' in mt))
check('migration persisted as schema 2', persisted?.schemaVersion === 2)
check('version kept', mt.version === 3)

// 2. Seed + validation
const core = new LabCore(createSeedDb(), () => {})
const tests = core.snapshot().tests
const deps = core.snapshot().departments
check('18 seed tests', tests.length === 18, String(tests.length))
const pap = tests.find((t) => t.code === 'CYTO-PAP')!
check('PAP has 2 alternative samples', pap.specimens.length === 2 && pap.specimens.every((s) => s.role === 'ALTERNATIVE'))
check('all seeds valid', tests.every((t) => Object.keys(validateTest(t, tests)).length === 0), tests.filter((t) => Object.keys(validateTest(t, tests)).length).map((t) => t.code + JSON.stringify(validateTest(t, tests))).join(';'))
const bad = { ...pap, id: undefined, code: 'NEW-1', specimens: [{ ...pap.specimens[0], sampleType: '', volume: 0 }] }
const errs = validateTest(bad as any, tests)
check('validation catches bad sample + lone alternative', !!errs['specimens.0.sampleType'] && !!errs['specimens.0.volume'] && !!errs.specimens, JSON.stringify(errs))

// 3. Search
const S = (q: string) => searchTests(tests, q, { departments: deps }).map((t) => t.code)
const cases: [string, (r: string[]) => boolean][] = [
  ['fbc', (r) => r[0] === 'HAEM-FBC'],
  ['cbc', (r) => r[0] === 'HAEM-FBC'],
  ['haem-fbc', (r) => r[0] === 'HAEM-FBC'],
  ['full blood', (r) => r[0] === 'HAEM-FBC'],
  ['hae', (r) => r.includes('CHEM-HBA1C')],
  ['glucoze', (r) => r[0] === 'CHEM-FBG'],
  ['hemoglobin', (r) => r[0] === 'CHEM-HBA1C'],
  ['pap', (r) => r[0] === 'CYTO-PAP'],
  ['biopsy', (r) => r[0] === 'HISTO-BX'],
  ['histo', (r) => r[0] === 'HISTO-BX'],
  ['inr', (r) => r[0] === 'COAG-PT' && r.length <= 2],
  ['u&e', (r) => r[0] === 'CHEM-UE'],
  ['creat', (r) => r[0] === 'CHEM-CRCL'],
  ['urine', (r) => r.includes('MICRO-UCS') && r.includes('CHEM-CRCL')],
  ['xyzzy', (r) => r.length === 0],
  ['blood culture', (r) => r[0] === 'MICRO-BC'],
  ['tsh', (r) => r[0] === 'IMM-TSH' && r.length === 1]
]
for (const [q, ok] of cases) {
  const r = S(q)
  check(`search "${q}"`, ok(r), r.slice(0, 4).join(', '))
}

// 4. CSV round trip incl. multi-sample
const csv = toCsv(core)
const db2 = createSeedDb()
db2.tests = []
db2.history = []
const c2 = new LabCore(db2, () => {})
const r1 = importCsv(c2, csv)
check('CSV import all', r1.added === 18 && r1.errors.length === 0, JSON.stringify(r1))
const strip = (t: any) => JSON.stringify({ ...t, id: 0, version: 0, createdAt: 0, updatedAt: 0, specimens: t.specimens.map((s: any) => ({ ...s, id: 0 })) }, Object.keys(t).sort())
const same = tests.every((t) => {
  const u: any = c2.snapshot().tests.find((x) => x.code === t.code)
  return u && JSON.stringify(u.specimens.map((s: any) => ({ ...s, id: 0 }))) === JSON.stringify(t.specimens.map((s: any) => ({ ...s, id: 0 }))) && u.name === t.name && u.tatRoutine.value === t.tatRoutine.value
})
check('CSV round trip preserves samples', same)
const vBefore = c2.snapshot().tests.map((t) => t.version).join()
importCsv(c2, csv)
check('re-import unchanged file = no new versions', c2.snapshot().tests.map((t) => t.version).join() === vBefore)
const v1csv = 'code,name,department,sampleType,volume,container,tatRoutine,storageTemp\nV1-T,V1 Test,Haematology,Whole blood,3,Lavender top,2h,ROOM'
const r3 = importCsv(c2, v1csv)
check('old v1 CSV still imports', r3.added === 1 && r3.errors.length === 0, JSON.stringify(r3))

// 5. Update package
core.setEditorPin('4321')
const pkg = core.exportPackage('Lab Manager')
const text = JSON.stringify(pkg)
const viewer = new LabCore(createSeedDb(), () => {})
const applied = viewer.applyPackage(parsePackage(text))
check('package applied', applied.tests === 18 && viewer.snapshot().revision === pkg.revision)
check('PIN travels with package', viewer.checkPin('4321') && !viewer.checkPin('1111'))
let threw = false
try { parsePackage('{"hello":1}') } catch { threw = true }
check('rejects non-update file', threw)

// 6. Planner
const pick = ['HAEM-FBC', 'CHEM-UE', 'CHEM-LFT', 'CYTO-PAP', 'CHEM-CRCL'].map((c) => tests.find((t) => t.code === c)!)
const con = (id: string) => core.snapshot().containers.find((c) => c.id === id)
const plan = planCollection(pick, con)
check('planner: gold shared by UE+LFT+CrCl serum', plan.blood.find((d) => d.container.id === 'c-gold')?.samples.length === 3)
check('planner: PAP uses preferred LBC with slide alternative', plan.other.some((d) => d.container.id === 'c-lbc' && d.samples[0].alternatives.length === 1))
check('planner: 24h urine included', plan.other.some((d) => d.container.id === 'c-24h'))

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
