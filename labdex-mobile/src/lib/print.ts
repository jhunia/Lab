// Printable bench card / collection plan, sent to the phone's print dialog (which can also save a PDF).
import * as Print from 'expo-print'
import { STORAGE_LABELS, formatDuration, type Container, type Department, type LabTest } from '@shared/types'
import { fmtNum, specimenSummary, type CollectionPlan } from '@shared/helpers'

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!)

const PAGE = `
  <style>
    body { font-family: -apple-system, Roboto, 'Segoe UI', sans-serif; color: #14181F; padding: 24px; }
    h1 { font-size: 22px; margin: 4px 0; }
    .code { font-family: monospace; font-size: 13px; letter-spacing: .06em; color: #3A414C; }
    .rail { border-left: 6px solid var(--dep); padding-left: 14px; margin-bottom: 18px; }
    h2 { font-family: monospace; font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #6B7380; border-bottom: 1px solid #E2E5DE; padding-bottom: 4px; margin-top: 20px; }
    .sample { border: 1px solid #CDD2C9; border-radius: 8px; padding: 10px 12px; margin: 8px 0; }
    .alt { border-style: dashed; }
    .row { display: flex; justify-content: space-between; gap: 12px; }
    .muted { color: #6B7380; font-size: 12px; }
    .cap { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; border: 1px solid rgba(0,0,0,.2); }
    li { margin: 3px 0; }
    .reject li { color: #C2412D; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 6px 4px; border-bottom: 1px dashed #E2E5DE; }
  </style>`

export async function printTest(t: LabTest, dep: Department | undefined, con: (id: string) => Container | undefined): Promise<void> {
  const samples = t.specimens
    .map((s, i) => {
      const k = con(s.containerId)
      const stab = s.stability.map((r) => `${STORAGE_LABELS[r.temp].label} ${formatDuration(r)}`).join(' · ')
      return `<div class="sample ${s.role === 'ALTERNATIVE' ? 'alt' : ''}">
        <div class="row"><b>${t.specimens.length > 1 ? `Sample ${i + 1} (${s.role === 'ALTERNATIVE' ? 'alternative' : 'required'}): ` : ''}${esc(s.sampleType)}</b>
        <b>${fmtNum(s.volume)} ${s.volumeUnit}${s.minVolume != null ? ` <span class="muted">(min ${fmtNum(s.minVolume)})</span>` : ''}</b></div>
        <div><span class="cap" style="background:${k?.capColor ?? '#ccc'}"></span>${esc(k?.name ?? '—')} <span class="muted">${esc(k?.additive ?? '')}</span></div>
        <div class="muted">Store: ${STORAGE_LABELS[s.storageTemp].label} (${STORAGE_LABELS[s.storageTemp].range})${s.protectFromLight ? ' · protect from light' : ''}${stab ? ` · Stable: ${stab}` : ''}</div>
        ${s.notes ? `<div class="muted">${esc(s.notes)}</div>` : ''}
      </div>`
    })
    .join('')
  const list = (items: string[]) => items.map((x) => `<li>${esc(x)}</li>`).join('')
  const html = `<html><head><meta name="viewport" content="width=device-width">${PAGE}</head><body>
    <div class="rail" style="--dep:${dep?.color ?? '#999'}">
      <div class="code">${esc(t.code)}</div><h1>${esc(t.name)}</h1>
      <div class="muted">${esc(dep?.name ?? '')}${t.synonyms.length ? ' · aka ' + esc(t.synonyms.join(', ')) : ''}</div>
    </div>
    ${t.description ? `<p>${esc(t.description)}</p>` : ''}
    <h2>Samples — ${specimenSummary(t)}</h2>${samples}
    ${t.transportNotes ? `<p class="muted">Transport: ${esc(t.transportNotes)}</p>` : ''}
    <h2>Turnaround</h2>
    <table><tr><td>Routine</td><td><b>${formatDuration(t.tatRoutine)}</b></td><td>STAT</td><td><b>${formatDuration(t.tatUrgent)}</b></td><td>Performed</td><td><b>${esc(t.daysPerformed || '—')}</b></td></tr></table>
    ${t.patientPrep ? `<h2>Patient preparation</h2><p>${esc(t.patientPrep)}</p>` : ''}
    ${t.suggestions.length ? `<h2>Collection tips</h2><ul>${list(t.suggestions)}</ul>` : ''}
    ${t.rejectionCriteria.length ? `<h2>Reject if</h2><ul class="reject">${list(t.rejectionCriteria)}</ul>` : ''}
    <p class="muted">LabDex · v${t.version} · printed ${new Date().toLocaleString()}</p>
  </body></html>`
  await Print.printAsync({ html })
}

export async function printPlan(plan: CollectionPlan, tests: LabTest[]): Promise<void> {
  const draw = (d: CollectionPlan['blood'][number], i?: number) => `<tr>
      <td>${i != null ? `<b>${i + 1}</b>` : ''}</td>
      <td><span class="cap" style="background:${d.container.capColor}"></span><b>${esc(d.container.name)}</b><br><span class="muted">${esc(d.container.additive)}</span></td>
      <td>${d.tubes > 1 ? `${d.tubes} × ` : ''}${esc(d.container.size)}</td>
      <td>${d.samples.map((p) => `${esc(p.test.code)} ${esc(p.test.name)}`).join('<br>')}</td></tr>`
  const html = `<html><head><meta name="viewport" content="width=device-width">${PAGE}</head><body>
    <h1>Collection plan</h1>
    <div class="muted">${tests.length} tests · ${plan.totalContainers} containers · printed ${new Date().toLocaleString()}</div>
    ${plan.blood.length ? `<h2>Order of draw</h2><table>${plan.blood.map((d, i) => draw(d, i)).join('')}</table>` : ''}
    ${plan.other.length ? `<h2>Other specimens</h2><table>${plan.other.map((d) => draw(d)).join('')}</table>` : ''}
    ${tests.some((t) => t.patientPrep) ? `<h2>Patient preparation</h2><ul>${tests.filter((t) => t.patientPrep).map((t) => `<li><b>${esc(t.code)}</b> ${esc(t.patientPrep)}</li>`).join('')}</ul>` : ''}
  </body></html>`
  await Print.printAsync({ html })
}
