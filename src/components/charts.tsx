import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money } from '../lib/format'
import { color, viz } from '../brand/tokens'

// Chart rules: neutrals carry the data, the accent marks money found or
// recovered, one axis only, recessive grid, tabular figures, and every chart
// has a text alternative.

// The plain-markup bars live in ./bars so pages that only need those never
// load recharts. Re-exported here so existing imports keep working.
export * from './bars'

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

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Monthly bars. The latest month is drawn a step brighter; hover lights a bar in the accent.
// The wrapper carries the text alternative, so recharts' own keyboard layer is off.
export function TrendChart({ data, height = 220, unit = 'money' }: { data: Point[]; height?: number; unit?: Unit }) {
  const last = data.length - 1
  return (
    // Clipped to its box so the grid can never run past the card's inner edge.
    <div className="w-full min-w-0 overflow-hidden" style={{ height }} role="img" aria-label={`By month: ${data.map((d) => `${d.label} ${fmt(d.value, unit)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 0, left: -6, bottom: 0 }} barCategoryGap="30%" accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={viz.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: viz.axis, fontSize: 12 }} dy={4} />
          <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: viz.axis, fontSize: 11 }} tickFormatter={(v: number) => (unit === 'hours' ? `${v}h` : axisMoney(v))} />
          <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: 'rgb(255 255 255 / 0.03)' }} />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} activeBar={{ fill: color.accent }} animationDuration={500} isAnimationActive={!reducedMotion()}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === last ? viz.seriesStrong : viz.series} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
