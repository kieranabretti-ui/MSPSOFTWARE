import type { ClientMetrics, FindingDraft, Health, WorkspaceSettings } from './types'

const r1 = (n: number) => Math.round(n * 10) / 10

// Health, reasons and a recommendation for one client from its metrics and the
// findings that still count. Shared by the engine and the live views, so
// dismissing a finding moves the client's health everywhere. It lives apart
// from analyse.ts so the store can use it without loading the rules engine.
export function liveClientHealth(
  mt: ClientMetrics,
  findings: Pick<FindingDraft, 'category' | 'title' | 'estimated_value'>[],
  settings: Pick<WorkspaceSettings, 'target_margin'>,
  avgAllHours: number,
  months: number,
): { health: Health; reasons: string[]; recommendation: string; leakage: number } {
  const target = settings.target_margin
  const marginKnown = mt.mrr > 0
  const leakage = findings.reduce((a, f) => a + f.estimated_value, 0)
  const below = marginKnown && mt.margin < target
  const reasons: string[] = []
  if (!marginKnown) reasons.push("No monthly recurring revenue recorded, so margin can't be measured")
  if (below) reasons.push(`Margin ${Math.round(mt.margin * 100)}% is below your ${Math.round(target * 100)}% target`)
  if (avgAllHours > 0 && mt.avg_monthly_hours > avgAllHours * 1.5) reasons.push(`${r1(mt.avg_monthly_hours)} support hours/month against a client average of ${r1(avgAllHours)}h`)
  const drift = findings.filter((f) => f.category === 'AGREEMENT_DRIFT' || f.category === 'MISSING_LICENSE' || f.category === 'RECURRING_CHARGE_MISMATCH')
  if (drift.length) reasons.push(drift.map((f) => f.title).join('; '))
  const over = findings.find((f) => f.category === 'EXCESSIVE_USAGE')
  if (over) reasons.push(over.title)
  const oos = findings.filter((f) => f.category === 'OUT_OF_SCOPE' || f.category === 'UNBILLED_TIME').length
  if (oos) reasons.push(`${oos} ticket${oos === 1 ? '' : 's'} with potentially billable work done for free`)
  const periodRevenue = mt.mrr * months
  const leakShare = periodRevenue > 0 ? leakage / periodRevenue : 0
  const health: Health = !marginKnown
    ? 'watch'
    : below || leakShare > 0.08
      ? 'at_risk'
      : mt.margin < target + 0.12 || leakShare > 0.02
        ? 'watch'
        : 'healthy'
  const recommendation = !marginKnown
    ? "Add this client's monthly recurring revenue to measure margin."
    : below
      ? 'Review pricing or move this client to a higher support tier.'
      : over
        ? 'Bill overage hours or move the client to a tier with more included hours.'
        : drift.length
          ? 'Update the recurring charge to match users and devices actually supported.'
          : oos
            ? 'Agree how out-of-scope requests are billed and brief the service desk.'
            : 'No action needed. Keep monitoring.'
  return { health, reasons, recommendation, leakage }
}
