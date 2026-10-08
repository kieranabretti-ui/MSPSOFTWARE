import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, ChevronRight, Download, FilterX, Search } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Button, ButtonLink, Card, EmptyState, PageHeader, inputCls, cx } from '../../components/ui'
import { ConfidenceLevel } from '../../components/ConfidenceLevel'
import { FilterSelect } from './findings/FilterSelect'
import { FindingStatusTag, StageMark } from './findings/StatusTag'
import { findingsCsv } from './findings/csv'
import { OpportunityTabs } from './findings/OpportunityTabs'
import { downloadFile, money, plural, relative } from '../../lib/format'
import { confidenceOf } from '../../lib/confidence'
import { ALL_CATEGORIES, CATEGORY_META, CLASSIFICATION, CLASSIFICATION_ORDER, CONFIDENCE, CONFIDENCE_NOTE, FINDING_STATUS, LEVEL_ORDER, SPLIT_LABEL, STAGE_ORDER } from '../../lib/labels'
import { DISMISS_REASONS } from '../../lib/audit'
import { useToast } from '../../components/toast'
import type { ConfidenceLevel as Level, Finding, FindingClass } from '../../engine/types'
import { LoadFailed } from './overview/LoadFailed'
import { coverageLine } from './overview/copy'
import { opportunitySplit } from './overview/split'

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
const isClass = (v: string): v is FindingClass => (CLASSIFICATION_ORDER as string[]).includes(v)
type Group = '' | 'confidence' | 'classification'
const isGroup = (v: string): v is Group => v === '' || v === 'confidence' || v === 'classification'
const sep = (
  <span className="mx-1.5 text-ink-4" aria-hidden>
    ·
  </span>
)

export default function Opportunities() {
  const { data, analysis, loadError, logExport } = useStore()
  const toast = useToast()
  const m = useMetrics()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const [level, setLevel] = useState('')
  const [klass, setKlass] = useState('')
  const [group, setGroup] = useState<Group>('')
  const [status, setStatus] = useState(params.get('status') ?? 'active')
  const [client, setClient] = useState(params.get('client') ?? '')
  const [q, setQ] = useState('')
  const term = useDeferredValue(q.trim().toLowerCase())

  // Confidence, classification and search text once per finding, not once per keystroke.
  const index = useMemo(
    () =>
      new Map(
        data.findings.map((f) => {
          const r = confidenceOf(f)
          return [
            f.id,
            {
              level: r.level,
              classification: r.classification,
              text: `${f.title} ${f.description} ${m.clientName(f.client_id)} ${f.meta.ticket_ref ?? ''}`.toLowerCase(),
            },
          ] as const
        }),
      ),
    [data.findings, m],
  )

  const rows = useMemo(
    () =>
      data.findings
        .filter((f) => !category || f.category === category)
        .filter((f) => !level || index.get(f.id)?.level === level)
        .filter((f) => !klass || index.get(f.id)?.classification === klass)
        .filter((f) => (status === 'active' ? f.status !== 'dismissed' : !status || f.status === status))
        .filter((f) => !client || f.client_id === client)
        .filter((f) => !term || index.get(f.id)?.text.includes(term))
        .sort((a, b) => b.estimated_value - a.estimated_value),
    [data.findings, index, category, level, klass, status, client, term],
  )

  // The first hundred rows, then a hundred more at a time. A new filter starts
  // from the top again.
  const view = [category, level, klass, status, client, term].join('|')
  const [shown, setShown] = useState({ view, limit: PAGE })
  const limit = shown.view === view ? shown.limit : PAGE

  if (!analysis)
    return (
      <>
        <PageHeader title="Opportunities" />
        <LoadFailed />
        <OpportunityTabs />
        {!loadError && (
          <Card>
            <EmptyState
              title="No opportunities yet"
              body="Run your first analysis to find unbilled work, agreement drift and underpriced clients, each with the evidence and calculation behind it."
              action={
                <ButtonLink to="/app/analyses" variant="accent">
                  Start analysis
                </ButtonLink>
              }
            />
          </Card>
        )}
      </>
    )

  // Totals split the same way as the Overview: High confidence on its own.
  const split = opportunitySplit(rows)
  const clients = [...new Set(data.findings.map((f) => f.client_id))].map((id) => ({ id, name: m.clientName(id) })).sort((a, b) => a.name.localeCompare(b.name))
  const filtered = Boolean(category || level || klass || status !== 'active' || client || q.trim())
  const visible = rows.slice(0, limit)
  const groupOf = (f: Finding): string => {
    const r = index.get(f.id) ?? confidenceOf(f)
    return group === 'confidence' ? r.level : group === 'classification' ? r.classification : ''
  }
  const groups =
    group === ''
      ? [{ key: '', label: '', rows: visible, all: rows }]
      : (group === 'confidence' ? (LEVEL_ORDER as string[]) : (CLASSIFICATION_ORDER as string[]))
          .map((key) => ({
            key,
            label: group === 'confidence' ? CONFIDENCE[key as Level].label : CLASSIFICATION[key as FindingClass].label,
            rows: visible.filter((f) => groupOf(f) === key),
            all: rows.filter((f) => groupOf(f) === key),
          }))
          .filter((g) => g.rows.length)

  const clearFilters = () => {
    setLevel('')
    setKlass('')
    setStatus('active')
    setClient('')
    setQ('')
    const next = new URLSearchParams(params)
    for (const k of ['category', 'status', 'client']) next.delete(k)
    setParams(next, { replace: true })
  }

  const exportCsv = async () => {
    downloadFile('headroom-opportunities.csv', findingsCsv(rows, m.clientName), 'text/csv')
    try {
      await logExport('csv', { rows: rows.length, scope: 'opportunities' })
    } catch (e) {
      console.warn('Could not record the export', e)
      toast('The CSV downloaded, but it could not be recorded in the activity log.', 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Opportunities"
        subtitle={
          rows.length ? (
            <>
              <span className="inline-block">
                {SPLIT_LABEL.high} <span className="tnum font-semibold text-ink">{money(split.high.value)}</span>
              </span>
              {sep}
              <span className="sr-only">, </span>
              <span className="inline-block">
                {SPLIT_LABEL.review} <span className="tnum font-semibold text-ink">{money(split.review.value)}</span>
              </span>
              {sep}
              <span className="sr-only">, </span>
              <span className="inline-block">
                {SPLIT_LABEL.total} <span className="tnum font-semibold text-ink">{money(split.total.value)}</span> across{' '}
                <span className="tnum">{plural(rows.length, 'opportunity', 'opportunities')}</span>
              </span>
              {split.total.monthly > 0 && (
                <>
                  {sep}
                  <span className="sr-only">, </span>
                  <span className="inline-block">
                    <span className="tnum font-semibold text-ink">{money(split.total.monthly)}</span> a month recurring
                  </span>
                </>
              )}
            </>
          ) : (
            'No opportunities in this view.'
          )
        }
        actions={
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!rows.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />
      <LoadFailed />
      <OpportunityTabs />

      <div className="mb-3 flex flex-col gap-2" role="search">
        <div className="relative min-w-0 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className={cx(inputCls, 'pl-9 text-small')} placeholder="Search opportunities, clients, ticket #" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search opportunities" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <FilterSelect
            className="sm:w-40"
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
          <FilterSelect className="sm:w-40" value={level} active={!!level} onChange={(e) => setLevel(isLevel(e.target.value) ? e.target.value : '')} aria-label="Confidence">
            <option value="">All confidence levels</option>
            {LEVEL_ORDER.map((l) => (
              <option key={l} value={l}>
                {CONFIDENCE[l].label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect className="sm:w-44" value={klass} active={!!klass} onChange={(e) => setKlass(isClass(e.target.value) ? e.target.value : '')} aria-label="Classification">
            <option value="">All classifications</option>
            {CLASSIFICATION_ORDER.map((c) => (
              <option key={c} value={c}>
                {CLASSIFICATION[c].label}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect className="sm:w-44" value={status} active={status !== 'active'} onChange={(e) => setStatus(e.target.value)} aria-label="Stage">
            <option value="active">Active (not dismissed)</option>
            <option value="">Any stage</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {FINDING_STATUS[s]}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect className="sm:w-40" value={client} active={!!client} onChange={(e) => setClient(e.target.value)} aria-label="Client">
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect className="sm:w-48" value={group} active={!!group} onChange={(e) => setGroup(isGroup(e.target.value) ? e.target.value : '')} aria-label="Group by">
            <option value="">No grouping</option>
            <option value="confidence">Group by confidence</option>
            <option value="classification">Group by classification</option>
          </FilterSelect>
          {filtered && (
            <Button variant="ghost" size="sm" className="col-span-2 h-9 sm:col-span-1" onClick={clearFilters}>
              <FilterX className="size-4" /> Clear
            </Button>
          )}
        </div>
      </div>
      <p className="mb-4 max-w-[110ch] text-caption text-ink-3">
        {CONFIDENCE_NOTE}{' '}
        {LEVEL_ORDER.map((l, i) => (
          <span key={l}>
            {i > 0 && ' '}
            <span className="font-medium text-ink-2">{CONFIDENCE[l].short}:</span> {CONFIDENCE[l].definition}
          </span>
        ))}
      </p>

      <Card className="overflow-hidden">
        {rows.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <caption className="sr-only">
                  Opportunities, highest potential value first
                  {group ? `, grouped by ${group}` : ''}
                </caption>
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
                          <span className="hidden sm:inline">Potential </span>
                          value
                        </span>
                      </span>
                    </th>
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody key={g.key || 'all'} className="divide-y divide-line-soft">
                    {g.label && (
                      <tr className="border-t border-line-soft bg-sunken first:border-t-0">
                        <th scope="colgroup" colSpan={5} className="px-4 py-2 text-left text-small font-medium text-ink-2 sm:px-5">
                          {g.label}
                          <span className="tnum ml-2 font-normal text-ink-3">
                            {plural(g.all.length, 'opportunity', 'opportunities')} · {money(g.all.reduce((a, f) => a + f.estimated_value, 0))}
                          </span>
                        </th>
                      </tr>
                    )}
                    {g.rows.map((f) => {
                      const r = index.get(f.id) ?? confidenceOf(f)
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
                            <span className="mt-0.5 block text-caption text-ink-3 sm:truncate">
                              {m.clientName(f.client_id)}
                              {f.meta.ticket_ref && <span className="tnum whitespace-nowrap"> · Ticket #{f.meta.ticket_ref}</span>}
                              <span className="hidden sm:inline xl:hidden"> · {CATEGORY_META[f.category].short}</span>
                            </span>
                            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:hidden">
                              <ConfidenceLevel level={r.level} short />
                              <span className="text-caption text-ink-3">{CLASSIFICATION[r.classification].short}</span>
                              <span className="text-caption text-ink-3">{CATEGORY_META[f.category].short}</span>
                              {f.status !== 'open' && <FindingStatusTag status={f.status} />}
                            </span>
                            {f.status !== 'open' && (
                              <span className="mt-2 hidden sm:flex md:hidden">
                                <FindingStatusTag status={f.status} />
                              </span>
                            )}
                          </td>
                          <td className={cx('whitespace-nowrap px-3 py-3 text-ink-2', COL.category)}>{CATEGORY_META[f.category].short}</td>
                          <td className={cx('whitespace-nowrap px-3 py-3', COL.confidence)}>
                            <ConfidenceLevel level={r.level} short />
                            <span className="mt-0.5 block text-caption text-ink-3" title={CLASSIFICATION[r.classification].label}>
                              {CLASSIFICATION[r.classification].short}
                            </span>
                          </td>
                          <td className={cx('whitespace-nowrap px-3 py-3', COL.stage)}>
                            {f.status === 'open' ? (
                              <span className="inline-flex items-center gap-1.5 text-caption text-ink-3">
                                <StageMark status="open" />
                                {FINDING_STATUS.open}
                              </span>
                            ) : (
                              <FindingStatusTag status={f.status} />
                            )}
                          </td>
                          <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right align-top sm:pr-5 sm:align-middle">
                            <span className="tnum block text-body font-semibold text-ink">{money(f.estimated_value)}</span>
                            {f.monthly_value > 0 && <span className="tnum mt-0.5 block text-caption text-ink-3">{money(f.monthly_value)}/mo</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                ))}
                <tfoot>
                  <tr className="border-t border-line bg-sunken">
                    <td className="py-3 pl-4 pr-3 text-small text-ink-2 sm:pl-5">
                      {SPLIT_LABEL.total} <span className="tnum text-ink-3">· {plural(rows.length, 'opportunity', 'opportunities')}</span>
                      <span className="tnum mt-0.5 block text-caption text-ink-3">
                        {SPLIT_LABEL.high} {money(split.high.value)} ({split.high.count}) · {SPLIT_LABEL.review} {money(split.review.value)} ({split.review.count})
                      </span>
                    </td>
                    <td className={COL.category} />
                    <td className={COL.confidence} />
                    <td className={COL.stage} />
                    <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right align-top sm:pr-5">
                      <span className="tnum block text-body font-semibold text-ink">{money(split.total.value)}</span>
                      {split.total.monthly > 0 && <span className="tnum mt-0.5 block text-caption text-ink-3">{money(split.total.monthly)}/mo recurring</span>}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {rows.length > visible.length && (
              <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="tnum text-caption text-ink-3">
                  Showing {visible.length} of {plural(rows.length, 'opportunity', 'opportunities')}. The totals include them all.
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
        ) : loadError ? (
          <EmptyState title="Opportunities could not be loaded" body="Try again above. Nothing here reflects your saved data until it loads." />
        ) : (
          <EmptyState title="No opportunities in this analysis" body={coverageLine(analysis.summary)} />
        )}
      </Card>

      <NoLongerDetected findings={data.stale_findings} clientName={m.clientName} />
    </>
  )
}

// Findings a person decided on that the latest analysis no longer produces.
// They are kept, out of every total, so the decision and its history survive.
function NoLongerDetected({ findings, clientName }: { findings: Finding[]; clientName: (id: string | null) => string }) {
  if (!findings.length) return null
  const sorted = [...findings].sort((a, b) => ((b.decided_at ?? b.updated_at) > (a.decided_at ?? a.updated_at) ? 1 : -1))
  return (
    <details className="group mt-8 overflow-hidden rounded-xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-hover sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-body font-medium text-ink">
            <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform duration-150 group-open:rotate-90" aria-hidden />
            No longer detected
            <span className="tnum font-normal text-ink-3">{findings.length}</span>
          </span>
          <span className="mt-0.5 block pl-5.5 text-caption text-ink-3">
            The latest analysis no longer finds these. They are kept because someone made a decision on them, and they are left out of every total.
          </span>
        </span>
      </summary>
      <ul className="divide-y divide-line-soft border-t border-line-soft">
        {sorted.map((f) => (
          <li key={f.id}>
            <Link to={`/app/opportunities/${f.id}`} className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-hover focus-visible:-outline-offset-2 sm:px-5">
              <span className="min-w-0 flex-1">
                <span className="block text-small font-medium text-ink-2 sm:truncate">{f.title}</span>
                <span className="mt-0.5 block text-caption text-ink-3">
                  {clientName(f.client_id)} · {FINDING_STATUS[f.status]}
                  {f.status === 'dismissed' && f.dismiss_reason && ` (${DISMISS_REASONS[f.dismiss_reason].label.toLowerCase()})`}
                  {f.decided_at && ` · decided ${relative(f.decided_at)}`}
                </span>
              </span>
              <span className="tnum shrink-0 text-small text-ink-3">{money(f.estimated_value)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  )
}
