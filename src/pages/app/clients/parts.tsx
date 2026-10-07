import { useMemo } from 'react'
import { ArrowUp } from 'lucide-react'
import { HealthDot, cx } from '../../../components/ui'
import { LeakBar } from '../../../components/bars'
import { counted, useStore } from '../../../data/store'
import { liveClientHealth } from '../../../engine/health'
import { DEFAULT_SETTINGS, type ClientMetrics, type Finding, type Health } from '../../../engine/types'
import { money, num, pct } from '../../../lib/format'

// Small, shared pieces of the clients area: margin as status text, contracted
// against actual counts, the per-client leakage bar, and each client's health
// worked out from the opportunities that still count.

export const isBelowTarget = (margin: number, target: number) => margin < target

// A client with no MRR has no margin to measure. Older analyses predate the
// flag, so fall back to the MRR itself.
export const marginKnown = (mt: Pick<ClientMetrics, 'margin_known' | 'mrr'>) => mt.margin_known ?? mt.mrr > 0

export const NEEDS_MRR_HINT = 'Add MRR to measure margin'

// Margin is plain ink. A margin below target is set semibold with one small
// danger dot and a spoken label, so the risk shows once and never as red text.
// `mark={false}` drops the dot where a chart beside it already carries it.
// `known={false}` shows a dash: without MRR there is no margin to show.
export function MarginValue({ margin, target, className, mark = true, known = true }: { margin: number; target: number; className?: string; mark?: boolean; known?: boolean }) {
  if (!known)
    return (
      <span className={cx('tnum text-ink-3', className)} title={NEEDS_MRR_HINT}>
        <span aria-hidden>—</span>
        <span className="sr-only">Not measured. {NEEDS_MRR_HINT}.</span>
      </span>
    )
  const below = isBelowTarget(margin, target)
  return (
    <span className={cx('tnum inline-flex items-center gap-1.5 text-ink', below && 'font-semibold', className)} title={below ? `Below your ${pct(target)} target margin` : undefined}>
      {below && mark && <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-hidden />}
      {pct(margin)}
      {below && <span className="sr-only">, below your {pct(target)} target</span>}
    </span>
  )
}

// Health as on the Overview, or "Needs MRR" when margin can't be measured: a
// quiet label with no mark, whose empty slot keeps a column of labels aligned.
export function ClientHealth({ health, known = true }: { health: Health; known?: boolean }) {
  if (known) return <HealthDot health={health} />
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-caption font-medium text-ink-3" title={NEEDS_MRR_HINT}>
      <span className="size-1.5 shrink-0" aria-hidden />
      Needs MRR
    </span>
  )
}

// Actual users or devices against the contracted number. Anything above
// contract is semibold ink with a neutral up-tick; the contracted figure stays quiet.
export function SeatCount({ actual, contracted, noun }: { actual: number; contracted: number | null; noun: string }) {
  if (!actual) return <span className="text-ink-3">—</span>
  const over = contracted != null && actual > contracted ? actual - contracted : 0
  return (
    <span className="tnum inline-flex items-baseline justify-end gap-1" title={contracted != null ? `${num(actual)} ${noun} supported, ${num(contracted)} contracted` : `${num(actual)} ${noun} supported, none contracted`}>
      <span className={cx('inline-flex items-center gap-0.5', over ? 'font-semibold text-ink' : 'text-ink')}>
        {over > 0 && <ArrowUp className="size-3 shrink-0 text-ink-3" aria-hidden />}
        {num(actual)}
      </span>
      {contracted != null && <span className="text-ink-3">/ {num(contracted)}</span>}
      {over > 0 && <span className="sr-only">, {num(over)} above contract</span>}
    </span>
  )
}

// A client's potential leakage, ranked against the client with the most: the
// signature's lime at row scale, so the rows read apart at a glance. A total
// row passes no `max` and shows the figure alone. `suffix` follows the figure,
// for a monthly value.
export function LeakageCell({ leakage, max, suffix }: { leakage: number; max?: number; suffix?: string }) {
  return (
    <span className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <span className={cx('tnum min-w-[4.5rem] whitespace-nowrap text-right', leakage > 0 ? 'font-semibold text-ink' : 'text-ink-3')}>
        {money(leakage)}
        {suffix}
      </span>
      {max != null && <LeakBar value={leakage} max={max} className="w-20 sm:order-first lg:w-24" />}
    </span>
  )
}

export interface LiveHealth {
  health: Health
  reasons: string[]
  recommendation: string
  // false when the client has no MRR, so margin can't be measured
  known: boolean
}

// Health, reasons and the next step for every analysed client, recomputed
// from the opportunities that still count. Dismissing one moves the client
// here exactly as it does on the Overview, with no reload.
export function useLiveHealth(): Map<string, LiveHealth> {
  const { data, analysis, workspace } = useStore()
  return useMemo(() => {
    const out = new Map<string, LiveHealth>()
    const summary = analysis?.summary
    if (!summary) return out
    // The settings the analysis ran with win, as in useMetrics.
    const settings = { ...DEFAULT_SETTINGS, ...workspace?.settings, ...summary.settings }
    const live = new Map<string, Finding[]>()
    for (const f of data.findings) {
      if (!counted(f)) continue
      if (!live.has(f.client_id)) live.set(f.client_id, [])
      live.get(f.client_id)!.push(f)
    }
    for (const mt of summary.client_metrics) {
      const h = liveClientHealth(mt, live.get(mt.client_id) ?? [], settings, summary.average_monthly_hours, summary.months.length)
      out.set(mt.client_id, { health: h.health, reasons: h.reasons, recommendation: h.recommendation, known: marginKnown(mt) })
    }
    return out
  }, [data.findings, analysis, workspace])
}
