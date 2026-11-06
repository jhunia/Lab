// Two devices + a simulated Supabase backend that mirrors supabase/schema.sql behaviour.
import { LabCore, createSeedDb } from '../src/shared/core'
import { CloudClient, CloudRefused, cloudConfigError } from '../src/shared/cloud'
import { LogCore, emptyLogFile, sampleAlerts } from '../src/shared/logs'
import { PinThrottle, type Staff } from '../src/shared/staff'
import { identify, pullLogs, pushOutbox } from '../src/shared/teamsync'

let fails = 0
const check = (l: string, ok: boolean, x = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}${x ? '  → ' + x : ''}`)
  if (!ok) fails++
}

import { db, fakeFetch, net } from './fake-supabase'

;(async () => {
  check('rejects service_role key', !!cloudConfigError({ url: 'https://abcd1234.supabase.co', anonKey: 'sb_secret_abcdefghijklmnopqrstuvwxyz1234567890' }))
  check('accepts project URL + anon key', cloudConfigError({ url: 'https://abcd1234.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.sig-abcdefghij' }) === null)

  const cloud = new CloudClient({ url: 'https://abcd1234.supabase.co', anonKey: 'x'.repeat(40) }, fakeFetch as any)
  // Device A (senior's PC) and device B (bench phone)
  const coreA = new LabCore(createSeedDb(), () => {})
  const coreB = new LabCore(createSeedDb(), () => {})
  const logsA = new LogCore(emptyLogFile(), () => {})
  const logsB = new LogCore(emptyLogFile(), () => {})
  const thA = new PinThrottle()
  const thB = new PinThrottle()

  // Bootstrap: first person becomes Senior
  const boss = await cloud.saveStaff(null, { staffNumber: 'SNR-01', name: 'Kofi Senior', phone: '', role: 'TECH', active: true }, '1234')
  check('first staff member becomes Senior', boss.role === 'SENIOR')
  const actor = { staffNumber: 'SNR-01', pin: '1234' }
  const ama = await cloud.saveStaff(actor, { staffNumber: 'LT-014', name: 'Ama Mensah', phone: '0244', role: 'TECH', active: true }, '5678')
  const viewer = await cloud.saveStaff(actor, { staffNumber: 'V-1', name: 'Ward Nurse', phone: '', role: 'VIEWER', active: true }, '1111')
  let refused = false
  try { await cloud.saveStaff({ staffNumber: 'LT-014', pin: '5678' }, { staffNumber: 'X', name: 'X', phone: '', role: 'SENIOR', active: true }, '9999') } catch (e) { refused = e instanceof CloudRefused }
  check('a tech cannot add staff', refused)

  coreA.replaceStaff(await cloud.listStaff())
  coreB.replaceStaff(await cloud.listStaff())
  check('staff list synced to devices (no PIN data)', coreB.snapshot().staff.length === 3 && coreB.snapshot().staff.every((s) => !s.pinCheck))

  // Ama confirms on device B while online → device remembers PIN
  const amaB = coreB.snapshot().staff.find((s) => s.staffNumber === 'LT-014')!
  const r1 = await identify({ staff: amaB, pin: '5678', minRole: 'TECH', core: coreB, cloud, throttle: thB, allowProvisional: true })
  check('tech confirmed online', !r1.provisional && r1.session.name === 'Ama Mensah')
  check('device remembered PIN for offline', !!coreB.snapshot().staff.find((s) => s.id === ama.id)!.pinCheck)

  let wrong = ''
  try { await identify({ staff: amaB, pin: '0000', minRole: 'TECH', core: coreB, cloud, throttle: thB, allowProvisional: true }) } catch (e) { wrong = (e as Error).message }
  check('wrong PIN rejected', wrong === 'Wrong PIN')
  let viewerBlocked = ''
  try { await identify({ staff: coreB.snapshot().staff.find((s) => s.id === viewer.id)!, pin: '1111', minRole: 'TECH', core: coreB, cloud, throttle: thB, allowProvisional: true }) } catch (e) { viewerBlocked = (e as Error).message }
  check('viewer cannot log samples', /Viewers/.test(viewerBlocked))

  // Ama logs a sample OFFLINE on device B
  net.online = false
  const r2 = await identify({ staff: coreB.snapshot().staff.find((s) => s.id === ama.id)!, pin: '5678', minRole: 'TECH', core: coreB, cloud, throttle: thB, allowProvisional: true })
  check('offline: remembered PIN still works', !r2.provisional)
  const tests = coreB.snapshot().tests
  const fbc = tests.find((t) => t.code === 'HAEM-FBC')!
  const ue = tests.find((t) => t.code === 'CHEM-UE')!
  const amaStaff = coreB.snapshot().staff.find((s) => s.id === ama.id)! as Staff
  const log = logsB.create({ labNumber: 'L-2026-0042', tests: [fbc, ue], status: 'RECEIVED', note: '' }, amaStaff, '5678')
  logsB.addEvent(log.id, 'PENDING', 'Analyser down — waiting for engineer', amaStaff, '5678')
  const p0 = await pushOutbox(cloud, logsB)
  check('offline: entries stay queued', p0.offline && logsB.outbox().length === 2)

  // Back online: upload, then retry is harmless
  net.online = true
  const p1 = await pushOutbox(cloud, logsB)
  check('online: queue uploads', p1.uploaded === 2 && logsB.outbox().length === 0, JSON.stringify(p1))
  await cloud.pushEvent('5678', logsB.views()[0].log, logsB.views()[0].events[0])
  check('re-upload creates no duplicates', db.events.length === 2)
  check('stored PINs wiped after upload', logsB.outbox().length === 0)

  // Next shift on device A sees it
  const got = await pullLogs(cloud, logsA)
  const vA = logsA.views()[0]
  check('next shift device pulls the log', got === 2 && vA.log.labNumber === 'L-2026-0042' && vA.status === 'PENDING' && vA.open, `${got} events, status ${vA?.status}`)
  check('timeline shows who and when', vA.events[1].staffName === 'Ama Mensah' && /Analyser down/.test(vA.events[1].note))
  check('pull again adds nothing', (await pullLogs(cloud, logsA)) === 0)

  // Senior on A completes it; B pulls the update
  const kofiA = coreA.snapshot().staff.find((s) => s.id === boss.id)!
  const rk = await identify({ staff: kofiA, pin: '1234', minRole: 'TECH', core: coreA, cloud, throttle: thA, allowProvisional: true })
  logsA.addEvent(vA.log.id, 'COMPLETED', 'Run on backup analyser', kofiA, rk.session.pin)
  await pushOutbox(cloud, logsA)
  await pullLogs(cloud, logsB)
  check('both devices agree it is completed', logsB.views()[0].status === 'COMPLETED' && !logsB.views()[0].open)

  // Provisional entry by someone this device never confirmed, then their PIN changed before upload
  const newbie = await cloud.saveStaff(actor, { staffNumber: 'LT-020', name: 'Yaw New', phone: '', role: 'TECH', active: true }, '2222')
  coreB.replaceStaff(await cloud.listStaff())
  net.online = false
  const yaw = coreB.snapshot().staff.find((s) => s.id === newbie.id)!
  const r3 = await identify({ staff: yaw, pin: '2222', minRole: 'TECH', core: coreB, cloud, throttle: thB, allowProvisional: true })
  check('offline unknown person → provisional', r3.provisional)
  let seniorOffline = ''
  try { await identify({ staff: yaw, pin: '2222', minRole: 'TECH', core: coreB, cloud, throttle: thB, allowProvisional: false }) } catch (e) { seniorOffline = (e as Error).message }
  check('provisional not allowed for protected actions', /No connection/.test(seniorOffline))
  const l2 = logsB.create({ labNumber: 'L-2026-0050', tests: [fbc], status: 'RECEIVED', note: '' }, yaw, '2299') // typo'd PIN
  net.online = true
  const p2 = await pushOutbox(cloud, logsB)
  check('wrong provisional PIN → needs re-confirmation (not lost)', p2.needsPin === 1 && logsB.outbox()[0].item.needsPin && logsB.outbox()[0].item.pin === '', JSON.stringify(p2))
  logsB.reconfirm(logsB.outbox()[0].event.id, '2222')
  const p3 = await pushOutbox(cloud, logsB)
  check('after re-confirming it uploads', p3.uploaded === 1 && logsB.outbox().length === 0)
  void l2

  // Publishing
  const pkg = coreA.exportPackage('Kofi')
  let techPublish = false
  try { await cloud.publish({ staffNumber: 'LT-014', pin: '5678' }, pkg) } catch (e) { techPublish = e instanceof CloudRefused }
  check('tech cannot publish', techPublish)
  await cloud.publish(actor, pkg)
  const latest = await cloud.latestRelease()
  check('senior publishes; devices see new release', latest?.revision === pkg.revision && latest?.testCount === 18)
  const fetched = await cloud.fetchRelease(pkg.revision)
  check('published package excludes staff list', !('staff' in fetched))
  coreB.applyPackage(fetched)
  check('applying a release keeps the device staff list', coreB.snapshot().staff.length === 4)

  // Lockout after 5 wrong PINs
  for (let i = 0; i < 5; i++) await cloud.verifyStaff('LT-014', '0000').catch(() => {})
  let locked = ''
  try { await cloud.verifyStaff('LT-014', '5678') } catch (e) { locked = (e as Error).message }
  check('5 wrong PINs lock the staff number', /Too many/.test(locked))

  // Alerts
  const recv = new Date(Date.now() - 23 * 3600 * 1000).toISOString() // 23 h ago
  const al = sampleAlerts(recv, [fbc])
  check('alerts: FBC stability (24 h RT) is "soon"', al.find((a) => a.kind === 'stability')?.level === 'soon', al.map((a) => a.level + ':' + a.text).join(' | '))
  check('alerts: FBC TAT (2 h) is late', al.find((a) => a.kind === 'tat')?.level === 'late')

  console.log(fails ? `${fails} FAILED` : 'ALL PASSED')
})()
