import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, FileText } from 'lucide-react'
import { useStore, counted } from '../../data/store'
import { Badge, Card, CardHeader, EmptyState, HealthDot, PageHeader, SeverityBadge, ButtonLink } from '../../components/ui'
import { TrendChart } from '../../components/charts'
import { StatusBadge } from './Findings'
import { hours, money, num, pct } from '../../lib/format'
import { CATEGORY_META } from '../../lib/labels'
import { extractClauses, CLAUSE_LABELS } from '../../engine/contractTerms'
import { monthLabel } from '../../engine/analyse'

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="text-body text-ink-2">{label}</span>
      <span className={`tnum text-body ${strong ? 'font-semibold' : ''} ${tone ?? ''}`}>{value}</span>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams()
  const { data, analysis, workspace } = useStore()
  const client = data.clients.find((c) => c.id === id)
  const mt = analysis?.summary.client_metrics.find((c) => c.client_id === id)
  const findings = data.findings.filter((f) => f.client_id === id).sort((a, b) => b.estimated_value - a.estimated_value)
  const contracts = data.contracts.filter((c) => c.client_id === id)
  const billing = data.billing_items.filter((b) => b.client_id === id)

  const monthly = useMemo(() => {
    if (!analysis) return []
    const h: Record<string, number> = {}
    const withEntries = new Set(data.time_entries.filter((e) => e.client_id === id && e.ticket_external_id).map((e) => e.ticket_external_id))
    for (const e of data.time_entries) if (e.client_id === id) h[e.date.slice(0, 7)] = (h[e.date.slice(0, 7)] ?? 0) + e.minutes / 60
    for (const t of data.tickets) if (t.client_id === id && !withEntries.has(t.external_id)) h[t.date.slice(0, 7)] = (h[t.date.slice(0, 7)] ?? 0) + t.time_spent_minutes / 60
    return analysis.summary.months.map((m) => ({ label: monthLabel(m), value: Math.round((h[m] ?? 0) * 10) / 10 }))
  }, [analysis, data.time_entries, data.tickets, id])

  if (!client)
    return (
      <Card>
        <EmptyState title="Client not found" body="This client may have been removed." action={<ButtonLink to="/app/clients" variant="secondary">Back to clients</ButtonLink>} />
      </Card>
    )

  const leakage = findings.filter(counted).reduce((a, f) => a + f.estimated_value, 0)
  const target = workspace?.settings.target_margin ?? 0.3

  return (
    <>
      <Link to="/app/clients" className="mb-4 inline-flex items-center gap-1.5 text-body text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> Clients
      </Link>
      <PageHeader
        title={client.name}
        subtitle={[client.package, client.contract_end && `Contract ends ${new Date(client.contract_end).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`].filter(Boolean).join(' · ') || undefined}
        actions={mt && <HealthDot health={mt.health} />}
      />

      {!mt ? (
        <Card>
          <EmptyState title="Not analysed yet" body="Upload tickets, time and agreement data for this client, then run the analysis from the Data page." action={<ButtonLink to="/app/data">Go to data</ButtonLink>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title="Profitability" subtitle={`Monthly average, ${analysis!.summary.period_label}`} />
            <div className="divide-y divide-line-soft px-5">
              <Row label="MRR" value={money(mt.mrr)} />
              <Row label="Estimated labour" value={`− ${money(mt.labour_cost)}`} />
              <Row label="Software" value={`− ${money(mt.software_cost)}`} />
              <Row label="Gross contribution" value={money(mt.contribution)} strong />
              <Row label="Gross margin" value={pct(mt.margin)} strong tone={mt.margin < target ? 'text-danger' : mt.margin < target + 0.12 ? 'text-warning' : 'text-success'} />
              <Row label="Support hours" value={`${hours(mt.avg_monthly_hours)} / month`} />
              <Row label="Revenue per technician hour" value={mt.revenue_per_hour ? money(mt.revenue_per_hour) : '—'} />
              <Row label="Potential leakage" value={money(leakage)} strong />
            </div>
            <div className="space-y-3 border-t border-line-soft p-5">
              <div>
                <p className="text-caption font-medium uppercase tracking-wide text-ink-3">Status</p>
                <div className="mt-1">
                  <HealthDot health={mt.health} />
                </div>
              </div>
              {mt.reasons.length > 0 && (
                <div>
                  <p className="text-caption font-medium uppercase tracking-wide text-ink-3">Why</p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-body text-ink-2">
                    {mt.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-caption text-ink-3">Average client: {hours(analysis!.summary.average_monthly_hours)} support a month.</p>
                </div>
              )}
              <div>
                <p className="text-caption font-medium uppercase tracking-wide text-ink-3">Recommendation</p>
                <p className="mt-1 text-body text-ink-2">{mt.recommendation}</p>
              </div>
            </div>
          </Card>

          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader title="Support hours by month" subtitle={client.included_hours ? `${client.included_hours}h included each month` : `Labour costed at ${money(workspace?.settings.labour_cost_per_hour ?? 35)}/h`} />
              <div className="px-3 pb-4 pt-4 sm:px-5">
                <TrendChart data={monthly} height={180} unit="hours" />
              </div>
            </Card>

            <Card>
              <CardHeader title="Findings" subtitle={`${findings.length} for this client`} />
              {findings.length ? (
                <ul className="divide-y divide-line-soft">
                  {findings.map((f) => (
                    <li key={f.id}>
                      <Link to={`/app/findings/${f.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-hover">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-body font-medium">{f.title}</p>
                          <p className="text-caption text-ink-3">{CATEGORY_META[f.category].label}</p>
                        </div>
                        <SeverityBadge severity={f.severity} />
                        <StatusBadge status={f.status} />
                        <span className="tnum w-16 text-right text-body font-semibold">{money(f.estimated_value)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-6 text-body text-ink-3">No leakage found for this client.</p>
              )}
            </Card>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <Card>
                <CardHeader title="Agreement vs actual" />
                <div className="divide-y divide-line-soft px-5">
                  <Row label="Users (contracted / actual)" value={`${client.contracted_users ?? '—'} / ${mt.users || '—'}`} tone={client.contracted_users != null && mt.users > client.contracted_users ? 'text-warning font-semibold' : ''} />
                  <Row label="Devices (contracted / actual)" value={`${client.contracted_devices ?? '—'} / ${mt.devices || '—'}`} tone={client.contracted_devices != null && mt.devices > client.contracted_devices ? 'text-warning font-semibold' : ''} />
                  {billing.map((b) => (
                    <Row key={b.id} label={b.service} value={`${num(b.quantity)} × ${money(b.unit_price, { decimals: true })}`} />
                  ))}
                  {!billing.length && <p className="py-3 text-body text-ink-3">No billing lines uploaded.</p>}
                </div>
              </Card>
              <Card>
                <CardHeader title="Contracts" />
                <div className="space-y-4 p-5">
                  {contracts.length ? (
                    contracts.map((c) => {
                      const clauses = extractClauses(c.text)
                      return (
                        <div key={c.id}>
                          <p className="flex items-center gap-2 text-body font-medium">
                            <FileText className="size-4 text-ink-3" /> {c.title}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {[...new Set(clauses.map((cl) => cl.type))].map((t) => (
                              <Badge key={t}>{CLAUSE_LABELS[t]}</Badge>
                            ))}
                            {!clauses.length && <span className="text-caption text-ink-3">No scope clauses detected.</span>}
                          </div>
                          <details className="mt-2">
                            <summary className="cursor-pointer text-caption text-ink-3 hover:text-ink">Show contract text</summary>
                            <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded-md bg-sunken p-3 text-caption leading-relaxed text-ink-2">{c.text}</p>
                          </details>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-body text-ink-3">
                      No contract uploaded. <Link to="/app/data" className="font-medium text-ink hover:underline">Upload a PDF</Link> to check tickets against its scope.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
