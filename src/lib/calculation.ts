import { fmtMinutes, monthLabel, signed } from '../engine/format'
import { pence } from '../engine/money'
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
  // Recurring findings only: the unrounded monthly figure × 12. 0 for one-off.
  annual: number
  // recurring: a charge that repeats each month. one_off: work already done.
  // estimate: a modelled value (margin), not a count of records.
  basis: ValueBasis
}

export type ValueBasis = 'recurring' | 'one_off' | 'estimate'

// What a finding's figure means, so a one-off £80 is never read as £0 a month.
export function valueBasis(f: Pick<FindingDraft, 'meta'>): ValueBasis | null {
  const k = f.meta.calc?.kind
  if (!k) return null
  return k === 'time' || k === 'usage' ? 'one_off' : k === 'margin' ? 'estimate' : 'recurring'
}

// Whole pounds stay whole; prices with pence keep them.
const gbp = (n: number) => money(n, { decimals: !Number.isInteger(n) })

// A recurring gap: count × price a month, and that unrounded figure × 12 a
// year, rounded once to the penny.
function recurring(count: number, price: number) {
  const exact = count * price
  return { monthly: pence(exact), annual: pence(exact * 12) }
}
const annualLine = (monthly: number, annual: number) => `${gbp(monthly)} × 12 = ${gbp(annual)} a year`
// Names the price used without nesting brackets, as labels often carry their own.
const priceFrom = (label: string | null | undefined) => (label ? `, priced as ${label}` : ', at the default price in Settings')
const hrs = (n: number) => `${num(n, 2)}h`
// Hours as hours and minutes ("12h 55m"), as time is logged.
const hm = (h: number) => fmtMinutes(Math.round(h * 60))
const s = (n: number) => (n === 1 ? '' : 's')
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

// Recurring gaps are valued month by month across the period, so the period
// total can differ from the monthly figure times the months.
function periodNote(f: Pick<FindingDraft, 'meta'>, monthly: number, grew: string): { total: number; note: string } {
  const values = Object.values(f.meta.period_values)
  const total = pence(sum(values))
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
      return { lines: [`${fmtMinutes(c.minutes)} non-billable × ${rate} = ${money(total)}`], result: `${money(total)} one-off`, total, monthly: 0, annual: 0, basis: 'one_off' }
    }
    case 'seats': {
      // Units already billed are never a gap: the floor is max(contracted, billed).
      const billed = c.billed ?? null
      const floor = Math.max(c.baseline, billed ?? 0)
      const extra = c.actual - floor
      const { monthly, annual } = recurring(extra, c.unit_price)
      const { total, note } = periodNote(f, monthly, `${c.unit}s were added`)
      const both = c.baseline_source !== 'billing' && billed != null
      const versus = both && billed === c.baseline ? 'contracted and billed' : c.baseline_source === 'billing' || floor > c.baseline ? 'billed' : 'contracted'
      const basis = both && billed !== c.baseline ? ` (${c.baseline} contracted, ${billed} billed)` : ''
      return {
        lines: [
          `${c.actual} active ${c.unit}s − ${floor} ${versus} = ${extra} ${c.unit}${s(extra)}${basis}`,
          `${extra} × ${gbp(c.unit_price)} = ${gbp(monthly)} a month${priceFrom(c.price_label)}`,
          annualLine(monthly, annual),
        ],
        result: `${gbp(monthly)} a month`,
        note,
        total,
        monthly,
        annual,
        basis: 'recurring',
      }
    }
    case 'mismatch': {
      const gap = c.contracted - c.billed
      const { monthly, annual } = recurring(gap, c.unit_price)
      const { total, note } = periodNote(f, monthly, `the gap changed`)
      return {
        lines: [`${c.contracted} contracted − ${c.billed} billed = ${gap} ${c.unit}${s(gap)}`, `${gap} × ${gbp(c.unit_price)} = ${gbp(monthly)} a month${priceFrom(c.price_label)}`, annualLine(monthly, annual)],
        result: `${gbp(monthly)} a month`,
        note,
        total,
        monthly,
        annual,
        basis: 'recurring',
      }
    }
    case 'missing': {
      const { monthly, annual } = recurring(c.contracted, c.unit_price)
      const { total, note } = periodNote(f, monthly, 'the gap changed')
      return {
        lines: [`${c.contracted} contracted ${c.unit}s with no per-${c.unit} charge found`, `${c.contracted} × ${gbp(c.unit_price)} = ${gbp(monthly)} a month${priceFrom(null)}`, annualLine(monthly, annual)],
        result: `${gbp(monthly)} a month, as a guide`,
        note,
        total,
        monthly,
        annual,
        basis: 'recurring',
      }
    }
    case 'licence': {
      const gap = c.assigned - c.billed
      const { monthly, annual } = recurring(gap, c.unit_price)
      const { total, note } = periodNote(f, monthly, 'licences were assigned')
      return {
        lines: [`${c.assigned} assigned − ${c.billed} billed = ${gap} licence${s(gap)}`, `${gap} × ${gbp(c.unit_price)} = ${gbp(monthly)} a month${priceFrom(c.price_label)}`, annualLine(monthly, annual)],
        result: `${gbp(monthly)} a month`,
        note,
        total,
        monthly,
        annual,
        basis: 'recurring',
      }
    }
    case 'usage': {
      const total = sum(c.months.map((m) => m.value))
      return {
        lines: c.months.map((m) => `${monthLabel(m.month, 'long')}: ${hm(m.used)} ${c.non_billable_only ? 'non-billable ' : ''}used − ${hm(c.included)} included = ${hm(m.over)} × ${gbp(c.rate)} = ${money(m.value)}`),
        result: `${money(total)} one-off across ${c.months.length} month${s(c.months.length)}`,
        note: 'Hours over the allowance are not rounded up to any billing increment in the agreement, so this is the lower figure.',
        total,
        monthly: 0,
        annual: 0,
        basis: 'one_off',
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
        result: `${money(monthly)} a month, estimated`,
        note: `Price that restores ${pct} at average cost: ${money(c.target_price)} a month (${signed(money(c.target_price - c.mrr))}).${
          c.shortfall.length < c.months
            ? ` Months above target are not netted off; measured on the period average the shortfall is ${money(Math.max(0, c.target_contribution - c.avg_contribution))} a month.`
            : ''
        } An estimate from your cost settings, not a count of records.`,
        total,
        monthly,
        annual: monthly * 12,
        basis: 'estimate',
      }
    }
  }
}
