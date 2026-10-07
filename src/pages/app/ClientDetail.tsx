import { useEffect, useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useStore, counted } from '../../data/store'
import { Card, EmptyState, PageHeader, ButtonLink } from '../../components/ui'
import { money } from '../../lib/format'
import { monthLabel } from '../../engine/format'
import { DEFAULT_SETTINGS } from '../../engine/types'
import { AgreementFacts, ClientFindings, ContractsCard, HoursCard, LeakagePanel, ProfitabilityCard } from './clients/profile'
import { ClientHealth, useLiveHealth } from './clients/parts'
import { ContractVsReality } from './contracts/ContractVsReality'

export default function ClientDetail() {
  const { id } = useParams()
  const { hash } = useLocation()
  const { data, analysis, workspace } = useStore()
  const health = useLiveHealth()
  const client = data.clients.find((c) => c.id === id)
  const mt = analysis?.summary.client_metrics.find((c) => c.client_id === id)
  const live = id ? health.get(id) : undefined
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

  // A link from the Contracts page lands on the contract section. The layout
  // scrolls to the top on a new page, so this waits a frame and goes after it.
  const target = hash.slice(1)
  const ready = !!mt
  useEffect(() => {
    if (!target || !ready) return
    const raf = requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(raf)
  }, [target, ready, id])

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

  const counting = findings.filter(counted)
  // Overlaps are disclosed, not netted (the engine records them per opportunity).
  const countedKeys = new Set(counting.map((f) => f.finding_key))
  const overlap = counting.some((f) => f.meta.overlaps?.some((k) => countedKeys.has(k)))
  const leakage = counting.reduce((a, f) => a + f.estimated_value, 0)
  const recurring = counting.reduce((a, f) => a + f.monthly_value, 0)
  // The settings the analysis ran with, so the target price and margins agree
  // with the opportunities it raised.
  const settings = { ...DEFAULT_SETTINGS, ...workspace?.settings, ...analysis?.summary.settings }
  const targetMargin = settings.target_margin
  const labourRate = settings.labour_cost_per_hour
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
            {live && <ClientHealth health={live.health} known={live.known} />}
            <span className="tnum">{meta}</span>
          </span>
        }
      />

      {!mt || !live ? (
        <div className="space-y-6">
          <AgreementFacts client={client} />
          <Card>
            <EmptyState
              title="Not analysed yet"
              body="Upload tickets, time and agreement data for this client, then run the analysis from the Analyses page to see its margin, contract against reality and any opportunities."
              action={<ButtonLink to="/app/analyses">Go to Analyses</ButtonLink>}
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
            findingCount={counting.length}
            health={live.health}
            known={live.known}
            overlap={overlap}
            reasons={live.reasons}
            recommendation={live.recommendation}
          />

          <ClientFindings findings={findings} total={leakage} periodLabel={periodLabel} clientId={client.id} />

          <section id="contract" className="scroll-mt-20 lg:scroll-mt-8">
            <ContractVsReality client={client} mt={mt} billing={billing} contracts={contracts} findings={findings} settings={settings} />
          </section>

          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <ProfitabilityCard mt={mt} target={targetMargin} periodLabel={periodLabel} avgHours={analysis!.summary.average_monthly_hours} labourRate={labourRate} clientName={client.name} />
            <div className="space-y-6">
              <HoursCard data={monthly} includedHours={client.included_hours} labourRate={labourRate} />
              <ContractsCard contracts={contracts} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
