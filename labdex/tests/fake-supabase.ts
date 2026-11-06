// A stand-in for the Supabase project that mirrors supabase/schema.sql: PIN checks with lockout,
// first staff member becomes Senior, Senior-only publish, idempotent sample-log uploads.
type Row = Record<string, any>
export const db = { staff: [] as Row[], releases: [] as Row[], logs: [] as Row[], events: [] as Row[], seq: 0 }
/** Flip `net.online` to simulate losing and regaining the internet. */
export const net = { online: true }
const uuid = () => crypto.randomUUID()
const pub = (s: Row) => ({ id: s.id, staff_number: s.staff_number, name: s.name, phone: s.phone, role: s.role, active: s.active, updated_at: s.updated_at })
function checkPin(num: string, pin: string): { ok: boolean; reason?: string; who?: Row } {
  const who = db.staff.find((s) => s.staff_number.toLowerCase() === String(num).trim().toLowerCase())
  if (!who || !who.active) return { ok: false, reason: 'Unknown or inactive staff number' }
  if (who.locked_until && who.locked_until > Date.now()) return { ok: false, reason: 'Too many wrong PINs — try again in a few minutes' }
  if (who.pin !== pin) {
    who.failed += 1
    if (who.failed >= 5) (who.failed = 0), (who.locked_until = Date.now() + 300000)
    return { ok: false, reason: 'Wrong PIN' }
  }
  who.failed = 0
  who.locked_until = null
  return { ok: true, who }
}
const fns: Record<string, (a: Row) => any> = {
  list_staff: () => db.staff.map(pub),
  verify_staff: (a) => {
    const c = checkPin(a.p_number, a.p_pin)
    return c.ok ? { ok: true, staff: pub(c.who!) } : { ok: false, error: c.reason }
  },
  upsert_staff: (a) => {
    const first = db.staff.length === 0
    let role = a.p_staff.role
    if (!first) {
      const c = checkPin(a.p_actor_number, a.p_actor_pin)
      if (!c.ok) return { ok: false, error: c.reason }
      if (c.who!.role !== 'SENIOR') return { ok: false, error: 'Only a Senior can manage staff' }
    } else role = 'SENIOR'
    if (a.p_new_pin != null && !/^\d{4,6}$/.test(a.p_new_pin)) return { ok: false, error: 'PIN must be 4–6 digits' }
    if (!a.p_staff.id) {
      if (a.p_new_pin == null) return { ok: false, error: 'Set a PIN for the new staff member' }
      const row = { id: uuid(), staff_number: a.p_staff.staff_number, name: a.p_staff.name, phone: a.p_staff.phone, role, active: true, pin: a.p_new_pin, failed: 0, locked_until: null, updated_at: new Date().toISOString() }
      db.staff.push(row)
      return { ok: true, staff: pub(row) }
    }
    const row = db.staff.find((s) => s.id === a.p_staff.id)!
    Object.assign(row, { name: a.p_staff.name, role, active: a.p_staff.active, ...(a.p_new_pin ? { pin: a.p_new_pin } : {}) })
    return { ok: true, staff: pub(row) }
  },
  publish_release: (a) => {
    const c = checkPin(a.p_actor_number, a.p_actor_pin)
    if (!c.ok) return { ok: false, error: c.reason }
    if (c.who!.role !== 'SENIOR') return { ok: false, error: 'Only a Senior can publish updates' }
    if (a.p_revision <= Math.max(0, ...db.releases.map((r) => r.revision))) return { ok: false, error: 'A newer update was already published' }
    db.releases.push({ revision: a.p_revision, published_at: new Date().toISOString(), publisher_name: a.p_publisher_name, test_count: a.p_test_count, package: a.p_package })
    return { ok: true }
  },
  log_sample_event: (a) => {
    const c = checkPin(a.p_number, a.p_pin)
    if (!c.ok) return { ok: false, error: c.reason, pin: c.reason === 'Wrong PIN' }
    if (!['TECH', 'SENIOR'].includes(c.who!.role)) return { ok: false, error: 'Viewers cannot log samples' }
    if (a.p_event.staff_id !== c.who!.id) return { ok: false, error: 'This entry belongs to a different staff member' }
    if (!db.logs.some((l) => l.id === a.p_log.id)) db.logs.push({ ...a.p_log })
    if (!db.events.some((e) => e.id === a.p_event.id)) db.events.push({ ...a.p_event, log_id: a.p_log.id, seq: ++db.seq, staff_name: c.who!.name, staff_number: c.who!.staff_number })
    return { ok: true }
  }
}
export const fakeFetch = async (url: string, init: any = {}) => {
  if (!net.online) throw new TypeError('fetch failed')
  const path = url.split('/rest/v1/')[1]
  let body: any
  if (path.startsWith('rpc/')) body = fns[path.slice(4)](JSON.parse(init.body || '{}'))
  else if (path.startsWith('directory_releases')) {
    if (path.includes('order=revision.desc')) body = [...db.releases].sort((a, b) => b.revision - a.revision).slice(0, 1)
    else body = db.releases.filter((r) => r.revision === Number(/revision=eq\.(\d+)/.exec(path)![1]))
  } else if (path.startsWith('sample_events')) {
    const after = Number(/seq=gt\.(\d+)/.exec(path)![1])
    body = db.events.filter((e) => e.seq > after).sort((a, b) => a.seq - b.seq)
  } else if (path.startsWith('sample_logs')) {
    const ids = /id=in\.\(([^)]*)\)/.exec(path)![1].split(',')
    body = db.logs.filter((l) => ids.includes(l.id))
  }
  return { ok: true, status: 200, text: async () => JSON.stringify(body) }
}
