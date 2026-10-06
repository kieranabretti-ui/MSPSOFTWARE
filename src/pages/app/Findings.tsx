import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Search } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Badge, Button, Card, Confidence, EmptyState, PageHeader, SeverityBadge, inputCls, cx } from '../../components/ui'
import { GetStarted } from './Overview'
import { downloadFile, money, plural, toCsv } from '../../lib/format'
import { ALL_CATEGORIES, CATEGORY_META, FINDING_STATUS, SEVERITY_ORDER } from '../../lib/labels'
import type { Finding, FindingStatus } from '../../engine/types'

const STATUS_TONE: Record<FindingStatus, 'zinc' | 'blue' | 'green' | 'amber'> = { open: 'zinc', valid: 'blue', resolved: 'green', dismissed: 'amber' }

export function StatusBadge({ status }: { status: FindingStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{FINDING_STATUS[status]}</Badge>
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
  const selectCls = cx(inputCls.replace('w-full', 'w-full sm:w-auto'), 'pr-8')
  const clients = [...new Set(data.findings.map((f) => f.client_id))].map((id) => ({ id, name: m.clientName(id) })).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <PageHeader
        title="Findings"
        subtitle={`${plural(rows.length, 'finding')} · ${money(total)} potential value`}
        actions={
          <Button variant="secondary" size="sm" onClick={() => downloadFile('msp-leak-findings.csv', findingsCsv(rows, m.clientName), 'text/csv')} disabled={!rows.length}>
            <Download className="size-3.5" /> Export CSV
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input className={cx(inputCls, 'pl-9')} placeholder="Search findings, clients, ticket #" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search findings" />
        </div>
        <select
          className={selectCls}
          value={category}
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
        </select>
        <select className={selectCls} value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity">
          <option value="">All severities</option>
          {SEVERITY_ORDER.map((s) => (
            <option key={s} value={s}>
              {s[0] + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="active">Not dismissed</option>
          <option value="">Any status</option>
          {Object.entries(FINDING_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className={selectCls} value={client} onChange={(e) => setClient(e.target.value)} aria-label="Client">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <Card className="overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs text-zinc-500">
                  <th className="px-5 py-2.5 font-medium">Finding</th>
                  <th className="px-3 py-2.5 font-medium">Category</th>
                  <th className="px-3 py-2.5 font-medium">Severity</th>
                  <th className="px-3 py-2.5 font-medium">Confidence</th>
                  <th className="px-3 py-2.5 text-right font-medium">Potential value</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((f) => (
                  <tr key={f.id} className="cursor-pointer hover:bg-zinc-50" onClick={() => nav(`/app/findings/${f.id}`)}>
                    <td className="max-w-[380px] px-5 py-3">
                      <Link to={`/app/findings/${f.id}`} className="block truncate font-medium text-zinc-900" onClick={(e) => e.stopPropagation()}>
                        {f.title}
                      </Link>
                      <span className="block truncate text-xs text-zinc-500">
                        {m.clientName(f.client_id)}
                        {f.meta.ticket_ref && ` · Ticket #${f.meta.ticket_ref}`}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-zinc-600">{CATEGORY_META[f.category].short}</td>
                    <td className="px-3 py-3">
                      <SeverityBadge severity={f.severity} />
                    </td>
                    <td className="px-3 py-3">
                      <Confidence value={f.confidence} />
                    </td>
                    <td className="tnum px-3 py-3 text-right">
                      <span className="font-semibold">{money(f.estimated_value)}</span>
                      {f.monthly_value > 0 && <span className="block text-xs text-zinc-500">{money(f.monthly_value)}/mo</span>}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={f.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No findings match these filters" body="Try clearing a filter or searching for something else." />
        )}
      </Card>
    </>
  )
}
