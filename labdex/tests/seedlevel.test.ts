import { LabCore, createSeedDb } from '../src/shared/core'

let fails = 0
const check = (l: string, ok: boolean, x = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}${x ? '  → ' + x : ''}`)
  if (!ok) fails++
}

// Data already in the v2 format but missing the v2 additions (what the stale preview produced)
const half: any = JSON.parse(JSON.stringify(createSeedDb()))
half.tests = half.tests.filter((t: any) => !['HISTO-BX', 'CYTO-PAP', 'CHEM-CRCL'].includes(t.code))
half.containers = half.containers.filter((c: any) => !['c-formalin', 'c-lbc', 'c-slide', 'c-24h'].includes(c.id))
delete half.seedLevel
const healed = new LabCore(half, () => {})
check('half-upgraded data gets v2 additions', healed.snapshot().tests.some((t) => t.code === 'CYTO-PAP') && healed.snapshot().containers.some((c) => c.id === 'c-formalin'), `${healed.snapshot().tests.length} tests`)

// An editor deletes a built-in test: it must stay deleted after reload…
let saved: any = null
const fresh = new LabCore(createSeedDb(), (db) => (saved = db))
const histo = fresh.snapshot().tests.find((t) => t.code === 'HISTO-BX')!
fresh.setStatus(histo.id, 'ARCHIVED', 'archived')
fresh.deleteTest(histo.id)
const reloaded = new LabCore(JSON.parse(JSON.stringify(saved)), () => {})
check('deleted built-in test stays deleted after reload', !reloaded.snapshot().tests.some((t) => t.code === 'HISTO-BX'))

// …and on every device that syncs the published update.
const pkg = reloaded.exportPackage('Editor')
const receiver = new LabCore(createSeedDb(), () => {})
receiver.applyPackage(JSON.parse(JSON.stringify(pkg)))
check('sync does not re-add a test the editor deleted', !receiver.snapshot().tests.some((t) => t.code === 'HISTO-BX') && receiver.snapshot().tests.length === 17, `${receiver.snapshot().tests.length} tests`)

console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
