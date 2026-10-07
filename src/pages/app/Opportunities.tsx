import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, Download, FilterX, Search } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Button, Card, EmptyState, PageHeader, inputCls, cx } from '../../components/ui'
import { ConfidenceLevel } from '../../components/ConfidenceLevel'
import { GetStarted } from './Overview'
import { FilterSelect } from './findings/FilterSelect'
import { FindingStatusTag } from './findings/StatusTag'
import { OpportunityTabs } from './findings/OpportunityTabs'
import { downloadFile, money, plural, toCsv } from '../../lib/format'
import { confidenceOf } from '../../lib/confidence'
import { formatCalculation } from '../../lib/calculation'
import { ALL_CATEGORIES, CATEGORY_META, CONFIDENCE, FINDING_STATUS, LEVEL_ORDER, STAGE_ORDER } from '../../lib/labels'
import type { ConfidenceLevel as Level, Finding, FindingStatus } from '../../engine/types'

export function StatusBadge({ status }: { status: FindingStatus }) {
  return <FindingStatusTag status={status} />
}

// One row per opportunity, in the product's words. The raw stage and the
// confidence score stay alongside the labels for anyone re-sorting in a sheet.
export function findingsCsv(findings: Finding[], clientName: (id: string) => string) {
  return toCsv(
    findings.map((f) => ({
      id: f.id,
      client: clientName(f.client_id),
      category: CATEGORY_META[f.category].label,
      stage: FINDING_STATUS[f.status],
      status: f.status,
      confidence_level: CONFIDENCE[confidenceOf(f).level].short,
      confidence_score: f.confidence,
      priority: f.severity,
      title: f.title,
      description: f.description,
      calculation: formatCalculation(f)?.lines.join(' / ') ?? '',
      estimated_value: f.estimated_value,
      monthly_value: f.monthly_value,
      annual_value: f.annual_value,
      recommended_action: f.recommended_action,
      evidence: f.evidence.map((e) => `${e.label}: ${e.text.replace(/\n/g, ' / ')}`).join(' | '),
      source_data: f.source_data.map((s) => `${s.table}:${s.label}`).join('; '),
    })),
  )
}

// Column visibility, shared by the header, the rows and the totals row so the
// table keeps one grid at every width. The opportunity and its value always show.
const COL = {
  category: 'hidden xl:table-cell',
  confidence: 'hidden sm:table-cell',
  stage: 'hidden md:table-cell',
}
const TH = 'px-3 py-2.5 text-left text-label uppercase text-ink-3'
const PAGE = 100
const isLevel = (v: string): v is Level => (LEVEL_ORDER as string[]).includes(v)

export default function Opportunities() {
  const { data, analysis } = useStore()
  const m = useMetrics()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState(params.get('status') ?? 'active')
  const [client, setClient] = useState(params.get('client') ?? '')
  const [q, setQ] = useState('')
  const term = useDeferredValue(q.trim().toLowerCase())

  // Confidence and search text once per finding, not once per keystroke.
  const index = useMemo(
    () => new Map(data.findings.map((f) => [f.id, { level: confidenceOf(f).level, text: `${f.title} ${f.description} ${m.clientName(f.client_id)} ${f.meta.ticket_ref ?? ''}`.toLowerCase() }])),
    [data.findings, m],
  )

  const rows = useMemo(
    () =>
      data.findings
        .filter((f) => !category || f.category === category)
        .filter((f) => !level || index.get(f.id)?.level === level)
        .filter((f) => (status === 'active' ? f.status !== 'dismissed' : !status || f.status === status))
        .filter((f) => !client || f.client_id === client)
        .filter((f) => !term || index.get(f.id)?.text.includes(term))
        .sort((a, b) => b.estimated_value - a.estimated_value),
    [data.findings, index, category, level, status, client, term],
  )

  // The first hundred rows, then a hundred more at a time. A new filter starts
  // from the top again.
  const view = [category, level, status, client, term].join('|')
  const [shown, setShown] = useState({ view, limit: PAGE })
  const limit = shown.view === view ? shown.limit : PAGE

  if (!analysis)
    return (
      <>
        <PageHeader title="Opportunities" />
        <OpportunityTabs />
        <GetStarted />
      </>
    )

  const total = rows.reduce((a, f) => a + f.estimated_value, 0)
  const monthly = rows.reduce((a, f) => a + f.monthly_value, 0)
  const clients = [...new Set(data.findings.map((f) => f.client_id))].map((id) => ({ id, name: m.clientName(id) })).sort((a, b) => a.name.localeCompare(b.name))
  const filtered = Boolean(category || level || status !== 'active' || client || q.trim())
  const visible = rows.slice(0, limit)

  const clearFilters = () => {
    setLevel('')
    setStatus('active')
    setClient('')
    setQ('')
    const next = new URLSearchParams(params)
    for (const k of ['category', 'status', 'client']) next.delete(k)
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Opportunities"
        subtitle={
          rows.length ? (
            <>
              <span className="tnum font-semibold text-ink">{money(total)}</span> potential across <span className="tnum">{plural(rows.length, 'opportunity', 'opportunities')}</span>
              {monthly > 0 && (
                <>
                  <span className="mx-1.5 text-ink-4" aria-hidden>
                    ·
                  </span>
                  <span className="sr-only">, </span>
                  <span className="inline-block">
                    <span className="tnum font-semibold text-accent">{money(monthly)}</span> a month recurring
                  </span>
                </>
              )}
            </>
          ) : (
            'No opportunities in this view.'
          )
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => downloadFile('headroom-opportunities.csv', findingsCsv(rows, m.clientName), 'text/csv')} disabled={!rows.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />
      <OpportunityTabs />

      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center" role="search">
        <div className="relative min-w-0 xl:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className={cx(inputCls, 'pl-9 text-small')} placeholder="Search opportunities, clients, ticket #" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search opportunities" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect
            className="sm:w-44"
            value={category}
            active={!!category}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              if (e.target.value) next.set('category', e.target.value)
              else next.delete('category')
              setParams(next, { replace: true })
            }}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_META[c].label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect className="sm:w-44" value={level} active={!!level} onChange={(e) => setLevel(isLevel(e.target.value) ? e.target.value : '')} aria-label="Confidence">
            <option value="">All confidence levels</option>
            {LEVEL_ORDER.map((l) => (
              <option key={l} value={l}>
                {CONFIDENCE[l].short}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect className="col-span-2 sm:col-span-1 sm:w-48" value={status} active={status !== 'active'} onChange={(e) => setStatus(e.target.value)} aria-label="Stage">
            <option value="active">Active (not dismissed)</option>
            <option value="">Any stage</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {FINDING_STATUS[s]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect className="col-span-2 sm:col-span-1 sm:w-44" value={client} active={!!client} onChange={(e) => setClient(e.target.value)} aria-label="Client">
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FilterSelect>
          {filtered && (
            <Button variant="ghost" size="sm" className="col-span-2 h-9 sm:col-span-1" onClick={clearFilters}>
              <FilterX className="size-4" /> Clear
            </Button>
          )}
        </div>
      </div>
      <p className="mb-4 text-caption text-ink-3">
        {LEVEL_ORDER.map((l, i) => (
          <span key={l}>
            {i > 0 && (
              <span className="mx-1.5 text-ink-4" aria-hidden>
                ·
              </span>
            )}
            <span className="font-medium text-ink-2">{CONFIDENCE[l].short}:</span> {CONFIDENCE[l].definition}
          </span>
        ))}
      </p>

      <Card className="overflow-hidden">
        {rows.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <thead>
                  <tr className="border-b border-line-soft bg-sunken">
                    <th scope="col" className={cx(TH, 'pl-4 sm:pl-5')}>
                      Opportunity
                    </th>
                    <th scope="col" className={cx(TH, COL.category)}>
                      Category
                    </th>
                    <th scope="col" className={cx(TH, COL.confidence)}>
                      Confidence
                    </th>
                    <th scope="col" className={cx(TH, COL.stage)}>
                      Stage
                    </th>
                    <th scope="col" className={cx(TH, 'whitespace-nowrap pr-4 text-right sm:pr-5')} aria-sort="descending">
                      <span className="inline-flex items-center gap-1">
                        <ArrowDown className="size-3" aria-hidden />
                        <span>
                          <span className="hidden sm:inline">Potential </span>value
                        </span>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {visible.map((f) => {
                    const lvl = index.get(f.id)?.level ?? confidenceOf(f).level
                    return (
                      <tr key={f.id} className="group cursor-pointer transition-colors duration-150 hover:bg-hover" onClick={() => nav(`/app/opportunities/${f.id}`)}>
                        <td className="w-full max-w-0 py-3 pl-4 pr-3 sm:pl-5">
                          <Link
                            to={`/app/opportunities/${f.id}`}
                            title={f.title}
                            className="line-clamp-2 text-body font-medium text-ink decoration-ink-4 underline-offset-4 group-hover:underline md:line-clamp-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {f.title}
                          </Link>
                          <span className="mt-0.5 block truncate text-caption text-ink-3">
                            {m.clientName(f.client_id)}
                            {f.meta.ticket_ref && <span className="tnum"> · Ticket #{f.meta.ticket_ref}</span>}
                            <span className="hidden sm:inline xl:hidden"> · {CATEGORY_META[f.category].short}</span>
                          </span>
                          <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:hidden">
                            <ConfidenceLevel level={lvl} short />
                            <span className="text-caption text-ink-3">{CATEGORY_META[f.category].short}</span>
                            {f.status !== 'open' && <StatusBadge status={f.status} />}
                          </span>
                          {f.status !== 'open' && (
                            <span className="mt-2 hidden sm:flex md:hidden">
                              <StatusBadge status={f.status} />
                            </span>
                          )}
                        </td>
                        <td className={cx('whitespace-nowrap px-3 py-3 text-ink-2', COL.category)}>{CATEGORY_META[f.category].short}</td>
                        <td className={cx('whitespace-nowrap px-3 py-3', COL.confidence)}>
                          <ConfidenceLevel level={lvl} short />
                        </td>
                        <td className={cx('whitespace-nowrap px-3 py-3', COL.stage)}>
                          {f.status === 'open' ? <span className="sr-only">{FINDING_STATUS.open}</span> : <StatusBadge status={f.status} />}
                        </td>
                        <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right align-top sm:pr-5 sm:align-middle">
                          <span className="tnum block text-body font-semibold text-ink">{money(f.estimated_value)}</span>
                          {f.monthly_value > 0 && <span className="tnum mt-0.5 block text-caption text-ink-3">{money(f.monthly_value)}/mo</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-line bg-sunken">
                    <td className="py-3 pl-4 pr-3 text-small text-ink-2 sm:pl-5">
                      Total <span className="tnum text-ink-3">· {plural(rows.length, 'opportunity', 'opportunities')}</span>
                    </td>
                    <td className={COL.category} />
                    <td className={COL.confidence} />
                    <td className={COL.stage} />
                    <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right sm:pr-5">
                      <span className="tnum block text-body font-semibold text-ink">{money(total)}</span>
                      {monthly > 0 && <span className="tnum mt-0.5 block text-caption text-accent">{money(monthly)}/mo recurring</span>}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {rows.length > visible.length && (
              <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="tnum text-caption text-ink-3">
                  Showing {visible.length} of {plural(rows.length, 'opportunity', 'opportunities')}. The total above includes them all.
                </p>
                <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={() => setShown({ view, limit: limit + PAGE })}>
                  Show {Math.min(PAGE, rows.length - visible.length)} more
                </Button>
              </div>
            )}
          </>
        ) : data.findings.length ? (
          <EmptyState
            title="No opportunities match these filters"
            body="Clear a filter or search for a different client, category or ticket number."
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>
                <FilterX className="size-4" /> Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No leakage found in this data"
            body="The analysis checked your tickets, time entries, agreements and billing lines and found nothing to flag. Add more months of exports to widen the check."
          />
        )}
      </Card>
    </>
  )
}
