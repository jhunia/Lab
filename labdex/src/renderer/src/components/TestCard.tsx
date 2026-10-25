import { formatDuration, primarySpecimen, type Container, type Department, type TestInput } from '@shared/types'
import { specimenSummary } from '@shared/helpers'
import { cx, fmtNum } from '../lib/util'
import { StorageBadge, TatBar, TubeStack } from './Visuals'

interface Props {
  test: TestInput
  dep?: Department
  conOf: (id: string) => Container | undefined
  selected?: boolean
  onClick?: () => void
  preview?: boolean
}

export function TestCard({ test, dep, conOf, selected, onClick, preview }: Props) {
  const Tag = onClick ? 'button' : 'div'
  const main = primarySpecimen(test)
  const multi = test.specimens.length > 1
  const containers = test.specimens.map((s) => conOf(s.containerId))
  const label = multi ? `${test.specimens.length} samples` : (containers[0]?.name.replace(/ top.*$/i, '') ?? '—')
  return (
    <Tag
      className={cx('card', selected && 'selected', test.status === 'ARCHIVED' && 'archived', preview && 'preview')}
      style={{ ['--dep' as string]: dep?.color ?? 'var(--line-strong)' }}
      onClick={onClick}
    >
      <span className="card-rail" />
      <div className="card-body">
        <div className="card-top">
          <span className="mono code">{test.code || 'CODE'}</span>
          {test.status !== 'PUBLISHED' && <span className={`status status-${test.status.toLowerCase()}`}>{test.status.toLowerCase()}</span>}
        </div>
        <h3>{test.name || 'Untitled test'}</h3>
        <p className="card-sample">
          {multi ? (
            <>{specimenSummary(test)}</>
          ) : (
            <>
              {main?.sampleType || 'Sample type'} · <span className="mono">{main && main.volume > 0 ? `${fmtNum(main.volume)} ${main.volumeUnit}` : '— mL'}</span>
            </>
          )}
        </p>
        <div className="card-foot">
          <StorageBadge temp={main?.storageTemp ?? 'ROOM'} compact />
          <span className="card-tat">
            <TatBar routine={test.tatRoutine} urgent={test.tatUrgent} />
            <span className="mono">{test.tatRoutine.value > 0 ? formatDuration(test.tatRoutine) : '—'}</span>
          </span>
        </div>
      </div>
      <div className="card-tube" title={containers.map((c) => c?.name).filter(Boolean).join(' + ')}>
        <TubeStack containers={containers} size={52} />
        <span className="card-tube-label">{label}</span>
      </div>
    </Tag>
  )
}
