import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { money } from '../lib/format'

interface Point {
  label: string
  value: number
}

type Unit = 'money' | 'hours'
const fmt = (v: number, unit: Unit) => (unit === 'money' ? money(v) : `${v.toLocaleString('en-GB', { maximumFractionDigits: 1 })}h`)

function TrendTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Point }[]; unit: Unit }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="text-zinc-500">{p.label}</div>
      <div className="tnum mt-0.5 text-sm font-semibold text-zinc-900">{fmt(p.value, unit)}</div>
    </div>
  )
}

export function TrendChart({ data, height = 220, unit = 'money' }: { data: Point[]; height?: number; unit?: Unit }) {
  return (
    <div style={{ height }} role="img" aria-label={`By month: ${data.map((d) => `${d.label} ${fmt(d.value, unit)}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="28%">
          <CartesianGrid vertical={false} stroke="#f4f4f5" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: '#a1a1aa', fontSize: 11 }} tickFormatter={(v: number) => (unit === 'hours' ? `${v}h` : v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`)} />
          <Tooltip content={<TrendTooltip unit={unit} />} cursor={{ fill: '#f4f4f5' }} />
          <Bar dataKey="value" fill="#27272a" radius={[4, 4, 0, 0]} activeBar={{ fill: '#f97316' }} animationDuration={450} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// Horizontal share bars, used for category breakdowns.
export function ShareBars({ rows }: { rows: { label: string; value: number; sub?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-zinc-700">{r.label}</span>
            <span className="tnum font-medium text-zinc-900">
              {money(r.value)}
              {r.sub && <span className="ml-2 text-xs font-normal text-zinc-500">{r.sub}</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-zinc-800" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}
