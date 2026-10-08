import type { ConfidenceLevel, FindingClass, FindingDraft } from './types'

// The confidence model. The single source of truth for a finding's confidence
// level and classification: the engine writes them from here, and the app,
// reports and landing page read them through src/lib/confidence.ts. Types only,
// so pages that display a finding never load the rules engine.
//
// A level is derived from explicit evidence-quality checks (criteria), each
// recorded on the finding's calculation inputs (meta.calc). docs/methodology.md
// documents the same table.
//
//   HIGH   direct record evidence on both sides of the comparison and a
//          deterministic calculation with no defaulted inputs. A link that
//          rests only on a keyword match in ticket text is an interpretation,
//          so it caps the finding at MEDIUM.
//   MEDIUM records support it, but an input is defaulted or assumed (a
//          Settings price, rate or hours; the clients file instead of the
//          agreement; work that may have been goodwill) or a person needs to
//          check something the data can't show.
//   LOW    the evidence is incomplete or ambiguous, or the value is modelled.
//
// Classification:
//   confirmed    HIGH, and a pure record-against-record discrepancy (seats,
//                licences, recurring charges).
//   potential    MEDIUM, or HIGH where acting on it still needs judgement
//                (out-of-hours work outside the agreed hours: whether to
//                charge it is the MSP's call).
//   investigate  LOW, or any modelled estimate.

export type CriterionId =
  | 'agreement_clause'
  | 'strong_text_match'
  | 'structured_link'
  | 'rate_from_agreement'
  | 'hours_from_agreement'
  | 'baseline_from_agreement'
  | 'baseline_consistent'
  | 'price_from_billing_line'
  | 'price_line_unambiguous'
  | 'assets_dated'
  | 'licence_name_exact'
  | 'allowance_from_agreement'
  | 'billing_visible'
  | 'not_goodwill'
  | 'cost_from_record'
  | 'billed_below_active'
  | 'deterministic'

export interface Criterion {
  id: CriterionId
  met: boolean
  text: string
}

export interface ConfidenceReading {
  level: ConfidenceLevel
  basis: string
  // true when the value is a model of costs rather than a count of records
  estimate: boolean
  // The checks behind the level, met or not. Empty for findings saved before
  // calculation inputs were recorded.
  criteria: Criterion[]
  classification: FindingClass
}

// Published so the methodology page and the PDF can render the same table the
// code applies.
export const CONFIDENCE_DEFINITIONS: Record<ConfidenceLevel, string> = {
  HIGH: 'Direct evidence in your records on both sides of the comparison, and a deterministic calculation with no defaulted inputs. A keyword match in ticket text is never enough on its own.',
  MEDIUM: 'Your records support it, but an input is assumed (a Settings price, rate or hours, or the clients file rather than the agreement), the link rests on a keyword match in ticket text, or a person needs to check something the data cannot show.',
  LOW: 'The evidence is incomplete or ambiguous, or the value is modelled rather than counted.',
}

export const CLASSIFICATION_DEFINITIONS: Record<FindingClass, string> = {
  confirmed: 'Confirmed discrepancy: two of your own records disagree, including what you bill, and the difference is calculated directly from them. It confirms the records disagree, not that money is owed.',
  potential: 'Potential opportunity: the evidence supports it, but it needs your review before billing or contractual changes.',
  investigate: 'Investigation required: the evidence is incomplete, or the value is an estimate.',
}

// The rule families whose HIGH findings are pure record-against-record discrepancies.
const DISCREPANCY_RULES = ['mismatch', 'drift', 'license']

const gbp = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
const FALLBACK_BASIS = 'Run the analysis again to see what this confidence is based on.'
const c = (id: CriterionId, met: boolean, text: string): Criterion => ({ id, met, text })

export function classificationFor(rule: string, level: ConfidenceLevel, estimate: boolean): FindingClass {
  if (estimate || level === 'LOW') return 'investigate'
  if (level === 'MEDIUM') return 'potential'
  return DISCREPANCY_RULES.includes(rule.split('.')[0]) ? 'confirmed' : 'potential'
}

// Legacy findings with no calculation inputs: band the stored score.
const levelFromScore = (n: number): ConfidenceLevel => (n >= 90 ? 'HIGH' : n >= 70 ? 'MEDIUM' : 'LOW')

// The score written alongside the level for older readers: the band's midpoint
// on the legacy scale (HIGH >= 90, MEDIUM >= 70). Never shown or exported.
export const SCORE_FOR_LEVEL: Record<ConfidenceLevel, number> = { HIGH: 95, MEDIUM: 80, LOW: 50 }

function reading(rule: string, level: ConfidenceLevel, basis: string, criteria: Criterion[], estimate = false): ConfidenceReading {
  return { level, basis, estimate, criteria, classification: classificationFor(rule, level, estimate) }
}

export function confidenceOf(f: Pick<FindingDraft, 'confidence' | 'meta'>): ConfidenceReading {
  const calc = f.meta.calc
  const rule = f.meta.rule
  const prefix = rule.split('.')[0]
  if (!calc) return reading(rule, levelFromScore(f.confidence), FALLBACK_BASIS, [])

  if ((prefix === 'out_of_scope' || prefix === 'unbilled') && calc.kind === 'time') {
    // Older rows have no match strength: fall back to the stored score.
    const strong = calc.match ? calc.match === 'strong' : f.confidence >= 90
    const rateOk = calc.rate_source === 'contract'
    const hoursOk = !calc.after_hours || calc.hours_source === 'contract'
    const rateText = rateOk
      ? `The hourly rate${calc.after_hours ? ' and out-of-hours multiplier are' : ' is'} stated in the agreement.`
      : `The hourly rate${calc.after_hours ? ' and out-of-hours multiplier come' : ' comes'} from your Settings, not the agreement.`
    const hoursCrit = calc.after_hours
      ? [c('hours_from_agreement', hoursOk, hoursOk ? 'The support hours are stated in the agreement.' : 'The support hours come from your Settings, not the agreement.')]
      : []
    if (prefix === 'out_of_scope') {
      // Which kind of work a ticket is comes from its wording: a keyword match
      // is an interpretation, so it can't be HIGH on its own. Out-of-hours work
      // is the exception: the time entries' own timestamps place it outside the
      // support window, a structured signal rather than a reading of the text.
      const structured = rule === 'out_of_scope.after_hours'
      const clauseOk = !calc.clause_conflict
      const criteria = [
        c(
          'agreement_clause',
          clauseOk,
          clauseOk ? 'An agreement clause excludes or charges for this kind of work, and no other wording in it says the work is included.' : 'An agreement clause excludes or charges for this kind of work, but other wording in the agreement says it is included.',
        ),
        c('strong_text_match', strong, strong ? "The ticket's wording clearly matches that kind of work." : "The ticket's wording is a looser match for that kind of work."),
        c(
          'structured_link',
          structured,
          structured
            ? 'The time entries themselves show the work was outside the support hours.'
            : 'Only the ticket wording links it to this kind of work. No structured field in your records (such as a PSA work type) says so.',
        ),
        c('rate_from_agreement', rateOk, rateText),
        ...hoursCrit,
      ]
      if (!clauseOk) return reading(rule, 'MEDIUM', 'One clause in the agreement excludes this kind of work but other wording says it is included. Read both before charging.', criteria)
      if (!hoursOk) return reading(rule, 'MEDIUM', 'Compared with your default support hours in Settings, not hours stated in the contract.', criteria)
      if (!strong) return reading(rule, 'MEDIUM', "The contract excludes this kind of work, but the ticket's wording is a looser match. Check the ticket first.", criteria)
      if (!rateOk) return reading(rule, 'MEDIUM', 'The contract clause and the ticket both support this, but the hourly rate comes from your Settings, not the agreement.', criteria)
      if (!structured)
        return reading(rule, 'MEDIUM', "The contract excludes this kind of work and the ticket's wording reads like it, but that link is a keyword match, not a field in your records. Read the ticket before charging.", criteria)
      return reading(rule, 'HIGH', 'The contract clause and the ticket both support this, and the rate is the one in the agreement.', criteria)
    }
    if (rule === 'unbilled.billing_mismatch') {
      const criteria = [
        c('baseline_consistent', false, 'The ticket is marked billable but time against it is marked non-billable: your own records disagree.'),
        c('not_goodwill', false, 'The non-billable time may be a deliberate write-off.'),
        c('rate_from_agreement', rateOk, rateText),
      ]
      return reading(rule, 'MEDIUM', 'Your PSA marks the ticket billable but the time non-billable. It may be a deliberate write-off, so check before invoicing.', criteria)
    }
    const criteria = [
      c('agreement_clause', false, calc.contract_checked ? 'No agreement clause makes this work chargeable.' : 'No agreement was uploaded for this client.'),
      c('strong_text_match', strong, strong ? "The ticket's wording clearly matches chargeable work." : "The ticket's wording is a looser match for chargeable work."),
      c('not_goodwill', false, 'The work may have been agreed as included or done as goodwill.'),
      c('rate_from_agreement', rateOk, rateText),
    ]
    return reading(
      rule,
      'LOW',
      calc.contract_checked
        ? 'The ticket reads like chargeable work, but nothing in the agreement confirms it. Check with the technician first.'
        : "The ticket reads like chargeable work. No contract was uploaded for this client, so coverage couldn't be checked.",
      criteria,
    )
  }

  if (prefix === 'mismatch' && calc.kind === 'mismatch') {
    // Older rows have no source: they were always the clients file.
    const fromAgreement = calc.contracted_source === 'contract'
    const unambiguous = !calc.price_ambiguous
    const criteria = [
      c('baseline_from_agreement', fromAgreement, fromAgreement ? `The agreement states ${calc.contracted} ${calc.unit}s.` : `The contracted figure (${calc.contracted}) comes from your clients file, not an uploaded agreement.`),
      c('price_from_billing_line', true, `Valued at the billing line's own price (${calc.price_label}).`),
      c('price_line_unambiguous', unambiguous, unambiguous ? 'Exactly one billing line is the per-unit charge.' : 'More than one billing line could be the per-unit charge.'),
    ]
    if (!fromAgreement) return reading(rule, 'MEDIUM', `The contracted quantity is from your clients file, not an uploaded agreement, and your billing line disagrees with it. Check the agreement first.`, criteria)
    if (!unambiguous) return reading(rule, 'MEDIUM', 'More than one billing line could be the per-unit charge. Check which line applies.', criteria)
    return reading(rule, 'HIGH', 'The quantity stated in the agreement and your billing line disagree.', criteria)
  }

  if (prefix === 'recurring' && calc.kind === 'missing') {
    const criteria = [
      c('baseline_from_agreement', calc.contracted_source === 'contract', calc.contracted_source === 'contract' ? `The agreement states ${calc.contracted} ${calc.unit}s.` : `The contracted figure comes from your clients file.`),
      c('price_from_billing_line', false, `No per-${calc.unit} billing line was found, so this uses your default price in Settings.`),
      c('billing_visible', false, 'The charge may be included in another line, such as a package fee.'),
    ]
    return reading(rule, 'LOW', `No per-${calc.unit} charge was found in your billing data. It may be bundled into another line, so this is valued at your default price only as a guide.`, criteria)
  }

  if (prefix === 'drift' && calc.kind === 'seats') {
    const fromAgreement = calc.baseline_source === 'contract'
    const consistent = calc.baseline_conflict == null
    const lineOk = calc.price_source === 'billing_line'
    const unambiguous = !calc.price_ambiguous
    const dated = !calc.undated
    // Older rows have no billed quantity: they can't show the gap is unbilled.
    const billedKnown = calc.billed != null && calc.billed < calc.actual
    const criteria = [
      c(
        'baseline_from_agreement',
        fromAgreement,
        fromAgreement
          ? `The agreement states ${calc.baseline} ${calc.unit}s.`
          : calc.baseline_source === 'client_record'
            ? `The contracted figure (${calc.baseline}) comes from your clients file, not an uploaded agreement.`
            : 'No contracted figure was found, so this compares with the quantity you bill.',
      ),
      ...(fromAgreement ? [c('baseline_consistent', consistent, consistent ? 'Your clients file agrees with the agreement.' : `Your clients file says ${calc.baseline_conflict}, the agreement says ${calc.baseline}.`)] : []),
      c('price_from_billing_line', lineOk, lineOk ? `Valued at your billing line price (${calc.price_label}).` : `No per-${calc.unit} billing line was found, so this uses your default price in Settings.`),
      ...(lineOk ? [c('price_line_unambiguous', unambiguous, unambiguous ? 'Exactly one billing line is the per-unit charge.' : `More than one billing line could be the per-unit charge (${(calc.price_candidates ?? []).join(', ')}); the lowest price was used.`)] : []),
      c('assets_dated', dated, dated ? `Every active ${calc.unit} has a first-seen date.` : `${calc.undated} active ${calc.unit}${calc.undated === 1 ? ' has' : 's have'} no first-seen date, so they are counted for the whole period.`),
      c(
        'billed_below_active',
        billedKnown,
        billedKnown
          ? `Your billing lines bill ${calc.billed} ${calc.unit}${calc.billed === 1 ? '' : 's'}, fewer than the ${calc.actual} active, and only the ${calc.unit}s beyond those billed are counted.`
          : `No per-${calc.unit} billing line shows how many ${calc.unit}s are billed now.`,
      ),
    ]
    if (calc.baseline_source === 'billing') return reading(rule, 'MEDIUM', 'No contracted figure on the client record, so this compares with the quantity you bill.', criteria)
    if (calc.baseline_source === 'client_record') return reading(rule, 'MEDIUM', `Your clients file says ${calc.baseline} ${calc.unit}s; your ${calc.unit}s list shows ${calc.actual} active. No uploaded agreement states the contracted figure, so check it first.`, criteria)
    if (!consistent) return reading(rule, 'MEDIUM', `The agreement and your clients file give different contracted figures. Check which is current.`, criteria)
    if (!lineOk) return reading(rule, 'MEDIUM', `No per-${calc.unit} billing line was found, so this uses your default price in Settings.`, criteria)
    if (!unambiguous) return reading(rule, 'MEDIUM', 'More than one billing line could be the per-unit charge, so the lowest price was used. Check which line applies.', criteria)
    if (!dated) return reading(rule, 'MEDIUM', `Some ${calc.unit}s have no first-seen date, so the months affected are assumed. Check when they were added.`, criteria)
    if (!billedKnown) return reading(rule, 'MEDIUM', `The billed quantity isn't recorded on this opportunity, so it can't show the extra ${calc.unit}s are unbilled. Run the analysis again.`, criteria)
    return reading(rule, 'HIGH', `Contracted for ${calc.baseline} ${calc.unit}s and billed for ${calc.billed}; your ${calc.unit}s list shows ${calc.actual} active. Valued at your own billing line price.`, criteria)
  }

  if (rule === 'license.unbilled' && calc.kind === 'licence') {
    const exact = calc.match === 'exact'
    const criteria = [
      c('licence_name_exact', exact, exact ? `The licence name in your users export and the billing line name are the same.` : `The licence name and the billing line name only partly match.`),
      c('price_from_billing_line', true, `Valued at the billing line's own price (${calc.price_label}).`),
    ]
    if (!exact) return reading(rule, 'MEDIUM', 'Licence names in your users export were matched to a billing line by a partial name match. Check the match before billing.', criteria)
    return reading(rule, 'HIGH', `${calc.assigned} users are assigned ${calc.licence} and your billing line of the same name bills ${calc.billed}.`, criteria)
  }

  if (rule === 'usage.over_allowance' && calc.kind === 'usage') {
    const fromAgreement = calc.included_source === 'contract' || !!calc.included_confirmed
    const rateOk = calc.rate_source === 'contract'
    const allowanceConsistent = calc.included_conflict == null
    const criteria = [
      c('allowance_from_agreement', fromAgreement, fromAgreement ? `The agreement states ${calc.included} included hours a month.` : 'The included hours come from your clients file only.'),
      ...(fromAgreement ? [c('baseline_consistent', allowanceConsistent, allowanceConsistent ? 'Your clients file does not contradict the agreement.' : `Your clients file says ${calc.included_conflict} hours, the agreement says ${calc.included}.`)] : []),
      c('rate_from_agreement', rateOk, rateOk ? 'The overage rate is the hourly rate stated in the agreement.' : 'The overage rate is your Settings billable rate.'),
      c('billing_visible', false, "Your invoices aren't in the data, so an overage charge may already have been billed."),
    ]
    if (!fromAgreement) return reading(rule, 'LOW', 'The allowance comes from your clients file only, and no overage charge was found in the data provided. Check the agreement and your invoices.', criteria)
    if (!allowanceConsistent) return reading(rule, 'MEDIUM', "The agreement's allowance was used, but your clients file gives a different one. Check which is current, and whether an overage was invoiced.", criteria)
    return reading(rule, 'MEDIUM', 'Hours come from your time entries. No overage charge was found in the data provided, so check whether it was invoiced.', criteria)
  }

  if (rule === 'margin.below_target' && calc.kind === 'margin') {
    const criteria = [
      c('deterministic', false, 'The value is modelled from average hours, costs and a target margin, not counted from records.'),
      c('cost_from_record', calc.software_source === 'client', calc.software_source === 'client' ? 'Software cost comes from your clients file.' : 'Software cost is the per-user default in Settings.'),
    ]
    return reading(
      rule,
      'LOW',
      calc.software_source === 'client'
        ? `An estimate from logged support hours, the labour cost (${gbp(calc.labour_rate)}/h) and target margin (${Math.round(calc.target_margin * 100)}%) in Settings, and the software cost (${gbp(calc.software)} a month) from your clients export.`
        : `An estimate from logged support hours and the labour cost (${gbp(calc.labour_rate)}/h), default software cost per user and target margin (${Math.round(calc.target_margin * 100)}%) in Settings.`,
      criteria,
      true,
    )
  }

  return reading(rule, levelFromScore(f.confidence), FALLBACK_BASIS, [])
}
