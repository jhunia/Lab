import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Copy, Moon, Plus, Save, Trash2, X, Snowflake, Sun, Thermometer, Sparkles } from 'lucide-react'
import {
  STORAGE_LABELS,
  type Container,
  type Department,
  type Duration,
  type LabTest,
  type Specimen,
  type SpecimenRole,
  type StorageTemp,
  type TestInput,
  type TestStatus,
  type TimeUnit,
  type VolumeUnit,
  VOLUME_UNITS
} from '@shared/types'
import { blankSpecimen } from '@shared/migrate'
import { DESCRIPTION_MAX, validateTest, type FieldErrors } from '@shared/validate'
import { cx } from '../lib/util'
import { ListEditor } from './ListEditor'
import { TestCard } from './TestCard'
import { TubeIcon } from './Visuals'
import { ConfirmDialog } from './ConfirmDialog'

interface Props {
  initial: TestInput
  tests: LabTest[]
  departments: Department[]
  containers: Container[]
  onSave: (t: TestInput) => Promise<void>
  onClose: () => void
}

const SECTIONS = [
  { id: 'identity', label: 'Identity', fields: ['code', 'name', 'departmentId'] },
  { id: 'samples', label: 'Samples', fields: ['specimens'] },
  { id: 'tat', label: 'Turnaround', fields: ['tatRoutine', 'tatUrgent'] },
  { id: 'guidance', label: 'Guidance', fields: ['description'] }
]

const SAMPLE_TYPES = ['Whole blood', 'Serum', 'EDTA plasma', 'Citrated plasma', 'Heparin plasma', 'Fluoride plasma', 'Midstream urine', '24 h urine', 'CSF', 'Stool', 'Swab', 'Sputum', 'Tissue', 'Cervical cells (liquid-based)', 'Cervical smear (conventional)', 'Fine needle aspirate']
const DAYS = ['24/7', 'Daily', 'Mon–Fri', 'Mon–Sat']
const REJECT_COMMON = ['Haemolysed', 'Clotted', 'Under-filled', 'Unlabelled', 'Wrong container', 'Leaking']
const TEMPS: { v: StorageTemp; icon: typeof Sun }[] = [
  { v: 'ROOM', icon: Sun },
  { v: 'FRIDGE', icon: Thermometer },
  { v: 'FROZEN', icon: Snowflake },
  { v: 'DEEP_FROZEN', icon: Sparkles }
]
const UNITS: TimeUnit[] = ['min', 'h', 'd', 'wk']

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

export function TestForm({ initial, tests, departments, containers, onSave, onClose }: Props) {
  const [t, setT] = useState<TestInput>(initial)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [active, setActive] = useState('identity')
  const [confirmClose, setConfirmClose] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const errors: FieldErrors = useMemo(() => validateTest(t, tests), [t, tests])
  const dirty = JSON.stringify(t) !== JSON.stringify(initial)
  const shown = (k: string) => (touched ? errors[k] : undefined)
  const set = <K extends keyof TestInput>(k: K, v: TestInput[K]) => setT((p) => ({ ...p, [k]: v }))

  const sortedContainers = useMemo(() => [...containers].sort((a, b) => a.drawOrder - b.drawOrder), [containers])

  const submit = async () => {
    setTouched(true)
    if (Object.keys(errors).length) {
      const firstBad = SECTIONS.find((s) => s.fields.some((f) => errors[f] || Object.keys(errors).some((k) => k.startsWith(f + '.'))))
      if (firstBad) jump(firstBad.id)
      return
    }
    setSaving(true)
    try {
      await onSave({ ...t, code: t.code.trim().toUpperCase() })
    } finally {
      setSaving(false)
    }
  }

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void submit()
      } else if (e.key === 'Escape' && !confirmClose) requestClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Highlight the section in view.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (vis) setActive(vis.target.id.replace('sec-', ''))
      },
      { root, rootMargin: '0px 0px -65% 0px' }
    )
    root.querySelectorAll('section[id^="sec-"]').forEach((s) => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  const jump = (id: string) => scroller.current?.querySelector(`#sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const sectionHasError = (fields: string[]) => touched && Object.keys(errors).some((k) => fields.some((f) => k === f || k.startsWith(f + '.')))

  const dep = departments.find((d) => d.id === t.departmentId)
  const conOf = (id: string) => containers.find((c) => c.id === id)

  return (
    <div className="sheet-scrim">
      <div className="sheet" role="dialog" aria-label={initial.id ? 'Edit test' : 'New test'}>
        <header className="sheet-head">
          <div>
            <span className="eyebrow">{initial.id ? 'Edit requisition' : 'New requisition'}</span>
            <h2>{initial.id ? initial.name : 'Add a test'}</h2>
          </div>
          <div className="sheet-head-actions">
            <kbd>Ctrl S</kbd>
            <button className="btn btn-ghost" onClick={requestClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : initial.id ? 'Save changes' : 'Create test'}
            </button>
            <button className="btn btn-icon btn-ghost" onClick={requestClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="sheet-grid">
          <nav className="stepper">
            {SECTIONS.map((s, i) => (
              <button key={s.id} className={cx(active === s.id && 'active', sectionHasError(s.fields) && 'has-error')} onClick={() => jump(s.id)}>
                <span className="step-n mono">{String(i + 1).padStart(2, '0')}</span>
                {s.label}
              </button>
            ))}
          </nav>

          <div className="sheet-form" ref={scroller}>
            <section id="sec-identity">
              <h3>
                <span className="mono">01</span> Identity
              </h3>
              <div className="grid-2">
                <Field label="Test code" error={shown('code')} hint="e.g. CHEM-GLU">
                  <input className="input mono upper" value={t.code} onChange={(e) => set('code', e.target.value.toUpperCase())} autoFocus={!initial.id} />
                </Field>
                <Field label="Status">
                  <Segmented<TestStatus>
                    value={t.status === 'ARCHIVED' ? 'PUBLISHED' : t.status}
                    options={[
                      { v: 'DRAFT', label: 'Draft' },
                      { v: 'PUBLISHED', label: 'Published' }
                    ]}
                    onChange={(v) => set('status', v)}
                  />
                </Field>
              </div>
              <Field label="Test name" error={shown('name')}>
                <input className="input input-lg" value={t.name} onChange={(e) => set('name', e.target.value)} placeholder="Full Blood Count" />
              </Field>
              <Field label="Synonyms & abbreviations" hint="Press Enter or comma to add — these are searchable">
                <ListEditor variant="chips" value={t.synonyms} onChange={(v) => set('synonyms', v)} placeholder="CBC, FBC…" />
              </Field>
              <Field label="Department" error={shown('departmentId')}>
                <div className="dep-picker">
                  {departments.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      className={cx('dep-option', t.departmentId === d.id && 'active')}
                      style={{ ['--dep' as string]: d.color }}
                      onClick={() => set('departmentId', d.id)}
                    >
                      <span className="dep-dot" />
                      {d.name}
                    </button>
                  ))}
                </div>
              </Field>
            </section>

            <section id="sec-samples">
              <h3>
                <span className="mono">02</span> Samples
              </h3>
              {shown('specimens') && <p className="field-error">{shown('specimens')}</p>}
              {t.specimens.map((sp, i) => (
                <SpecimenEditor
                  key={sp.id || `new-${i}`}
                  sp={sp}
                  index={i}
                  total={t.specimens.length}
                  containers={sortedContainers}
                  err={(f) => shown(`specimens.${i}.${f}`)}
                  onChange={(next) => set('specimens', t.specimens.map((x, j) => (j === i ? next : x)))}
                  onRemove={() => set('specimens', t.specimens.filter((_, j) => j !== i))}
                  onDuplicate={() => set('specimens', [...t.specimens.slice(0, i + 1), { ...sp, id: '' }, ...t.specimens.slice(i + 1)])}
                />
              ))}
              <button type="button" className="btn btn-dashed add-sample" onClick={() => set('specimens', [...t.specimens, blankSpecimen('')])}>
                <Plus size={14} /> Add another sample
              </button>
              <p className="field-hint">
                <b>Required</b> samples must all be collected. Mark two or more as <b>Alternative</b> when any one of them is acceptable (e.g. serum <i>or</i> plasma).
              </p>
              <Field label="Transport notes" hint="Optional — applies to the whole test">
                <textarea className="input" rows={2} value={t.transportNotes} onChange={(e) => set('transportNotes', e.target.value)} placeholder="Separate within 2 h, ship on dry ice…" />
              </Field>
            </section>

            <section id="sec-tat">
              <h3>
                <span className="mono">03</span> Turnaround time
              </h3>
              <div className="grid-2">
                <Field label="Routine TAT" error={shown('tatRoutine')}>
                  <DurationInput value={t.tatRoutine} onChange={(d) => set('tatRoutine', d)} />
                </Field>
                <Field label="Urgent / STAT TAT" error={shown('tatUrgent')}>
                  {t.tatUrgent ? (
                    <div className="input-group">
                      <DurationInput value={t.tatUrgent} onChange={(d) => set('tatUrgent', d)} />
                      <button type="button" className="btn btn-icon btn-ghost" onClick={() => set('tatUrgent', null)} aria-label="Remove urgent TAT">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="btn btn-dashed" onClick={() => set('tatUrgent', { value: 1, unit: 'h' })}>
                      <Plus size={13} /> STAT available
                    </button>
                  )}
                </Field>
              </div>
              <Field label="Days performed">
                <input className="input" value={t.daysPerformed} onChange={(e) => set('daysPerformed', e.target.value)} placeholder="Mon–Fri" />
                <div className="quick-add">
                  {DAYS.map((d) => (
                    <button type="button" key={d} className={cx('chip chip-ghost', t.daysPerformed === d && 'active')} onClick={() => set('daysPerformed', d)}>
                      {d}
                    </button>
                  ))}
                </div>
              </Field>
            </section>

            <section id="sec-guidance">
              <h3>
                <span className="mono">04</span> Guidance
              </h3>
              <Field label="Brief info" error={shown('description')} counter={`${t.description.length}/${DESCRIPTION_MAX}`}>
                <textarea className="input" rows={3} value={t.description} onChange={(e) => set('description', e.target.value)} placeholder="What the test measures and why it is ordered." />
              </Field>
              <Field label="Patient preparation" hint="Optional">
                <textarea className="input" rows={2} value={t.patientPrep} onChange={(e) => set('patientPrep', e.target.value)} placeholder="Fast for 8–12 hours…" />
              </Field>
              <Field label="Specific suggestions" hint="Collection tips shown as a checklist">
                <ListEditor value={t.suggestions} onChange={(v) => set('suggestions', v)} placeholder="Invert gently 8–10 times…" />
              </Field>
              <Field label="Rejection criteria">
                <ListEditor value={t.rejectionCriteria} onChange={(v) => set('rejectionCriteria', v)} placeholder="Add a reason to reject…" quickAdd={REJECT_COMMON} />
              </Field>
            </section>
            <div className="sheet-end" />
          </div>

          <aside className="sheet-preview">
            <span className="eyebrow">Live preview</span>
            <TestCard test={t} dep={dep} conOf={conOf} preview />
            {touched && Object.keys(errors).length > 0 && (
              <div className="error-summary">
                <strong>{Object.keys(errors).length} issue(s) to fix</strong>
                <ul>
                  {Object.values(errors).map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>

      {confirmClose && (
        <ConfirmDialog
          title="Discard changes?"
          body="You have unsaved changes to this test."
          confirmLabel="Discard"
          danger
          onConfirm={onClose}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  )
}

function Field({ label, error, hint, counter, children }: { label: string; error?: string; hint?: string; counter?: string; children: ReactNode }) {
  return (
    <div className={cx('field', error && 'invalid')}>
      <div className="field-label">
        <span>{label}</span>
        {counter && <span className="mono muted">{counter}</span>}
      </div>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button type="button" key={o.v} className={cx(value === o.v && 'active')} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function DurationInput({ value, onChange }: { value: Duration; onChange: (d: Duration) => void }) {
  return (
    <div className="input-group">
      <input className="input mono" type="number" min={0} value={value.value || ''} onChange={(e) => onChange({ ...value, value: Number(e.target.value) })} placeholder="0" />
      <select className="input" value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value as TimeUnit })}>
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {{ min: 'minutes', h: 'hours', d: 'days', wk: 'weeks' }[u]}
          </option>
        ))}
      </select>
    </div>
  )
}

function SpecimenEditor({
  sp,
  index,
  total,
  containers,
  err,
  onChange,
  onRemove,
  onDuplicate
}: {
  sp: Specimen
  index: number
  total: number
  containers: Container[]
  err: (field: string) => string | undefined
  onChange: (s: Specimen) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const set = <K extends keyof Specimen>(k: K, v: Specimen[K]) => onChange({ ...sp, [k]: v })
  const listId = `sample-types-${index}`
  return (
    <div className={cx('sample-editor', sp.role === 'ALTERNATIVE' && 'alt')}>
      <div className="sample-editor-head">
        <span className="mono">Sample {index + 1}</span>
        <Segmented<SpecimenRole>
          value={sp.role}
          options={[
            { v: 'REQUIRED', label: 'Required' },
            { v: 'ALTERNATIVE', label: 'Alternative' }
          ]}
          onChange={(v) => set('role', v)}
        />
        <span className="spacer" />
        <button type="button" className="btn btn-sm btn-ghost" onClick={onDuplicate} title="Duplicate this sample">
          <Copy size={13} />
        </button>
        {total > 1 && (
          <button type="button" className="btn btn-sm btn-ghost" onClick={onRemove} title="Remove this sample">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="grid-2">
        <Field label="Sample type" error={err('sampleType')}>
          <input className="input" list={listId} value={sp.sampleType} onChange={(e) => set('sampleType', e.target.value)} placeholder="Serum" />
          <datalist id={listId}>
            {SAMPLE_TYPES.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
        </Field>
        <Field label="Volume required" error={err('volume')}>
          <div className="input-group">
            <input className="input mono" type="number" min={0} step="0.1" value={sp.volume || ''} onChange={(e) => set('volume', Number(e.target.value))} placeholder="3" />
            <select className="input" value={sp.volumeUnit} onChange={(e) => set('volumeUnit', e.target.value as VolumeUnit)}>
              {VOLUME_UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </div>
        </Field>
        <Field label="Minimum volume" error={err('minVolume')} hint="Optional">
          <input className="input mono" type="number" min={0} step="0.1" value={sp.minVolume ?? ''} onChange={(e) => set('minVolume', numOrNull(e.target.value))} />
        </Field>
        <Field label="Paediatric volume" error={err('paedVolume')} hint="Optional">
          <input className="input mono" type="number" min={0} step="0.1" value={sp.paedVolume ?? ''} onChange={(e) => set('paedVolume', numOrNull(e.target.value))} />
        </Field>
      </div>

      <Field label="Container" error={err('containerId')} hint="Sorted by order of draw">
        <div className="tube-picker">
          {containers.map((c) => (
            <button type="button" key={c.id} className={cx('tube-option', sp.containerId === c.id && 'active')} onClick={() => set('containerId', c.id)} title={`${c.additive} · ${c.size}`}>
              <TubeIcon container={c} size={42} />
              <span>{c.name}</span>
              <em>{c.additive}</em>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Store / transport at">
        <div className="temp-picker">
          {TEMPS.map(({ v, icon: Icon }) => (
            <button type="button" key={v} className={cx('temp-option', `storage-${v.toLowerCase()}`, sp.storageTemp === v && 'active')} onClick={() => set('storageTemp', v)}>
              <Icon size={18} />
              <strong>{STORAGE_LABELS[v].label}</strong>
              <span className="mono">{STORAGE_LABELS[v].range}</span>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Stability" hint="How long this sample stays valid at each temperature">
        <div className="stability-list">
          {sp.stability.map((r, i) => (
            <div key={i} className={cx('stability-row', err(`stability.${i}`) && 'invalid')}>
              <select className="input" value={r.temp} onChange={(e) => set('stability', sp.stability.map((x, j) => (j === i ? { ...x, temp: e.target.value as StorageTemp } : x)))}>
                {TEMPS.map(({ v }) => (
                  <option key={v} value={v}>
                    {STORAGE_LABELS[v].label} ({STORAGE_LABELS[v].range})
                  </option>
                ))}
              </select>
              <DurationInput value={r} onChange={(d) => set('stability', sp.stability.map((x, j) => (j === i ? { ...x, ...d } : x)))} />
              <button type="button" className="btn btn-icon btn-ghost" onClick={() => set('stability', sp.stability.filter((_, j) => j !== i))} aria-label="Remove">
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-dashed" onClick={() => set('stability', [...sp.stability, { temp: sp.storageTemp, value: 24, unit: 'h' }])}>
            <Plus size={13} /> Add stability rule
          </button>
        </div>
      </Field>

      <label className="toggle">
        <input type="checkbox" checked={sp.protectFromLight} onChange={(e) => set('protectFromLight', e.target.checked)} />
        <span className="toggle-track" />
        <Moon size={14} /> Protect from light
      </label>

      <Field label="Notes for this sample" hint="Optional — e.g. collection method, timing">
        <input className="input" value={sp.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Draw during the urine collection…" />
      </Field>
    </div>
  )
}
