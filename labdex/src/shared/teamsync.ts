// Coordination shared by desktop and mobile: confirming who someone is (cloud when online,
// this device when offline), uploading queued sample-log entries, and pulling everyone else's.
import { CloudClient, CloudRefused } from './cloud'
import type { LabCore } from './core'
import type { LogCore } from './logs'
import { SESSION_MS, checkPinLocally, hasRole, type PinThrottle, type Staff, type StaffRole, type StaffSession } from './staff'

export interface IdentifyResult {
  session: StaffSession
  /** True when the cloud couldn't be reached and the device accepted the PIN on trust; the cloud checks it on upload. */
  provisional: boolean
}

/**
 * Confirms a person by staff record + PIN.
 * - Cloud mode, online: the cloud checks the PIN (and the device remembers it for offline use).
 * - Offline / no cloud: the device checks it against what it knows. In cloud mode a person this
 *   device has never confirmed can still log samples ("provisional"); the cloud verifies on upload.
 */
export async function identify(opts: {
  staff: Staff
  pin: string
  minRole: StaffRole
  core: LabCore
  cloud: CloudClient | null
  throttle: PinThrottle
  /** Allow provisional (unverified) offline confirmation — only for logging samples. */
  allowProvisional: boolean
}): Promise<IdentifyResult> {
  const { staff, pin, minRole, core, cloud, throttle } = opts
  const wait = throttle.check(staff.id)
  if (wait) throw new Error(wait)
  if (!staff.active) throw new Error(`${staff.name} is marked inactive`)
  if (!hasRole(staff.role, minRole)) throw new Error(minRole === 'SENIOR' ? 'Only a Senior can do this' : 'Viewers cannot log samples')

  const session = (s: Staff): StaffSession => ({ staffId: s.id, staffNumber: s.staffNumber, name: s.name, role: s.role, until: Date.now() + SESSION_MS, pin })

  if (cloud) {
    try {
      const fresh = await cloud.verifyStaff(staff.staffNumber, pin)
      throttle.ok(staff.id)
      core.rememberPin(fresh.id, pin)
      if (!hasRole(fresh.role, minRole)) throw new Error('Your role no longer allows this')
      return { session: session(fresh), provisional: false }
    } catch (e) {
      if (e instanceof CloudRefused) {
        if (e.wrongPin) throttle.fail(staff.id)
        throw e
      }
      // Network problem → fall through to the offline check.
    }
  }

  const local = checkPinLocally(staff, pin)
  if (local === true) {
    throttle.ok(staff.id)
    return { session: session(staff), provisional: false }
  }
  if (local === false) {
    throttle.fail(staff.id)
    throw new Error('Wrong PIN')
  }
  if (cloud && opts.allowProvisional) return { session: session(staff), provisional: true }
  throw new Error(cloud ? 'No connection, and this device has not confirmed your PIN before. Connect once, then it works offline.' : 'No PIN is set for this person — ask a Senior to set one')
}

export interface PushResult {
  uploaded: number
  needsPin: number
  failed: number
  offline: boolean
}

/** Uploads queued sample-log entries. Stops at the first network error (keeps the rest queued). */
export async function pushOutbox(cloud: CloudClient, logs: LogCore): Promise<PushResult> {
  const r: PushResult = { uploaded: 0, needsPin: 0, failed: 0, offline: false }
  for (const { item, event, log } of logs.outbox()) {
    if (item.needsPin || !item.pin) {
      r.needsPin++
      continue
    }
    try {
      await cloud.pushEvent(item.pin, log, event)
      logs.markUploaded(event.id)
      r.uploaded++
    } catch (e) {
      if (e instanceof CloudRefused) {
        logs.markFailed(event.id, e.message, e.wrongPin)
        if (e.wrongPin) r.needsPin++
        else r.failed++
      } else {
        r.offline = true
        break
      }
    }
  }
  return r
}

/** Pulls sample-log entries uploaded by other devices. Returns how many new entries arrived. */
export async function pullLogs(cloud: CloudClient, logs: LogCore): Promise<number> {
  let added = 0
  for (let guard = 0; guard < 50; guard++) {
    const page = await cloud.pullEvents(logs.pulledSeq)
    added += logs.merge(page.logs, page.events, page.lastSeq)
    if (page.events.length < 500) break
  }
  return added
}

export const sessionValid = (s: StaffSession | null): s is StaffSession => !!s && s.until > Date.now()
