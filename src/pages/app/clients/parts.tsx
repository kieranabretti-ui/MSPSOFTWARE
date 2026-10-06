import { ArrowUp } from 'lucide-react'
import { cx } from '../../../components/ui'
import { GapBar } from '../../../components/charts'
import { ICONS } from '../../../brand/icons'
import { money, num, pct } from '../../../lib/format'

// Small, shared pieces of the clients area: margin as status text, contracted
// against actual counts, and the per-client leakage bar.

export const isBelowTarget = (margin: number, target: number) => margin < target

// Margin is plain text. Only a margin below target takes colour, and then
// always with the alert icon and a spoken label, never colour alone.
export function MarginValue({ margin, target, className }: { margin: number; target: number; className?: string }) {
  const below = isBelowTarget(margin, target)
  const Alert = ICONS.alerts
  return (
    <span className={cx('tnum inline-flex items-center gap-1', below ? 'font-semibold text-danger' : 'text-ink', className)} title={below ? `Below your ${pct(target)} target margin` : undefined}>
      {below && <Alert className="size-3.5 shrink-0" aria-hidden />}
      {pct(margin)}
      {below && <span className="sr-only">, below your {pct(target)} target</span>}
    </span>
  )
}

// Actual users or devices against the contracted number. Anything above
// contract is amber with an up arrow; the contracted figure stays quiet.
export function SeatCount({ actual, contracted, noun }: { actual: number; contracted: number | null; noun: string }) {
  if (!actual) return <span className="text-ink-3">—</span>
  const over = contracted != null && actual > contracted ? actual - contracted : 0
  return (
    <span className="tnum inline-flex items-baseline justify-end gap-1" title={contracted != null ? `${num(actual)} ${noun} supported, ${num(contracted)} contracted` : `${num(actual)} ${noun} supported, none contracted`}>
      <span className={cx('inline-flex items-center gap-0.5', over ? 'font-semibold text-warning' : 'text-ink')}>
        {over > 0 && <ArrowUp className="size-3 shrink-0" aria-hidden />}
        {num(actual)}
      </span>
      {contracted != null && <span className="text-ink-3">/ {num(contracted)}</span>}
      {over > 0 && <span className="sr-only">, {num(over)} above contract</span>}
    </span>
  )
}

// A client's potential leakage with the signature GapBar: what was billed over
// the analysis period in neutral, the unbilled gap in lime.
export function LeakageCell({ leakage, billed }: { leakage: number; billed: number }) {
  return (
    <span className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
      <span className={cx('tnum min-w-[4.5rem] text-right', leakage > 0 ? 'font-semibold text-ink' : 'text-ink-3')}>{money(leakage)}</span>
      {billed > 0 && <GapBar billed={billed} gap={leakage} height={4} label={false} className={cx('w-20 sm:order-first lg:w-24', leakage > 0 ? '' : 'opacity-60')} />}
    </span>
  )
}
