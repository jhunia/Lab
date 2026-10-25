import { useState } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import type { Container, ContainerKind, Department, LabTest } from '@shared/types'
import { api, errMsg } from '../lib/util'
import { TubeIcon } from '../components/Visuals'
import { useToast } from '../components/Toasts'
import { isCancel, useRequireStaff } from '../components/Identity'

interface Props {
  tests: LabTest[]
  containers: Container[]
  departments: Department[]
  onChanged: () => void
  readOnly?: boolean
}

const KINDS: ContainerKind[] = ['tube', 'cup', 'bottle', 'swab', 'jar', 'vial', 'slide', 'other']

export function LookupsView({ tests, containers, departments, onChanged, readOnly }: Props) {
  const toast = useToast()
  const requireStaff = useRequireStaff()

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await requireStaff('SENIOR', 'change containers and departments')
      await fn()
      toast('ok', ok)
      onChanged()
    } catch (e) {
      if (!isCancel(e)) toast('error', 'Could not save', errMsg(e))
    }
  }

  const usage = (key: 'containerId' | 'departmentId', id: string) =>
    key === 'containerId' ? tests.filter((t) => t.specimens.some((s) => s.containerId === id)).length : tests.filter((t) => t.departmentId === id).length

  return (
    <div className="lookups">
      <div className="toolbar-title">
        <h1>Lookups</h1>
        <span className="muted small">{readOnly ? 'Read-only on a Viewer device' : 'Containers and departments used across the directory'}</span>
      </div>
      {/* A disabled fieldset makes every input and button inside read-only for viewers. */}
      <fieldset className="lookups-fieldset" disabled={readOnly}>

      <section className="lookup-section">
        <div className="lookup-head">
          <h3>Containers</h3>
          <button className="btn btn-sm" onClick={() => run(() => api.saveContainer({ id: '', name: 'New container', capColor: '#B8BEC6', additive: '', size: '', kind: 'tube', drawOrder: 99 }), 'Container added')}>
            <Plus size={13} /> Add container
          </button>
        </div>
        <div className="lookup-grid lookup-grid-containers">
          <span className="lh" />
          <span className="lh">Name</span>
          <span className="lh">Cap</span>
          <span className="lh">Additive</span>
          <span className="lh">Size</span>
          <span className="lh">Kind</span>
          <span className="lh" title="CLSI order of draw (99 = not blood)">Draw #</span>
          <span className="lh right">Used</span>
          <span className="lh" />
          {[...containers]
            .sort((a, b) => a.drawOrder - b.drawOrder)
            .map((c) => (
              <ContainerRow
                key={c.id}
                c={c}
                used={usage('containerId', c.id)}
                onSave={(v) => run(() => api.saveContainer(v), `${v.name} saved`)}
                onDelete={() => run(() => api.deleteContainer(c.id), `${c.name} removed`)}
              />
            ))}
        </div>
      </section>

      <section className="lookup-section">
        <div className="lookup-head">
          <h3>Departments</h3>
          <button className="btn btn-sm" onClick={() => run(() => api.saveDepartment({ id: '', name: 'New department', color: '#5B6472' }), 'Department added')}>
            <Plus size={13} /> Add department
          </button>
        </div>
        <div className="lookup-grid lookup-grid-deps">
          <span className="lh">Colour</span>
          <span className="lh">Name</span>
          <span className="lh right">Used</span>
          <span className="lh" />
          {departments.map((d) => (
            <DepartmentRow
              key={d.id}
              d={d}
              used={usage('departmentId', d.id)}
              onSave={(v) => run(() => api.saveDepartment(v), `${v.name} saved`)}
              onDelete={() => run(() => api.deleteDepartment(d.id), `${d.name} removed`)}
            />
          ))}
        </div>
      </section>
      </fieldset>
    </div>
  )
}

function ContainerRow({ c, used, onSave, onDelete }: { c: Container; used: number; onSave: (c: Container) => void; onDelete: () => void }) {
  const [v, setV] = useState(c)
  const dirty = JSON.stringify(v) !== JSON.stringify(c)
  const set = <K extends keyof Container>(k: K, val: Container[K]) => setV((p) => ({ ...p, [k]: val }))
  return (
    <>
      <span className="lookup-tube">
        <TubeIcon container={v} size={34} />
      </span>
      <input className="input input-sm" value={v.name} onChange={(e) => set('name', e.target.value)} />
      <input className="color-input" type="color" value={v.capColor} onChange={(e) => set('capColor', e.target.value)} aria-label="Cap colour" />
      <input className="input input-sm" value={v.additive} onChange={(e) => set('additive', e.target.value)} />
      <input className="input input-sm mono" value={v.size} onChange={(e) => set('size', e.target.value)} />
      <select className="input input-sm" value={v.kind} onChange={(e) => set('kind', e.target.value as ContainerKind)}>
        {KINDS.map((k) => (
          <option key={k}>{k}</option>
        ))}
      </select>
      <input className="input input-sm mono" type="number" min={1} max={99} value={v.drawOrder} onChange={(e) => set('drawOrder', Number(e.target.value))} />
      <span className="mono right muted">{used}</span>
      <span className="row-actions">
        <button className="btn btn-icon btn-sm" disabled={!dirty} onClick={() => onSave(v)} aria-label="Save">
          <Save size={13} />
        </button>
        <button className="btn btn-icon btn-sm btn-ghost" disabled={used > 0} title={used ? 'In use — reassign tests first' : 'Delete'} onClick={onDelete} aria-label="Delete">
          <Trash2 size={13} />
        </button>
      </span>
    </>
  )
}

function DepartmentRow({ d, used, onSave, onDelete }: { d: Department; used: number; onSave: (d: Department) => void; onDelete: () => void }) {
  const [v, setV] = useState(d)
  const dirty = JSON.stringify(v) !== JSON.stringify(d)
  return (
    <>
      <input className="color-input" type="color" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} aria-label="Department colour" />
      <input className="input input-sm" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      <span className="mono right muted">{used}</span>
      <span className="row-actions">
        <button className="btn btn-icon btn-sm" disabled={!dirty} onClick={() => onSave(v)} aria-label="Save">
          <Save size={13} />
        </button>
        <button className="btn btn-icon btn-sm btn-ghost" disabled={used > 0} title={used ? 'In use — reassign tests first' : 'Delete'} onClick={onDelete} aria-label="Delete">
          <Trash2 size={13} />
        </button>
      </span>
    </>
  )
}
