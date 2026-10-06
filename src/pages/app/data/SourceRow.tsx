import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { Badge, cx } from '../../../components/ui'
import type { FieldDef } from '../../../data/importers'
import { SOURCES, type SourceKind } from './sources'

// One export in the sources ledger: what it is, the columns it needs, what is
// loaded, and the action to load it.
export function SourceRow({
  kind,
  title,
  description,
  fields,
  checks,
  count,
  updated,
  actions,
}: {
  kind: SourceKind
  title: string
  description: string
  fields?: FieldDef[]
  checks?: string
  count: string | null
  updated?: string | null
  actions: ReactNode
}) {
  const meta = SOURCES[kind]
  const loaded = count != null
  const required = fields?.filter((f) => f.required) ?? []
  const optional = fields?.filter((f) => !f.required) ?? []
  return (
    <li className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-4 gap-y-4 px-4 py-5 sm:px-5 lg:grid-cols-[1.25rem_minmax(0,1fr)_9rem_11.5rem] lg:gap-x-6">
      <span
        className={cx('mt-px flex size-5 items-center justify-center rounded-full', loaded ? 'bg-success-soft text-success ring-1 ring-inset ring-success-line' : 'border border-dashed border-line-strong')}
        aria-hidden
      >
        {loaded && <Check className="size-3" />}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <h3 className="text-h3 text-ink">{title}</h3>
          {meta.need && <Badge tone={meta.need === 'Required' && !loaded ? 'warning' : 'neutral'}>{meta.need}</Badge>}
          <span className="sr-only">{loaded ? `Loaded: ${count}` : 'Not uploaded yet'}</span>
        </div>
        <p className="mt-1 max-w-[68ch] text-small text-ink-2">{description}</p>
        <p className="mt-1 text-caption text-ink-3">
          {meta.from} · {meta.finds}
        </p>

        {fields && (
          <dl className="mt-3.5 space-y-2">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
              <dt className="w-16 shrink-0 text-caption text-ink-3">Required</dt>
              <dd className="flex flex-wrap gap-1">
                {required.map((f) => (
                  <code key={f.key} title={f.label} className="rounded-xs bg-raised px-1.5 py-0.5 font-mono text-[11px] leading-4 text-ink ring-1 ring-inset ring-line-strong">
                    {f.key}
                  </code>
                ))}
              </dd>
            </div>
            {optional.length > 0 && (
              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
                <dt className="w-16 shrink-0 text-caption text-ink-3">Optional</dt>
                <dd className="flex flex-wrap gap-1">
                  {optional.map((f) => (
                    <code key={f.key} title={f.label} className="rounded-xs px-1.5 py-0.5 font-mono text-[11px] leading-4 text-ink-3 ring-1 ring-inset ring-line-soft">
                      {f.key}
                    </code>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        )}
        {checks && (
          <dl className="mt-3.5 flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-3">
            <dt className="w-16 shrink-0 text-caption text-ink-3">Reads</dt>
            <dd className="max-w-[68ch] text-caption text-ink-2">{checks}</dd>
          </dl>
        )}
      </div>

      <div className="col-start-2 flex items-baseline gap-2 lg:col-start-auto lg:block lg:text-right">
        {loaded ? (
          <>
            <p className="tnum text-body font-semibold text-ink">{count}</p>
            {updated && <p className="tnum text-caption text-ink-3 lg:mt-0.5">Updated {updated}</p>}
          </>
        ) : (
          <p className="text-small text-ink-3">Not uploaded</p>
        )}
      </div>

      <div className="col-start-2 flex flex-wrap items-center gap-x-3 gap-y-2 lg:col-start-auto lg:flex-col lg:items-end">{actions}</div>
    </li>
  )
}
