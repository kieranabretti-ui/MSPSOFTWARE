import { useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { useMetrics, useStore, counted, openish } from '../../data/store'
import { Button, ButtonLink, PageHeader } from '../../components/ui'
import { ICONS } from '../../brand/icons'
import { liveClientHealth } from '../../engine/health'
import { DEFAULT_SETTINGS, type Finding, type Health } from '../../engine/types'
import { confidenceOf } from '../../lib/confidence'
import { plural, relative } from '../../lib/format'
import { ALL_CATEGORIES, LEVEL_ORDER, PRIMARY_CATEGORIES } from '../../lib/labels'
import { Callout } from './data/kit'
import { GetStarted } from './overview/FirstRun'
import { Hero } from './overview/Hero'
import { CategoryBreakdown, ClientRisk, LeakageTrend, PriorityFindings, RecoveryPanel, type CategoryRow, type PriorityRow, type RiskClient } from './overview/sections'

// Imported by the Opportunities and Reports pages for their own first-run state.
export { GetStarted }

const HEALTH_RANK: Record<Health, number> = { at_risk: 0, watch: 1, healthy: 2 }

// The workspace couldn't be loaded: say so, and offer the retry.
function LoadFailed() {
  const { loadError, reload } = useStore()
  const [retrying, setRetrying] = useState(false)
  if (!loadError) return null
  return (
    <Callout tone="danger" alert className="mb-6">
      <p>{loadError}</p>
      <Button
        size="sm"
        variant="secondary"
        className="mt-2.5"
        loading={retrying}
        onClick={async () => {
          setRetrying(true)
          await reload()
          setRetrying(false)
        }}
      >
        Try again
      </Button>
    </Callout>
  )
}

// The commercial picture in the order an owner reads it: the money and how it
// splits, where it leaks and which clients, what to act on first, where
// recovery stands, then when it leaked.
export default function Overview() {
  const { analysis, data, workspace, loadError } = useStore()
  const m = useMetrics()
  // A first run started here keeps its result on screen until the reader moves on.
  const [firstRun, setFirstRun] = useState(false)

  const view = useMemo(() => {
    if (!analysis) return null
    const s = analysis.summary
    const months = s.months.length
    const live = data.findings.filter(counted)

    // Act on these first: the surest, then the largest, of those still being worked.
    const ranked: PriorityRow[] = data.findings
      .filter(openish)
      .map((f) => ({ finding: f, level: confidenceOf(f).level }))
      .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || b.finding.estimated_value - a.finding.estimated_value)

    // Health as it stands now: a dismissed opportunity no longer counts against a client.
    const byClient = new Map<string, Finding[]>()
    for (const f of live) {
      if (!byClient.has(f.client_id)) byClient.set(f.client_id, [])
      byClient.get(f.client_id)!.push(f)
    }
    const settings = { ...DEFAULT_SETTINGS, ...workspace?.settings, ...s.settings }
    const risky: RiskClient[] = s.client_metrics
      .map((mt) => {
        const h = liveClientHealth(mt, byClient.get(mt.client_id) ?? [], settings, s.average_monthly_hours, months)
        return { ...mt, health: h.health, reasons: h.reasons, recommendation: h.recommendation, leakage: h.leakage, billed: mt.mrr * months }
      })
      .filter((c) => c.health !== 'healthy' || c.leakage > 0)
      .sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || b.leakage - a.leakage)
      .slice(0, 5)

    // Out-of-scope work is only found against a contract.
    const noContracts = s.coverage ? s.coverage.clients_with_contract === 0 : false
    const shown = ALL_CATEGORIES.filter((c) => PRIMARY_CATEGORIES.includes(c) || m.byCategory[c])
    const categories: CategoryRow[] = shown
      .map((c) => {
        const v = m.byCategory[c]
        const unchecked = c === 'OUT_OF_SCOPE' && noContracts && !v
        const sub = unchecked ? 'No contracts uploaded' : c === 'UNDERPRICED_CLIENT' ? plural(v?.clients.size ?? 0, 'client') : plural(v?.count ?? 0, 'opportunity', 'opportunities')
        return { category: c, value: v?.value ?? 0, sub, unchecked }
      })
      .sort((a, b) => Number(!!a.unchecked) - Number(!!b.unchecked) || b.value - a.value)

    return { s, months, ranked, risky, categories }
  }, [analysis, data.findings, workspace, m.byCategory])

  if (!view || firstRun)
    return (
      <>
        <PageHeader title="Overview" subtitle={workspace?.name} />
        <LoadFailed />
        {!loadError && <GetStarted onRunChange={setFirstRun} />}
      </>
    )

  const { s, months, ranked, risky, categories } = view
  const created = analysis!.created_at
  const cov = s.coverage
  const clientCount = cov?.clients ?? s.data_counts.clients
  const missingContracts = cov ? cov.clients - cov.clients_with_contract : 0
  const maxLeakage = Math.max(0, ...m.leakageByClient.values())

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={
          <span className="tnum">
            {s.period_label} · {plural(s.data_counts.tickets, 'ticket')} and {plural(s.data_counts.clients, 'client')} analysed {relative(created)}
          </span>
        }
        actions={
          <>
            <ButtonLink to="/app/analyses" variant="ghost" size="sm">
              <ICONS.data className="size-4" aria-hidden /> Analyses
            </ButtonLink>
            <ButtonLink to="/app/reports" variant="secondary" size="sm">
              <ICONS.reports className="size-4" aria-hidden /> View report
            </ButtonLink>
          </>
        }
      />

      <LoadFailed />

      <Hero
        f={{
          total: m.total,
          monthly: m.monthly,
          recurringAgreement: m.recurringAgreement,
          recurringPricing: m.recurringPricing,
          oneOff: m.oneOff,
          annual: m.annual,
          count: m.count,
          clientsAffected: m.clientsAffected,
          clientCount,
          atRisk: m.atRisk,
          needMrr: cov ? cov.clients - cov.clients_with_mrr : 0,
          byLevel: m.byLevel,
          periodLabel: s.period_label,
          billed: s.client_metrics.reduce((a, c) => a + c.mrr, 0) * months,
          months,
          overlap: { value: m.overlap.value, monthly: m.overlap.monthly, clients: m.overlap.clients.map(m.clientName) },
        }}
      />

      {cov && missingContracts > 0 && (
        <Callout tone="info" className="mt-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <p>
              {missingContracts === cov.clients
                ? "No contracts are uploaded yet, so out-of-scope work can't be checked."
                : `${missingContracts} of ${plural(cov.clients, 'client')} ${missingContracts === 1 ? 'has' : 'have'} no contract uploaded, so out-of-scope work can't be checked for ${missingContracts === 1 ? 'it' : 'them'}.`}
            </p>
            <ButtonLink to="/app/analyses" size="sm" variant="secondary" className="self-start sm:self-auto">
              <FileText className="size-4 shrink-0" aria-hidden /> Upload contracts
            </ButtonLink>
          </div>
        </Callout>
      )}

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-6">
        <CategoryBreakdown rows={categories} />
        <ClientRisk clients={risky} maxLeakage={maxLeakage} />
      </div>

      <div className="mt-10">
        <PriorityFindings rows={ranked.slice(0, 5)} clientName={m.clientName} />
      </div>

      <div className="mt-10">
        <RecoveryPanel byStage={m.byStage} topFindingId={ranked[0]?.finding.id} />
      </div>

      <div className="mt-10">
        <LeakageTrend data={m.trend} />
      </div>
    </>
  )
}
