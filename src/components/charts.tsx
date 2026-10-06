import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money } from '../lib/format'
import { color, viz } from '../brand/tokens'

// Chart rules: neutrals carry the data, the accent marks money found or
// recovered, one axis only, recessive grid, tabular figures, and every chart
// has a text alternative.

interface Point {
  label: string
  value: number
}

type Unit = 'money' | 'hours'
const fmt = (v: number, unit: Unit) => (unit === 'money' ? money(v) : `${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}h`)
const axisMoney = (v: number) => (v >= 1000 ? `£${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : `£${v}`)

function ChartTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Point }[]; unit: Unit }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="elevate-2 rounded-md border border-line bg-raised px-3 py-2">
      <div className="text-caption text-ink-3">{p.label}</div>
      <div className="tnum mt-0.5 text-small font-semibold text-ink">{fmt(p.value, unit)}</div>
    </div>
  )
}

// Monthly bars. The latest month is drawn a step brighter; hover lights a bar in the accent.
export function TrendChart({ data, height = 220, unit = 'money' }: { data: Point[]; height?: number; unit?: Unit }) {
  const last = data.length - 1
  return (
    <div style={{ height }} role="img" aria-label={`By month: ${data.map((d) => `${d.label} ${fmt(d.value, unit)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -6, bottom: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={viz.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: viz.axis, fontSize: 12 }} dy={4} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: viz.axis, fontSize: 11 }} tickFormatter={(v: number) => (unit === 'hours' ? `${v}h` : axisMoney(v))} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'rgb(255 255 255 / 0.03)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} activeBar={{ fill: color.accent }} animationDuration={500}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === last ? viz.seriesStrong : viz.series} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

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

// The signature: what you billed, and the gap you did not. The billed part is
// neutral; the unbilled gap is the accent, separated by a hairline of surface.
export function GapBar({ billed, gap, height = 10, label = true, className }: { billed: number; gap: number; height?: number; label?: boolean; className?: string }) {
  const total = billed + gap
  const share = total > 0 ? gap / total : 0
  // Keep a sliver visible so a small gap still reads as a gap.
  const gapPct = gap > 0 ? Math.max(share * 100, 1.5) : 0
  return (
    <div className={className}>
      <div className="flex w-full gap-[2px]" style={{ height }} role="img" aria-label={`${money(gap)} unbilled against ${money(billed)} billed (${(share * 100).toFixed(1)}%)`}>
        <div className="h-full rounded-l-[3px] bg-viz-series" style={{ width: `${100 - gapPct}%` }} />
        {gap > 0 && <div className="h-full rounded-r-[3px] bg-accent" style={{ width: `${gapPct}%` }} />}
      </div>
      {label && (
        <div className="mt-2 flex items-baseline justify-between gap-3 text-caption">
          <span className="text-ink-3">
            Billed <span className="tnum text-ink-2">{money(billed)}</span>
          </span>
          <span className="text-ink-3">
            Unbilled <span className="tnum font-semibold text-accent">{money(gap)}</span>
            <span className="tnum ml-1.5 text-ink-3">{(share * 100).toFixed(1)}%</span>
          </span>
        </div>
      )}
    </div>
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
