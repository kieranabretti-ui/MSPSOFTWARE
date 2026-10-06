import { ArrowUp } from 'lucide-react'
import { cx } from '../../../components/ui'
import { LeakBar } from '../../../components/charts'
import { money, num, pct } from '../../../lib/format'

// Small, shared pieces of the clients area: margin as status text, contracted
// against actual counts, and the per-client leakage bar.

export const isBelowTarget = (margin: number, target: number) => margin < target

// Margin is plain ink. A margin below target is set semibold with one small
// danger dot and a spoken label, so the risk shows once and never as red text.
// `mark={false}` drops the dot where a chart beside it already carries it.
export function MarginValue({ margin, target, className, mark = true }: { margin: number; target: number; className?: string; mark?: boolean }) {
  const below = isBelowTarget(margin, target)
  return (
    <span className={cx('tnum inline-flex items-center gap-1.5 text-ink', below && 'font-semibold', className)} title={below ? `Below your ${pct(target)} target margin` : undefined}>
      {below && mark && <span className="size-1.5 shrink-0 rounded-full bg-danger" aria-hidden />}
      {pct(margin)}
      {below && <span className="sr-only">, below your {pct(target)} target</span>}
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
// row passes no `max` and shows the figure alone.
export function LeakageCell({ leakage, max }: { leakage: number; max?: number }) {
  return (
    <span className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <span className={cx('tnum min-w-[4.5rem] text-right', leakage > 0 ? 'font-semibold text-ink' : 'text-ink-3')}>{money(leakage)}</span>
      {max != null && <LeakBar value={leakage} max={max} className="w-20 sm:order-first lg:w-24" />}
    </span>
  )
}
