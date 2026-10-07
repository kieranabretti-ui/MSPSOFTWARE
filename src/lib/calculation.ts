import { fmtMinutes, monthLabel } from '../engine/analyse'
import type { FindingDraft } from '../engine/types'
import { money, num } from './format'

// The sum behind a finding's value, as lines a reader can check by hand. Built
// from meta.calc, so it reproduces the engine's figure rather than restating it.

export interface Calculation {
  lines: string[]
  result: string
  note?: string
  total: number
  monthly: number
}

// Whole pounds stay whole; prices with pence keep them.
const gbp = (n: number) => money(n, { decimals: !Number.isInteger(n) })
const hrs = (n: number) => `${num(n, 2)}h`
const s = (n: number) => (n === 1 ? '' : 's')
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

// Recurring gaps are valued month by month across the period, so the period
// total can differ from the monthly figure times the months.
function periodNote(f: Pick<FindingDraft, 'meta'>, monthly: number, grew: string): { total: number; note: string } {
  const values = Object.values(f.meta.period_values)
  const total = sum(values)
  const steady = values.every((v) => v === monthly)
  return {
    total,
    note: steady ? `${money(total)} across the ${values.length} month${s(values.length)} analysed. See value by month.` : `${money(total)} across the period as ${grew}. See value by month.`,
  }
}

export function formatCalculation(f: Pick<FindingDraft, 'meta' | 'estimated_value' | 'monthly_value'>): Calculation | null {
  const c = f.meta.calc
  if (!c) return null
  switch (c.kind) {
    case 'time': {
      const total = Math.round((c.minutes / 60) * c.rate)
      const rate = c.after_hours && c.multiplier !== 1 ? `${gbp(c.rate)}/h (${gbp(c.base_rate)} × ${num(c.multiplier, 2)} out of hours)` : `${gbp(c.rate)}/h`
      return { lines: [`${fmtMinutes(c.minutes)} non-billable × ${rate} = ${money(total)}`], result: `${money(total)} one-off`, total, monthly: 0 }
    }
    case 'seats': {
      const extra = c.actual - c.baseline
      const monthly = Math.round(extra * c.unit_price)
      const { total, note } = periodNote(f, monthly, `${c.unit}s were added`)
      return {
        lines: [
          `${c.actual} active ${c.unit}s − ${c.baseline} ${c.baseline_source === 'contract' ? 'contracted' : 'billed'} = ${extra} ${c.unit}${s(extra)}`,
          `${extra} × ${gbp(c.unit_price)} (${c.price_label ?? 'default price in Settings'}) = ${money(monthly)} a month`,
        ],
        result: `${money(monthly)} a month`,
        note,
        total,
        monthly,
      }
    }
    case 'mismatch': {
      const gap = c.contracted - c.billed
      const monthly = Math.round(gap * c.unit_price)
      const { total, note } = periodNote(f, monthly, `the gap changed`)
      return {
        lines: [`${c.contracted} contracted − ${c.billed} billed = ${gap} ${c.unit}${s(gap)}`, `${gap} × ${gbp(c.unit_price)} (${c.price_label}) = ${money(monthly)} a month`],
        result: `${money(monthly)} a month`,
        note,
        total,
        monthly,
      }
    }
    case 'licence': {
      const gap = c.assigned - c.billed
      const monthly = Math.round(gap * c.unit_price)
      const { total, note } = periodNote(f, monthly, 'licences were assigned')
      return {
        lines: [`${c.assigned} assigned − ${c.billed} billed = ${gap} licence${s(gap)}`, `${gap} × ${gbp(c.unit_price)} (${c.price_label}) = ${money(monthly)} a month`],
        result: `${money(monthly)} a month`,
        note,
        total,
        monthly,
      }
    }
    case 'usage': {
      const total = sum(c.months.map((m) => m.value))
      return {
        lines: c.months.map((m) => `${monthLabel(m.month, 'long')}: ${hrs(m.used)} used − ${hrs(c.included)} included = ${hrs(m.over)} × ${gbp(c.rate)} = ${money(m.value)}`),
        result: `${money(total)} one-off across ${c.months.length} month${s(c.months.length)}`,
        total,
        monthly: 0,
      }
    }
    case 'margin': {
      const pct = `${Math.round(c.target_margin * 100)}%`
      const total = sum(c.shortfall.map((m) => m.value))
      const monthly = Math.round(total / c.months)
      const parts = c.shortfall.map((m) => money(m.value))
      return {
        lines: [
          `Target contribution: ${pct} × ${money(c.mrr)} = ${money(c.target_contribution)} a month`,
          `Average contribution: ${money(c.mrr)} − labour ${hrs(c.avg_hours)} × ${gbp(c.labour_rate)} − software ${money(c.software)} = ${money(c.avg_contribution)} a month`,
          `Shortfall in the ${c.shortfall.length} month${s(c.shortfall.length)} below target: ${parts.length > 1 ? `${parts.join(' + ')} = ${money(total)}` : money(total)}`,
          `${money(total)} ÷ ${c.months} month${s(c.months)} = ${money(monthly)} a month on average`,
        ],
        result: `${money(monthly)} a month`,
        note: `Price that restores ${pct} at average cost: ${money(c.target_price)} a month (+${money(c.target_price - c.mrr)}).`,
        total,
        monthly,
      }
    }
  }
}
