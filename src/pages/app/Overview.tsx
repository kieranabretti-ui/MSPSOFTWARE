import { useMetrics, useStore, openish } from '../../data/store'
import { ButtonLink, PageHeader } from '../../components/ui'
import { ICONS } from '../../brand/icons'
import { plural, relative } from '../../lib/format'
import { ALL_CATEGORIES, PRIMARY_CATEGORIES, SEVERITY_ORDER } from '../../lib/labels'
import type { Health } from '../../engine/types'
import { GetStarted } from './overview/FirstRun'
import { Hero } from './overview/Hero'
import { ActionsPanel, CategoryBreakdown, ClientRisk, LeakageTrend, PriorityFindings, type RiskClient } from './overview/sections'

// Imported by the Findings and Reports pages for their own first-run state.
export { GetStarted }

const HEALTH_RANK: Record<Health, number> = { at_risk: 0, watch: 1, healthy: 2 }

// Revenue Protection, in the order an owner reads it: the money, what to act
// on first, which clients, where recovery stands, then the supporting data.
export default function Overview() {
  const { analysis, data, workspace } = useStore()
  const m = useMetrics()

  if (!analysis)
    return (
      <>
        <PageHeader title="Revenue Protection" subtitle={workspace?.name} />
        <GetStarted />
      </>
    )

  const s = analysis.summary
  const months = s.months.length
  const billed = s.client_metrics.reduce((a, c) => a + c.mrr, 0) * months

  const open = data.findings.filter(openish)
  const criticalCount = open.filter((f) => f.severity === 'CRITICAL').length
  const priority = [...open]
    .sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) || b.estimated_value - a.estimated_value)
    .slice(0, 5)

  const risky: RiskClient[] = s.client_metrics
    .map((c) => ({ ...c, leakage: m.leakageByClient.get(c.client_id) ?? 0, billed: c.mrr * months }))
    .filter((c) => c.health !== 'healthy' || c.leakage > 0)
    .sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health] || b.leakage - a.leakage)
    .slice(0, 5)

  const categories = ALL_CATEGORIES.filter((c) => PRIMARY_CATEGORIES.includes(c) || m.byCategory[c])
    .map((c) => {
      const v = m.byCategory[c]
      const sub = c === 'UNDERPRICED_CLIENT' ? plural(v?.clients.size ?? 0, 'client') : plural(v?.count ?? 0, 'finding')
      return { category: c, value: v?.value ?? 0, sub }
    })
    .sort((a, b) => b.value - a.value)

  const active = data.actions.filter((a) => a.status === 'open' || a.status === 'in_progress')

  return (
    <>
      <PageHeader
        title="Revenue Protection"
        subtitle={
          <span className="tnum">
            {s.period_label} · {plural(s.data_counts.tickets, 'ticket')} and {plural(s.data_counts.clients, 'client')} analysed {relative(analysis.created_at)}
          </span>
        }
        actions={
          <>
            <ButtonLink to="/app/data" variant="ghost" size="sm">
              <ICONS.data className="size-4" /> Data
            </ButtonLink>
            <ButtonLink to="/app/reports" variant="secondary" size="sm">
              <ICONS.reports className="size-4" /> View report
            </ButtonLink>
          </>
        }
      />

      <Hero total={m.total} monthly={m.monthly} annual={m.annual} findingCount={m.count} openCount={m.openCount} periodLabel={s.period_label} billed={billed} months={months} />

      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-6">
        <PriorityFindings findings={priority} clientName={m.clientName} criticalCount={criticalCount} />
        <ClientRisk clients={risky} />
      </div>

      <div className="mt-10">
        <ActionsPanel openCount={m.openCount} openValue={m.openValue} active={active} resolvedValue={m.resolvedValue} clientName={m.clientName} topFindingId={priority[0]?.id} />
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-5 lg:gap-6">
        <div className="lg:col-span-2">
          <CategoryBreakdown rows={categories} />
        </div>
        <div className="lg:col-span-3">
          <LeakageTrend data={m.trend} />
        </div>
      </div>
    </>
  )
}
