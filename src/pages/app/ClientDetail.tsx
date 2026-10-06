import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useStore, counted } from '../../data/store'
import { Card, EmptyState, HealthDot, PageHeader, ButtonLink } from '../../components/ui'
import { money } from '../../lib/format'
import { monthLabel } from '../../engine/analyse'
import { AgreementCard, AgreementFacts, ClientFindings, ContractsCard, HoursCard, LeakagePanel, ProfitabilityCard } from './clients/profile'

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
        <EmptyState
          title="Client not found"
          body="This client may have been removed, or the link is out of date."
          action={
            <ButtonLink to="/app/clients" variant="secondary">
              Back to clients
            </ButtonLink>
          }
        />
      </Card>
    )

  const live = findings.filter(counted)
  const leakage = live.reduce((a, f) => a + f.estimated_value, 0)
  const recurring = live.reduce((a, f) => a + f.monthly_value, 0)
  const target = workspace?.settings.target_margin ?? 0.3
  const labourRate = workspace?.settings.labour_cost_per_hour ?? 35
  const months = analysis?.summary.months.length ?? 0
  const periodLabel = analysis?.summary.period_label ?? ''

  const end = client.contract_end ? new Date(client.contract_end) : null
  const endText = end && !Number.isNaN(end.getTime()) ? `Contract ${end.getTime() < Date.now() ? 'ended' : 'ends'} ${end.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}` : null
  const meta = [client.package, `${money(client.monthly_recurring_revenue)} MRR`, endText].filter(Boolean).join(' · ')

  return (
    <>
      <Link to="/app/clients" className="mb-4 inline-flex items-center gap-1.5 text-small font-medium text-ink-3 transition-colors hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Clients
      </Link>
      <PageHeader
        title={client.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {mt && <HealthDot health={mt.health} />}
            <span className="tnum">{meta}</span>
          </span>
        }
      />

      {!mt ? (
        <div className="space-y-6">
          <AgreementFacts client={client} />
          <Card>
            <EmptyState
              title="Not analysed yet"
              body="Upload tickets, time and agreement data for this client, then run the analysis from the Data page."
              action={<ButtonLink to="/app/data">Go to data</ButtonLink>}
            />
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          <LeakagePanel
            leakage={leakage}
            recurring={recurring}
            billed={client.monthly_recurring_revenue * months}
            months={months}
            periodLabel={periodLabel}
            findingCount={live.length}
            health={mt.health}
            reasons={mt.reasons}
            recommendation={mt.recommendation}
          />

          <ClientFindings findings={findings} total={leakage} periodLabel={periodLabel} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ProfitabilityCard mt={mt} target={target} periodLabel={periodLabel} avgHours={analysis!.summary.average_monthly_hours} labourRate={labourRate} clientName={client.name} />
            <AgreementCard client={client} mt={mt} billing={billing} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <HoursCard data={monthly} includedHours={client.included_hours} labourRate={labourRate} />
            <ContractsCard contracts={contracts} />
          </div>
        </div>
      )}
    </>
  )
}
