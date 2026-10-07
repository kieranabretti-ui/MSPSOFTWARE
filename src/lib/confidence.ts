import type { ConfidenceLevel, FindingDraft } from '../engine/types'

// Confidence as a level with a one-line basis, derived from the rule that
// raised the finding and where its evidence came from. Types only: this runs
// in the app and in the landing snapshot build, never pulling in the engine.

export interface ConfidenceReading {
  level: ConfidenceLevel
  basis: string
  // true when the value is a model of costs rather than a count of records
  estimate: boolean
}

const gbp = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`

const FALLBACK_BASIS = 'Run the analysis again to see what this confidence is based on.'

const read = (level: ConfidenceLevel, basis: string, estimate = false): ConfidenceReading => ({ level, basis, estimate })

export function confidenceOf(f: Pick<FindingDraft, 'confidence' | 'meta'>): ConfidenceReading {
  const calc = f.meta.calc
  if (!calc) return read(f.confidence >= 90 ? 'HIGH' : f.confidence >= 70 ? 'MEDIUM' : 'LOW', FALLBACK_BASIS)
  const rule = f.meta.rule
  const prefix = rule.split('.')[0]

  if (prefix === 'out_of_scope' && calc.kind === 'time') {
    if (calc.hours_source === 'settings') return read('MEDIUM', 'Compared with your default support hours in Settings, not hours stated in the contract.')
    if (f.confidence >= 90) return read('HIGH', 'The contract clause and the ticket both support this.')
    return read('MEDIUM', "The contract excludes this kind of work, but the ticket's wording is a looser match. Check the ticket first.")
  }
  if (prefix === 'mismatch') return read('HIGH', 'The contracted quantity and your billing line disagree.')
  if (prefix === 'drift' && calc.kind === 'seats') {
    if (calc.baseline_source === 'billing') return read('MEDIUM', 'No contracted figure on the client record, so this compares with the quantity you bill.')
    if (calc.price_source === 'default') return read('MEDIUM', `No per-${calc.unit} billing line was found, so this uses your default price in Settings.`)
    return read('HIGH', `Contracted for ${calc.baseline} ${calc.unit}s; your ${calc.unit}s list shows ${calc.actual} active. Valued at your own billing line price.`)
  }
  if (rule === 'license.unbilled') return read('MEDIUM', 'Licence names in your users export were matched to a billing line by name. Check the match before billing.')
  if (rule === 'usage.over_allowance') return read('MEDIUM', 'Hours come from your time entries. No overage charge was found in the data provided, so check whether it was invoiced.')
  if (rule === 'margin.below_target' && calc.kind === 'margin')
    return read(
      'MEDIUM',
      `An estimate from logged support hours and the labour cost (${gbp(calc.labour_rate)}/h), software cost and target margin (${Math.round(calc.target_margin * 100)}%) in Settings.`,
      true,
    )
  if (rule === 'unbilled.billing_mismatch') return read('MEDIUM', 'Your PSA marks the ticket billable but the time non-billable. It may be a deliberate write-off, so check before invoicing.')
  if (prefix === 'unbilled' && calc.kind === 'time')
    return read(
      'LOW',
      calc.contract_checked
        ? 'The ticket reads like chargeable work, but nothing in the agreement confirms it. Check with the technician first.'
        : "The ticket reads like chargeable work. No contract was uploaded for this client, so coverage couldn't be checked.",
    )
  return read(f.confidence >= 90 ? 'HIGH' : f.confidence >= 70 ? 'MEDIUM' : 'LOW', FALLBACK_BASIS)
}
