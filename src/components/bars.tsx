import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { money } from '../lib/format'
import { cx } from './ui'

// Plain-markup bars, kept apart from charts.tsx so the landing page and auth
// screens can draw them without loading recharts. Same chart rules: neutrals
// carry the data, the accent marks money found, every bar has a text alternative.

// Horizontal share bars for category breakdowns: one neutral hue, sorted, labelled.
export function ShareBars({ rows }: { rows: { label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-3.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-small">
            <span className="text-ink-2">{r.label}</span>
            <span className="tnum font-semibold text-ink">
              {money(r.value)}
              {r.sub && <span className="ml-2 text-caption font-normal text-ink-3">{r.sub}</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-line-soft">
            <div className="h-full rounded-full bg-viz-series-strong" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// The signature: what you billed, and the potential leakage beside it. The
// billed part is neutral; the gap is the accent, set off by a hairline tick at
// the junction so the eye lands on the found money even when the gap is small.
export function GapBar({ billed, gap, height = 14, label = true, className }: { billed: number; gap: number; height?: number; label?: boolean; className?: string }) {
  const total = billed + gap
  const share = total > 0 ? gap / total : 0
  const pct = (share * 100).toFixed(1)
  // Keep a sliver visible so a small gap still reads as a gap.
  const gapPct = gap > 0 ? Math.max(share * 100, 1.5) : 0
  const tick = gap > 0 && height >= 12
  return (
    <div className={className}>
      <div className="relative" role="img" aria-label={`${money(gap)} potential leakage against ${money(billed)} billed (${pct}%)`}>
        <div className="flex w-full gap-[3px]" style={{ height }}>
          <div className="h-full min-w-0 rounded-l-[3px] bg-viz-series" style={{ width: `${100 - gapPct}%` }} />
          {gap > 0 && <div className="h-full min-w-[4px] rounded-r-[3px] bg-accent" style={{ width: `${gapPct}%` }} />}
        </div>
        {tick && <span className="absolute -bottom-1.5 -top-1.5 w-px bg-ink-2" style={{ right: `calc(${gapPct}% + 1.5px)` }} aria-hidden />}
      </div>
      {label && (
        <div className="mt-2.5 flex items-baseline justify-between gap-3 text-caption">
          <span className="text-ink-3">
            Billed <span className="tnum text-ink-2">{money(billed)}</span>
          </span>
          <span className="text-right text-ink-3">
            Potential leakage <span className="tnum text-small font-semibold text-accent">{money(gap)}</span>
            <span className="tnum ml-1.5 text-ink-3">· {pct}%</span>
          </span>
        </div>
      )}
    </div>
  )
}

// The signature at row scale: each client's leakage ranked against the largest,
// as a lime fill on a hairline track. Rows read apart at a glance; the figure
// beside it carries the value, so the bar itself is decorative to readers.
export function LeakBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const share = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  return (
    <span className={cx('relative flex h-1 items-center', className)} aria-hidden>
      <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />
      {value > 0 && <span className="relative h-full rounded-full bg-accent" style={{ width: `${Math.max(share * 100, 3)}%` }} />}
    </span>
  )
}

// Change against the previous period. Up in money found is good news, so it
// takes the accent; the icon carries direction for anyone not reading colour.
export function TrendIndicator({ current, previous, invert = false }: { current: number; previous: number; invert?: boolean }) {
  if (!previous) return null
  const delta = (current - previous) / previous
  const flat = Math.abs(delta) < 0.005
  const good = flat ? null : invert ? delta < 0 : delta > 0
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className={'tnum inline-flex items-center gap-0.5 text-caption font-semibold ' + (good === null ? 'text-ink-3' : good ? 'text-accent' : 'text-ink-2')}>
      <Icon className="size-3.5" aria-hidden />
      {flat ? 'Flat' : `${Math.abs(delta * 100).toFixed(0)}%`}
      <span className="sr-only">{flat ? '' : delta > 0 ? 'up' : 'down'} on the previous month</span>
    </span>
  )
}
