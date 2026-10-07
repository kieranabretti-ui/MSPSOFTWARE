import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowDown, Download, FilterX, Search } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Button, Card, Confidence, EmptyState, PageHeader, SeverityBadge, inputCls, cx } from '../../components/ui'
import { GetStarted } from './Overview'
import { FilterSelect } from './findings/FilterSelect'
import { FindingStatusTag } from './findings/StatusTag'
import { downloadFile, money, plural, toCsv } from '../../lib/format'
import { ALL_CATEGORIES, CATEGORY_META, FINDING_STATUS, SEVERITY_ORDER } from '../../lib/labels'
import type { Finding, FindingStatus } from '../../engine/types'

export function StatusBadge({ status }: { status: FindingStatus }) {
  return <FindingStatusTag status={status} />
}

export function findingsCsv(findings: Finding[], clientName: (id: string) => string) {
  return toCsv(
    findings.map((f) => ({
      id: f.id,
      client: clientName(f.client_id),
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      title: f.title,
      description: f.description,
      estimated_value: f.estimated_value,
      monthly_value: f.monthly_value,
      annual_value: f.annual_value,
      recommended_action: f.recommended_action,
      evidence: f.evidence.map((e) => `${e.label}: ${e.text.replace(/\n/g, ' / ')}`).join(' | '),
      source_data: f.source_data.map((s) => `${s.table}:${s.label}`).join('; '),
      status: f.status,
    })),
  )
}

// Column visibility, shared by the header, the rows and the totals row so the
// table keeps one grid at every width. The finding and its value always show.
const COL = {
  category: 'hidden xl:table-cell',
  severity: 'hidden sm:table-cell',
  confidence: 'hidden md:table-cell',
  status: 'hidden md:table-cell',
}
const TH = 'px-3 py-2.5 text-left text-label uppercase text-ink-3'

export default function Findings() {
  const { data, analysis } = useStore()
  const m = useMetrics()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const category = params.get('category') ?? ''
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState(params.get('status') ?? 'active')
  const [client, setClient] = useState(params.get('client') ?? '')
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return data.findings
      .filter((f) => !category || f.category === category)
      .filter((f) => !severity || f.severity === severity)
      .filter((f) => (status === 'active' ? f.status !== 'dismissed' : !status || f.status === status))
      .filter((f) => !client || f.client_id === client)
      .filter((f) => !term || `${f.title} ${f.description} ${m.clientName(f.client_id)} ${f.meta.ticket_ref ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => b.estimated_value - a.estimated_value)
  }, [data.findings, category, severity, status, client, q, m])

  if (!analysis)
    return (
      <>
        <PageHeader title="Findings" />
        <GetStarted />
      </>
    )

  const total = rows.reduce((a, f) => a + f.estimated_value, 0)
  const monthly = rows.reduce((a, f) => a + f.monthly_value, 0)
  const clients = [...new Set(data.findings.map((f) => f.client_id))].map((id) => ({ id, name: m.clientName(id) })).sort((a, b) => a.name.localeCompare(b.name))
  const filtered = Boolean(category || severity || status !== 'active' || client || q.trim())

  const clearFilters = () => {
    setSeverity('')
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
        title="Findings"
        subtitle={
          rows.length ? (
            <>
              <span className="tnum font-semibold text-ink">{money(total)}</span> potential leakage across <span className="tnum">{plural(rows.length, 'finding')}</span>
              {monthly > 0 && (
                <>
                  <span className="mx-1.5 text-ink-4" aria-hidden>
                    ·
                  </span>
                  <span className="sr-only">, </span>
                  <span className="tnum font-semibold text-accent">{money(monthly)}</span> a month recurring
                </>
              )}
            </>
          ) : (
            'No findings in this view.'
          )
        }
        actions={
          <Button variant="secondary" size="sm" onClick={() => downloadFile('headroom-findings.csv', findingsCsv(rows, m.clientName), 'text/csv')} disabled={!rows.length}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center" role="search">
        <div className="relative min-w-0 xl:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input className={cx(inputCls, 'pl-9 text-small')} placeholder="Search findings, clients, ticket #" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search findings" />
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
          <FilterSelect className="sm:w-36" value={severity} active={!!severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity">
            <option value="">All severities</option>
            {SEVERITY_ORDER.map((s) => (
              <option key={s} value={s}>
                {s[0] + s.slice(1).toLowerCase()}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect className="sm:w-36" value={status} active={status !== 'active'} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="active">Not dismissed</option>
            <option value="">Any status</option>
            {Object.entries(FINDING_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect className="sm:w-44" value={client} active={!!client} onChange={(e) => setClient(e.target.value)} aria-label="Client">
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

      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="border-b border-line-soft bg-sunken">
                  <th scope="col" className={cx(TH, 'pl-4 sm:pl-5')}>
                    Finding
                  </th>
                  <th scope="col" className={cx(TH, COL.category)}>
                    Category
                  </th>
                  <th scope="col" className={cx(TH, COL.severity)}>
                    Severity
                  </th>
                  <th scope="col" className={cx(TH, COL.confidence)}>
                    Confidence
                  </th>
                  <th scope="col" className={cx(TH, COL.status)}>
                    Status
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
                {rows.map((f) => (
                  <tr key={f.id} className="group cursor-pointer transition-colors duration-150 hover:bg-hover" onClick={() => nav(`/app/findings/${f.id}`)}>
                    <td className="w-full max-w-0 py-3 pl-4 pr-3 sm:pl-5">
                      <Link
                        to={`/app/findings/${f.id}`}
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
                        <SeverityBadge severity={f.severity} />
                        <span className="text-caption text-ink-3">{CATEGORY_META[f.category].short}</span>
                        {f.status !== 'open' && <StatusBadge status={f.status} />}
                      </span>
                    </td>
                    <td className={cx('whitespace-nowrap px-3 py-3 text-ink-2', COL.category)}>{CATEGORY_META[f.category].short}</td>
                    <td className={cx('whitespace-nowrap px-3 py-3', COL.severity)}>
                      <SeverityBadge severity={f.severity} />
                    </td>
                    <td className={cx('whitespace-nowrap px-3 py-3', COL.confidence)}>
                      <Confidence value={f.confidence} />
                    </td>
                    <td className={cx('whitespace-nowrap px-3 py-3', COL.status)}>
                      {f.status === 'open' ? <span className="sr-only">{FINDING_STATUS.open}</span> : <StatusBadge status={f.status} />}
                    </td>
                    <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right align-top sm:pr-5 sm:align-middle">
                      <span className="tnum block text-body font-semibold text-ink">{money(f.estimated_value)}</span>
                      {f.monthly_value > 0 && <span className="tnum mt-0.5 block text-caption text-ink-3">{money(f.monthly_value)}/mo</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-sunken">
                  <td className="py-3 pl-4 pr-3 text-small text-ink-2 sm:pl-5">
                    Total <span className="tnum text-ink-3">· {plural(rows.length, 'finding')}</span>
                  </td>
                  <td className={COL.category} />
                  <td className={COL.severity} />
                  <td className={COL.confidence} />
                  <td className={COL.status} />
                  <td className="whitespace-nowrap py-3 pl-3 pr-4 text-right sm:pr-5">
                    <span className="tnum block text-body font-semibold text-ink">{money(total)}</span>
                    {monthly > 0 && <span className="tnum mt-0.5 block text-caption text-accent">{money(monthly)}/mo recurring</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : data.findings.length ? (
          <EmptyState
            title="No findings match these filters"
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
            body="The analysis checked every ticket, time entry, agreement and billing line and found nothing to flag. Add more months of exports to widen the check."
          />
        )}
      </Card>
    </>
  )
}
