// Supabase connection over plain HTTPS (no SDK), shared by desktop and mobile.
// Reads use the public anon key; every write goes through a database function that checks
// the person's staff number + PIN (see supabase/schema.sql).
import type { UpdatePackage } from './core'
import type { SampleEvent, SampleLog, SampleStatus } from './logs'
import type { Staff, StaffInput, StaffRole } from './staff'

export interface CloudConfig {
  url: string
  anonKey: string
}

export function cloudConfigError(cfg: CloudConfig): string | null {
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(cfg.url.trim())) return 'Project URL should look like https://abcd1234.supabase.co'
  const key = cfg.anonKey.trim()
  if (key.length < 30) return 'Paste the full anon / publishable key'
  if (/service_role|sb_secret_/i.test(key) || isServiceRoleJwt(key)) return 'That is the secret service_role key — never put it in the app. Use the anon / publishable key.'
  return null
}

function isServiceRoleJwt(key: string): boolean {
  const part = key.split('.')[1]
  if (!part) return false
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    return /"role"\s*:\s*"service_role"/.test(json)
  } catch {
    return false
  }
}

interface StaffRow {
  id: string
  staff_number: string
  name: string
  phone: string
  role: StaffRole
  active: boolean
  updated_at: string
}

const toStaff = (r: StaffRow): Staff => ({
  id: r.id,
  staffNumber: r.staff_number,
  name: r.name,
  phone: r.phone ?? '',
  role: r.role,
  active: r.active,
  pinSalt: '',
  pinCheck: '',
  updatedAt: r.updated_at
})

export interface ReleaseInfo {
  revision: number
  publishedAt: string
  publisherName: string
  testCount: number
}

/** The cloud said no for a reason worth showing (wrong PIN, not allowed…), not a network fault. */
export class CloudRefused extends Error {
  constructor(
    message: string,
    readonly wrongPin = false
  ) {
    super(message)
  }
}

type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => Promise<{
  ok: boolean
  status: number
  text(): Promise<string>
}>

export class CloudClient {
  private readonly base: string

  constructor(
    private readonly cfg: CloudConfig,
    private readonly fetchImpl: Fetch = fetch as unknown as Fetch,
    private readonly timeoutMs = 20000
  ) {
    this.base = cfg.url.trim().replace(/\/+$/, '')
  }

  private async request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)
    try {
      const res = await this.fetchImpl(`${this.base}/rest/v1/${path}`, {
        method: init.method ?? 'GET',
        headers: {
          apikey: this.cfg.anonKey.trim(),
          Authorization: `Bearer ${this.cfg.anonKey.trim()}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: ctrl.signal
      })
      const text = await res.text()
      const data = text ? JSON.parse(text) : null
      if (!res.ok) {
        const msg = (data && (data.message || data.error_description || data.hint)) || `HTTP ${res.status}`
        if (res.status === 401 || res.status === 403) throw new Error(`The cloud refused the connection (${msg}). Check the anon key.`)
        if (res.status === 404) throw new Error('LabDex tables were not found. Run supabase/schema.sql in the Supabase SQL Editor first.')
        throw new Error(msg)
      }
      return data as T
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('The cloud did not answer in time. Check the internet connection.')
      if (e instanceof TypeError) throw new Error('No connection to the cloud. Check the internet connection.')
      throw e
    } finally {
      clearTimeout(timer)
    }
  }

  /** Calls a database function that answers {ok, error?, ...}. */
  private async rpc<T extends object>(fn: string, args: Record<string, unknown>): Promise<T> {
    const r = await this.request<{ ok: boolean; error?: string; pin?: boolean } & T>(`rpc/${fn}`, { method: 'POST', body: args })
    if (!r || !r.ok) throw new CloudRefused(r?.error ?? 'The cloud rejected the request', r?.pin === true || r?.error === 'Wrong PIN')
    return r
  }

  // ---------- Connection ----------

  /** Checks the project is reachable and set up. Returns how many staff exist. */
  async ping(): Promise<{ staff: number }> {
    const list = await this.listStaff()
    return { staff: list.length }
  }

  // ---------- Staff ----------

  async listStaff(): Promise<Staff[]> {
    const rows = await this.request<StaffRow[]>('rpc/list_staff', { method: 'POST', body: {} })
    return (rows ?? []).map(toStaff)
  }

  async verifyStaff(staffNumber: string, pin: string): Promise<Staff> {
    const r = await this.rpc<{ staff: StaffRow }>('verify_staff', { p_number: staffNumber, p_pin: pin })
    return toStaff(r.staff)
  }

  /** `actor` is ignored by the cloud when the staff list is empty (first Senior). */
  async saveStaff(actor: { staffNumber: string; pin: string } | null, input: StaffInput, newPin: string | null): Promise<Staff> {
    const r = await this.rpc<{ staff: StaffRow }>('upsert_staff', {
      p_actor_number: actor?.staffNumber ?? '',
      p_actor_pin: actor?.pin ?? '',
      p_staff: { id: input.id ?? '', staff_number: input.staffNumber, name: input.name, phone: input.phone, role: input.role, active: input.active },
      p_new_pin: newPin
    })
    return toStaff(r.staff)
  }

  async changeOwnPin(staffNumber: string, oldPin: string, newPin: string): Promise<void> {
    await this.rpc('change_own_pin', { p_number: staffNumber, p_old_pin: oldPin, p_new_pin: newPin })
  }

  // ---------- Directory releases ----------

  async latestRelease(): Promise<ReleaseInfo | null> {
    const rows = await this.request<{ revision: number; published_at: string; publisher_name: string; test_count: number }[]>(
      'directory_releases?select=revision,published_at,publisher_name,test_count&order=revision.desc&limit=1'
    )
    const r = rows?.[0]
    return r ? { revision: Number(r.revision), publishedAt: r.published_at, publisherName: r.publisher_name, testCount: r.test_count } : null
  }

  async fetchRelease(revision: number): Promise<UpdatePackage> {
    const rows = await this.request<{ package: UpdatePackage }[]>(`directory_releases?select=package&revision=eq.${encodeURIComponent(String(revision))}`)
    if (!rows?.[0]) throw new Error('That update is no longer available')
    return rows[0].package
  }

  /** Publishes the directory. The staff list is not included — the cloud keeps its own. */
  async publish(actor: { staffNumber: string; pin: string }, pkg: UpdatePackage): Promise<void> {
    const { staff: _staff, ...rest } = pkg
    await this.rpc('publish_release', {
      p_actor_number: actor.staffNumber,
      p_actor_pin: actor.pin,
      p_revision: pkg.revision,
      p_publisher_name: pkg.publishedBy,
      p_test_count: pkg.tests.length,
      p_package: rest
    })
  }

  // ---------- Sample log ----------

  async pushEvent(pin: string, log: SampleLog, e: SampleEvent): Promise<void> {
    await this.rpc('log_sample_event', {
      p_number: e.staffNumber,
      p_pin: pin,
      p_log: { id: log.id, lab_number: log.labNumber, test_ids: log.testIds, test_codes: log.testCodes, created_at: log.createdAt, created_by: log.createdById, created_by_name: log.createdByName },
      p_event: { id: e.id, status: e.status, note: e.note, at: e.at, staff_id: e.staffId }
    })
  }

  /** Everything uploaded after `afterSeq`, oldest first (at most `limit` events per call). */
  async pullEvents(afterSeq: number, limit = 500): Promise<{ logs: SampleLog[]; events: SampleEvent[]; lastSeq: number }> {
    const rows = await this.request<
      { id: string; seq: number; log_id: string; status: SampleStatus; note: string; at: string; staff_id: string; staff_name: string; staff_number: string }[]
    >(`sample_events?select=id,seq,log_id,status,note,at,staff_id,staff_name,staff_number&seq=gt.${afterSeq}&order=seq.asc&limit=${limit}`)
    const events: SampleEvent[] = (rows ?? []).map((r) => ({
      id: r.id,
      logId: r.log_id,
      status: r.status,
      note: r.note,
      at: r.at,
      staffId: r.staff_id,
      staffName: r.staff_name,
      staffNumber: r.staff_number
    }))
    const ids = [...new Set(events.map((e) => e.logId))]
    let logs: SampleLog[] = []
    if (ids.length) {
      const lr = await this.request<
        { id: string; lab_number: string; test_ids: string[]; test_codes: string[]; created_at: string; created_by: string; created_by_name: string }[]
      >(`sample_logs?select=*&id=in.(${ids.join(',')})`)
      logs = (lr ?? []).map((r) => ({
        id: r.id,
        labNumber: r.lab_number,
        testIds: r.test_ids ?? [],
        testCodes: r.test_codes ?? [],
        createdAt: r.created_at,
        createdById: r.created_by,
        createdByName: r.created_by_name
      }))
    }
    const lastSeq = rows?.length ? Number(rows[rows.length - 1].seq) : afterSeq
    return { logs, events, lastSeq }
  }
}
