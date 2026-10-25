// AUTO-COPIED from labdex/src/shared by `npm run sync-shared`. Do not edit here.
// Staff list ("roster") and PIN identity. There are no accounts or logins: a Senior keeps the
// list of staff, each person confirms who they are with their staff number + personal PIN.
import { sha256Hex } from './sha256'

export type StaffRole = 'VIEWER' | 'TECH' | 'SENIOR'

export const ROLE_LABEL: Record<StaffRole, string> = { VIEWER: 'Viewer', TECH: 'Lab tech', SENIOR: 'Senior' }
export const ROLE_HINT: Record<StaffRole, string> = {
  VIEWER: 'Can look up tests only',
  TECH: 'Can log samples and updates',
  SENIOR: 'Can also edit tests, publish updates and manage staff'
}
const RANK: Record<StaffRole, number> = { VIEWER: 0, TECH: 1, SENIOR: 2 }

export interface Staff {
  id: string
  staffNumber: string
  name: string
  phone: string
  role: StaffRole
  active: boolean
  /** Device-side PIN check = sha256(salt:pin). Empty when only the cloud knows the PIN. */
  pinSalt: string
  pinCheck: string
  updatedAt: string
}

/** Fields a Senior edits; the PIN is passed separately and never stored as typed. */
export type StaffInput = Pick<Staff, 'staffNumber' | 'name' | 'phone' | 'role' | 'active'> & { id?: string }

/** Who is confirmed on this device right now. Kept in memory only. */
export interface StaffSession {
  staffId: string
  staffNumber: string
  name: string
  role: StaffRole
  /** Epoch ms when the device asks again. */
  until: number
  /** Kept in memory so cloud requests during the session can be authorised; never saved to disk. */
  pin: string
}

/** How long a confirmed person stays "on" a shared device. */
export const SESSION_MS = 5 * 60 * 1000

export const hasRole = (role: StaffRole, min: StaffRole) => RANK[role] >= RANK[min]

export const PIN_PATTERN = /^\d{4,6}$/

export function pinError(pin: string): string | null {
  return PIN_PATTERN.test(pin) ? null : 'PIN must be 4–6 digits'
}

export function makePinCheck(salt: string, pin: string): string {
  return sha256Hex(`labdex-pin:${salt}:${pin}`)
}

export function newSalt(): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += Math.random().toString(36).slice(2, 10)
  return s
}

/** true/false when this device can check the PIN; null when it can't (cloud must confirm). */
export function checkPinLocally(s: Pick<Staff, 'pinSalt' | 'pinCheck'>, pin: string): boolean | null {
  if (!s.pinSalt || !s.pinCheck) return null
  return makePinCheck(s.pinSalt, pin) === s.pinCheck
}

export function validateStaff(input: StaffInput, existing: Staff[], pin: string | null, isNew: boolean): string | null {
  const num = input.staffNumber.trim()
  if (!input.name.trim()) return 'Name is required'
  if (!num) return 'Staff number is required'
  if (!/^[A-Za-z0-9-]{1,20}$/.test(num)) return 'Staff number: letters, digits and dashes only (max 20)'
  if (existing.some((s) => s.staffNumber.toLowerCase() === num.toLowerCase() && s.id !== input.id)) return `Staff number ${num} is already used`
  if (isNew && !pin) return 'Set a PIN for the new staff member'
  if (pin) return pinError(pin)
  return null
}

/** Brute-force brake for PIN entry on this device: 5 wrong tries → wait 1 minute. */
export class PinThrottle {
  private fails = new Map<string, { count: number; until: number }>()

  check(staffId: string): string | null {
    const f = this.fails.get(staffId)
    if (f && f.until > Date.now()) return `Too many wrong PINs. Try again in ${Math.ceil((f.until - Date.now()) / 1000)} s.`
    return null
  }

  fail(staffId: string): void {
    const f = this.fails.get(staffId) ?? { count: 0, until: 0 }
    f.count += 1
    if (f.count >= 5) {
      f.until = Date.now() + 60_000
      f.count = 0
    }
    this.fails.set(staffId, f)
  }

  ok(staffId: string): void {
    this.fails.delete(staffId)
  }
}
