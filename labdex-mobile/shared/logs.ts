// AUTO-COPIED from labdex/src/shared by `npm run sync-shared`. Do not edit here.
// Sample log: lets any lab tech record what happened to a sample (by lab number only — no
// patient names, no results) so the next shift can pick it up. Works offline: every update is
// an event saved on the device first and uploaded to the cloud later. Events are never edited,
// so two techs working offline can't overwrite each other.
import { toMinutes, type LabTest, type TimeUnit } from './types'
import { uid } from './core'
import type { Staff } from './staff'

export type SampleStatus = 'RECEIVED' | 'IN_PROGRESS' | 'PENDING' | 'SENT_OUT' | 'COMPLETED' | 'REJECTED'

export const STATUS_ORDER: SampleStatus[] = ['RECEIVED', 'IN_PROGRESS', 'PENDING', 'SENT_OUT', 'COMPLETED', 'REJECTED']

export const STATUS_META: Record<SampleStatus, { label: string; hint: string; closed: boolean }> = {
  RECEIVED: { label: 'Received', hint: 'Sample arrived in the lab', closed: false },
  IN_PROGRESS: { label: 'In progress', hint: 'Being processed or on the analyser', closed: false },
  PENDING: { label: 'Pending', hint: 'Waiting — repeat, reagent, query…', closed: false },
  SENT_OUT: { label: 'Sent out', hint: 'Referred to another lab', closed: false },
  COMPLETED: { label: 'Completed', hint: 'Finished and reported', closed: true },
  REJECTED: { label: 'Rejected', hint: 'Not processed — give the reason', closed: true }
}

export interface SampleLog {
  id: string
  /** Lab / accession number from the request form. The only sample identifier stored. */
  labNumber: string
  testIds: string[]
  /** Codes kept alongside ids so the log still reads correctly if a test is later removed. */
  testCodes: string[]
  createdAt: string
  createdById: string
  createdByName: string
}

export interface SampleEvent {
  id: string
  logId: string
  status: SampleStatus
  note: string
  /** When it happened (device clock). */
  at: string
  staffId: string
  staffName: string
  staffNumber: string
}

/** An event waiting to be uploaded. The PIN is held only until the cloud has confirmed it. */
export interface PendingUpload {
  eventId: string
  pin: string
  attempts: number
  /** Last error from the cloud, e.g. "Wrong PIN" when the PIN was changed before upload. */
  error: string
  /** The cloud rejected the PIN: the person needs to confirm again before it can upload. */
  needsPin: boolean
}

export interface LogFile {
  schemaVersion: 1
  logs: SampleLog[]
  events: SampleEvent[]
  outbox: PendingUpload[]
  /** Last cloud sequence number pulled (0 = none). */
  pulledSeq: number
}

export function emptyLogFile(): LogFile {
  return { schemaVersion: 1, logs: [], events: [], outbox: [], pulledSeq: 0 }
}

export interface LogView {
  log: SampleLog
  status: SampleStatus
  open: boolean
  last: SampleEvent | undefined
  first: SampleEvent | undefined
  events: SampleEvent[]
  pendingUploads: number
}

const byTime = (a: SampleEvent, b: SampleEvent) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id)

export class LogCore {
  private f: LogFile

  constructor(
    raw: unknown,
    private readonly persist: (f: LogFile) => void
  ) {
    const d = (raw ?? {}) as Partial<LogFile>
    this.f = { schemaVersion: 1, logs: d.logs ?? [], events: d.events ?? [], outbox: d.outbox ?? [], pulledSeq: d.pulledSeq ?? 0 }
  }

  private save(): void {
    this.persist(this.f)
  }

  get pulledSeq(): number {
    return this.f.pulledSeq
  }

  /** All logs with their current status, newest activity first. */
  views(): LogView[] {
    const byLog = new Map<string, SampleEvent[]>()
    for (const e of this.f.events) byLog.set(e.logId, [...(byLog.get(e.logId) ?? []), e])
    const pending = new Set(this.f.outbox.map((o) => o.eventId))
    return this.f.logs
      .map((log) => {
        const events = (byLog.get(log.id) ?? []).sort(byTime)
        const last = events[events.length - 1]
        const status = last?.status ?? 'RECEIVED'
        return {
          log,
          status,
          open: !STATUS_META[status].closed,
          last,
          first: events[0],
          events,
          pendingUploads: events.filter((e) => pending.has(e.id)).length
        }
      })
      .sort((a, b) => (b.last?.at ?? b.log.createdAt).localeCompare(a.last?.at ?? a.log.createdAt))
  }

  view(logId: string): LogView | undefined {
    return this.views().find((v) => v.log.id === logId)
  }

  /** Starts a log for a sample and records its first status. */
  create(input: { labNumber: string; tests: LabTest[]; status: SampleStatus; note: string }, actor: Staff, pin: string): SampleLog {
    const labNumber = input.labNumber.trim()
    if (!labNumber) throw new Error('Enter the lab number from the request form')
    if (labNumber.length > 40) throw new Error('Lab number is too long')
    if (input.tests.length === 0) throw new Error('Pick at least one test')
    if (input.status === 'REJECTED' && !input.note.trim()) throw new Error('Give the reason for rejecting the sample')
    const now = new Date().toISOString()
    const log: SampleLog = {
      id: uid(),
      labNumber,
      testIds: input.tests.map((t) => t.id),
      testCodes: input.tests.map((t) => t.code),
      createdAt: now,
      createdById: actor.id,
      createdByName: actor.name
    }
    this.f.logs.push(log)
    this.pushEvent(log.id, input.status, input.note, actor, pin, now)
    this.save()
    return log
  }

  /** Adds a status update / handover note to an existing log. */
  addEvent(logId: string, status: SampleStatus, note: string, actor: Staff, pin: string): SampleEvent {
    if (!this.f.logs.some((l) => l.id === logId)) throw new Error('Sample log not found')
    if (status === 'REJECTED' && !note.trim()) throw new Error('Give the reason for rejecting the sample')
    const e = this.pushEvent(logId, status, note, actor, pin, new Date().toISOString())
    this.save()
    return e
  }

  private pushEvent(logId: string, status: SampleStatus, note: string, actor: Staff, pin: string, at: string): SampleEvent {
    // Keep a sample's timeline strictly ordered even when two updates land in the same millisecond.
    const lastAt = this.f.events.filter((x) => x.logId === logId).reduce((m, x) => (x.at > m ? x.at : m), '')
    if (lastAt && at <= lastAt) at = new Date(new Date(lastAt).getTime() + 1).toISOString()
    const e: SampleEvent = { id: uid(), logId, status, note: note.trim(), at, staffId: actor.id, staffName: actor.name, staffNumber: actor.staffNumber }
    this.f.events.push(e)
    this.f.outbox.push({ eventId: e.id, pin, attempts: 0, error: '', needsPin: false })
    return e
  }

  // ---------- Upload queue ----------

  outbox(): { item: PendingUpload; event: SampleEvent; log: SampleLog }[] {
    return this.f.outbox
      .map((item) => {
        const event = this.f.events.find((e) => e.id === item.eventId)
        const log = event && this.f.logs.find((l) => l.id === event.logId)
        return event && log ? { item, event, log } : null
      })
      .filter((x): x is { item: PendingUpload; event: SampleEvent; log: SampleLog } => !!x)
  }

  markUploaded(eventId: string): void {
    this.f.outbox = this.f.outbox.filter((o) => o.eventId !== eventId)
    this.save()
  }

  markFailed(eventId: string, error: string, needsPin: boolean): void {
    this.f.outbox = this.f.outbox.map((o) => (o.eventId === eventId ? { ...o, attempts: o.attempts + 1, error, needsPin, pin: needsPin ? '' : o.pin } : o))
    this.save()
  }

  /** The person re-confirmed after the cloud rejected their PIN: applies to all of their waiting entries. */
  reconfirm(eventId: string, pin: string): void {
    const who = this.f.events.find((e) => e.id === eventId)?.staffNumber.toLowerCase()
    const theirs = new Set(this.f.events.filter((e) => e.staffNumber.toLowerCase() === who).map((e) => e.id))
    this.f.outbox = this.f.outbox.map((o) => (o.eventId === eventId || (o.needsPin && theirs.has(o.eventId)) ? { ...o, pin, needsPin: false, error: '' } : o))
    this.save()
  }

  /** Start pulling from the beginning — used when the device switches to a different cloud project. */
  resetPulled(): void {
    this.f.pulledSeq = 0
    this.save()
  }

  /** Adds logs/events pulled from the cloud (already-known ids are ignored). */
  merge(logs: SampleLog[], events: SampleEvent[], pulledSeq: number): number {
    const haveLogs = new Set(this.f.logs.map((l) => l.id))
    const haveEvents = new Set(this.f.events.map((e) => e.id))
    let added = 0
    for (const l of logs) if (!haveLogs.has(l.id)) (this.f.logs.push(l), haveLogs.add(l.id))
    for (const e of events) if (!haveEvents.has(e.id)) (this.f.events.push(e), haveEvents.add(e.id), added++)
    this.f.pulledSeq = Math.max(this.f.pulledSeq, pulledSeq)
    this.save()
    return added
  }
}

// ---------- Time warnings ----------

export interface SampleAlert {
  kind: 'stability' | 'tat'
  level: 'ok' | 'soon' | 'late'
  due: Date
  text: string
}

const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60000)
/** "Sun 09:43" within the next/last 6 days; "31 Oct, 21:43" further out (a weekday alone would be ambiguous). */
const hm = (d: Date) =>
  Math.abs(d.getTime() - Date.now()) < 6 * 86400000
    ? d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

function level(due: Date, total: number, now: Date): SampleAlert['level'] {
  const left = (due.getTime() - now.getTime()) / 60000
  if (left < 0) return 'late'
  return left <= Math.max(60, total * 0.25) ? 'soon' : 'ok'
}

/**
 * Stability and turnaround warnings for an open sample, counted from when it was received.
 * Stability uses each required sample's rule at its storage temperature (the earliest wins).
 */
export function sampleAlerts(receivedAt: string, tests: LabTest[], now = new Date()): SampleAlert[] {
  const start = new Date(receivedAt)
  const alerts: SampleAlert[] = []

  let stab: { due: Date; mins: number; code: string } | null = null
  for (const t of tests) {
    const samples = t.specimens.filter((s) => s.role === 'REQUIRED')
    for (const s of samples.length ? samples : t.specimens.slice(0, 1)) {
      const rule = s.stability.find((r) => r.temp === s.storageTemp) ?? s.stability[0]
      if (!rule) continue
      const mins = toMinutes(rule as { value: number; unit: TimeUnit })
      const due = addMinutes(start, mins)
      if (!stab || due < stab.due) stab = { due, mins, code: t.code }
    }
  }
  if (stab) {
    const lv = level(stab.due, stab.mins, now)
    alerts.push({ kind: 'stability', level: lv, due: stab.due, text: lv === 'late' ? `Past stability (${stab.code}) since ${hm(stab.due)}` : `Process by ${hm(stab.due)} (${stab.code} stability)` })
  }

  const slowest = tests.reduce<LabTest | null>((m, t) => (!m || toMinutes(t.tatRoutine) > toMinutes(m.tatRoutine) ? t : m), null)
  if (slowest && slowest.tatRoutine.value > 0) {
    const mins = toMinutes(slowest.tatRoutine)
    const due = addMinutes(start, mins)
    const lv = level(due, mins, now)
    alerts.push({ kind: 'tat', level: lv, due, text: lv === 'late' ? `Overdue — results were due ${hm(due)}` : `Results due ${hm(due)}` })
  }
  return alerts
}
