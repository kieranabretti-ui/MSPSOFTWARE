import { Link } from 'react-router-dom'
import { useStore } from '../../../data/store'
import { plural } from '../../../lib/format'
import type { Finding, SourceRef } from '../../../engine/types'
import { EvidenceRow, ValueByMonth } from './evidence'
import { SETTING_LABEL, SOURCE_META, TABLE_NOUN, groupEvidence, refLocation, refRoute, rowRanges, sourceOf } from './rules'

const linkCls = 'text-ink-2 underline decoration-ink-4 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink'

function RefLine({ r }: { r: SourceRef }) {
  const { data } = useStore()
  const loc = refLocation(r)
  // A clause label already names its section; repeat only what it doesn't say.
  const where = loc && r.table === 'contracts' ? loc.split(', ').filter((p) => !r.label.includes(p)).join(', ') || null : loc
  const to = refRoute(r, data.contracts)
  const label = to ? (
    <Link to={to} className={linkCls}>
      {r.label}
    </Link>
  ) : (
    <span className="text-ink-2">{r.label}</span>
  )
  return (
    <li className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      {label}
      {where && <span className="tnum text-ink-3">{where}</span>}
    </li>
  )
}

// Where an evidence line's records sit in the customer's own files. A few are
// listed one by one; many fold into "39 users and devices · assets.csv rows 2–40"
// with the full list a click away.
export function RefList({ refs }: { refs: SourceRef[] }) {
  if (!refs.length) return null
  const seen = new Set<string>()
  const unique = refs.filter((r) => {
    const k = `${r.table}:${r.id}:${r.section ?? ''}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (unique.length <= 3)
    return (
      <div className="mt-3 border-t border-line-soft pt-2.5">
        <p className="sr-only">Source records</p>
        <ul className="space-y-1 text-caption">
          {unique.map((r, i) => (
            <RefLine key={`${r.table}:${r.id}:${i}`} r={r} />
          ))}
        </ul>
      </div>
    )
  const tables = [...new Set(unique.map((r) => r.table))]
  const files = [...new Set(unique.map((r) => r.file_name).filter(Boolean))] as string[]
  const rows = unique.map((r) => r.row).filter((n): n is number => typeof n === 'number')
  const noun = tables.length === 1 ? TABLE_NOUN[tables[0]] : (['record', 'records'] as [string, string])
  const summary = [
    `${unique.length.toLocaleString('en-GB')} ${unique.length === 1 ? noun[0] : noun[1]}`,
    files.length === 1 ? `${files[0]}${rows.length ? `, rows ${rowRanges(rows)}` : ''}` : files.length ? `${files.length} files` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  const shown = unique.slice(0, 60)
  return (
    <details className="group mt-3 border-t border-line-soft pt-2.5 text-caption">
      <summary className="tnum cursor-pointer list-none text-ink-3 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
        <span className="text-ink-2">{summary}</span>
        <span className="ml-2 font-medium text-ink-2 underline decoration-ink-4 underline-offset-4 group-open:hidden">Show records</span>
        <span className="ml-2 hidden font-medium text-ink-2 underline decoration-ink-4 underline-offset-4 group-open:inline">Hide records</span>
      </summary>
      <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto overscroll-contain pr-1">
        {shown.map((r, i) => (
          <RefLine key={`${r.table}:${r.id}:${i}`} r={r} />
        ))}
      </ul>
      {unique.length > shown.length && <p className="mt-1.5 text-ink-3">and {plural(unique.length - shown.length, 'more record')}</p>}
    </details>
  )
}

// The evidence, grouped by the system it came from (Agreement, PSA, Billing
// and so on), each line closed by the records it was read from.
export function EvidenceLedger({ finding: f }: { finding: Finding }) {
  const groups = groupEvidence(f.evidence)
  const months = Object.keys(f.meta.period_values)
  const hasHighlights = f.evidence.some((e) => e.highlights?.length)
  return (
    <section aria-labelledby="evidence-heading">
      <div className="border-b border-line-soft px-5 py-4">
        <h2 id="evidence-heading" className="text-h3 text-ink">
          Evidence
        </h2>
        <p className="mt-0.5 text-small text-ink-3">
          {plural(f.evidence.length, 'line')} of evidence from {plural(groups.length, 'source')}, each traced to the record it was read from.{hasHighlights ? ' Matched phrases are highlighted.' : ''}
        </p>
      </div>
      {groups.map((g) => (
        <div key={g.source} className="border-b border-line-soft last:border-b-0">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 bg-sunken/60 px-5 py-2">
            <h3 className="text-small font-semibold text-ink">{SOURCE_META[g.source].label}</h3>
            <p className="text-caption text-ink-3">{SOURCE_META[g.source].blurb}</p>
          </div>
          <div className="divide-y divide-line-soft">
            {g.items.map(({ e, i }) => (
              <EvidenceRow
                key={i}
                evidence={e}
                nonBillableMinutes={f.meta.minutes}
                refs={
                  sourceOf(e) === 'settings' && e.setting_keys?.length ? (
                    <p className="mt-3 border-t border-line-soft pt-2.5 text-caption text-ink-3">
                      From Settings: {e.setting_keys.map((k) => SETTING_LABEL[k] ?? k).join(', ')}.{' '}
                      <Link to="/app/settings" className={linkCls}>
                        Change in Settings
                      </Link>
                    </p>
                  ) : e.refs?.length ? (
                    <RefList refs={e.refs} />
                  ) : undefined
                }
              />
            ))}
          </div>
        </div>
      ))}
      {months.length > 1 && (
        <div className="border-t border-line-soft">
          <ValueByMonth periodValues={f.meta.period_values} total={f.estimated_value} />
        </div>
      )}
    </section>
  )
}
