// Offline use and automatic test updates, as the phone app runs them: a phone works with no internet
// (also after a restart), picks up a Senior's published update by itself once it is back online, and
// never silently replaces a Senior's own unpublished edits.
import { LabCore, createSeedDb, migrateDb } from '../src/shared/core'
import { CloudClient } from '../src/shared/cloud'
import { fakeFetch, net } from './fake-supabase'

let fails = 0
const check = (l: string, ok: boolean, x = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}${x ? '  → ' + x : ''}`)
  if (!ok) fails++
}

const cloud = new CloudClient({ url: 'https://abcd1234.supabase.co', anonKey: 'x'.repeat(40) }, fakeFetch as never)

/** The minute-by-minute check in the app (data.tsx): apply a newer release unless this phone has unpublished edits. */
async function autoUpdate(core: LabCore): Promise<'offline' | 'up-to-date' | 'kept-banner' | 'applied'> {
  let rel
  try {
    rel = await cloud.latestRelease()
  } catch {
    return 'offline'
  }
  if (!rel || rel.revision <= core.snapshot().revision) return 'up-to-date'
  if (core.hasUnpublishedEdits()) return 'kept-banner'
  core.applyPackage(await cloud.fetchRelease(rel.revision))
  return 'applied'
}

/** A phone whose storage survives restarts (like AsyncStorage). */
function phone() {
  let disk = JSON.stringify(createSeedDb())
  return { open: () => new LabCore(migrateDb(JSON.parse(disk)), (d) => (disk = JSON.stringify(d))) }
}

const nameOf = (core: LabCore, code: string) => core.snapshot().tests.find((t) => t.code === code)?.name
const tick = () => new Promise((r) => setTimeout(r, 5))

;(async () => {
  await cloud.saveStaff(null, { staffNumber: 'LT01', name: 'jnr', phone: '', role: 'TECH', active: true }, '1234')
  const senior = { staffNumber: 'LT01', pin: '1234' }

  // ---- A tech's phone, first opened with no internet ----
  net.online = false
  const techPhone = phone()
  let tech = techPhone.open()
  check('offline first launch: the test directory is there', tech.snapshot().tests.length === 18)
  check('offline: the update check fails quietly', (await autoUpdate(tech)) === 'offline')

  // ---- A Senior edits a test and publishes ----
  net.online = true
  const seniorPhone = phone()
  let snr = seniorPhone.open()
  const fbg = snr.snapshot().tests.find((t) => t.code === 'CHEM-FBG')!
  snr.saveTest({ ...fbg, name: 'Fasting Glucose (NEW NAME)' })
  check('the Senior’s edit counts as unpublished', snr.hasUnpublishedEdits())
  await cloud.publish(senior, snr.exportPackage('jnr'))
  check('after publishing: nothing unpublished', !snr.hasUnpublishedEdits())

  // ---- The tech phone is still offline ----
  net.online = false
  check('still offline: keeps working on its own copy', (await autoUpdate(tech)) === 'offline' && nameOf(tech, 'CHEM-FBG') === 'Fasting Blood Glucose')

  // ---- Internet comes back ----
  net.online = true
  check('back online: the update is applied by itself', (await autoUpdate(tech)) === 'applied')
  check('the tech now sees the Senior’s change', nameOf(tech, 'CHEM-FBG') === 'Fasting Glucose (NEW NAME)')
  check('the next check does nothing (already current)', (await autoUpdate(tech)) === 'up-to-date')

  // ---- Restart the tech phone with no internet ----
  net.online = false
  tech = techPhone.open()
  check('restarted offline: the update is still there', nameOf(tech, 'CHEM-FBG') === 'Fasting Glucose (NEW NAME)')

  // ---- A Senior mid-edit is not overwritten by a newer publish from someone else ----
  net.online = true
  const second = phone().open()
  second.applyPackage(await cloud.fetchRelease((await cloud.latestRelease())!.revision))
  const ue = second.snapshot().tests.find((t) => t.code === 'CHEM-UE')!
  second.saveTest({ ...ue, name: 'U&E (second Senior)' })
  await tick()
  await cloud.publish(senior, second.exportPackage('second Senior'))
  snr = seniorPhone.open()
  const ca = snr.snapshot().containers[0]
  snr.saveContainer({ ...ca, name: `${ca.name} (unpublished)` })
  check('a container edit counts as unpublished', snr.hasUnpublishedEdits())
  check('Senior with unpublished edits: update NOT applied (banner instead)', (await autoUpdate(snr)) === 'kept-banner')
  check('…and their edit is untouched', snr.snapshot().containers[0].name.endsWith('(unpublished)'))
  check('the unpublished flag survives a restart', seniorPhone.open().hasUnpublishedEdits())
  check('meanwhile the tech gets the second Senior’s update', (await autoUpdate(tech)) === 'applied' && nameOf(tech, 'CHEM-UE') === 'U&E (second Senior)')

  // ---- Deleting a test is an edit too ----
  const d = phone().open()
  d.applyPackage(await cloud.fetchRelease((await cloud.latestRelease())!.revision))
  check('freshly updated phone: nothing unpublished', !d.hasUnpublishedEdits())
  const hvs = d.snapshot().tests.find((t) => t.code === 'MICRO-HVS')!
  d.archiveTest(hvs.id)
  d.deleteTest(hvs.id)
  check('deleting a test counts as unpublished', d.hasUnpublishedEdits())

  console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
})()
