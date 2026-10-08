import type { ConfidenceLevel, FindingDraft } from '../engine/types'
import { confidenceOf } from '../engine/confidence'
import { pence } from '../engine/money'

// The app's door to the confidence model. The model itself lives in
// src/engine/confidence.ts (types only, so this never pulls in the rules
// engine); docs/methodology.md documents the same criteria.
export {
  confidenceOf,
  classificationFor,
  CONFIDENCE_DEFINITIONS,
  CLASSIFICATION_DEFINITIONS,
  type ConfidenceReading,
  type Criterion,
  type CriterionId,
} from '../engine/confidence'

export interface ConfidenceTotals {
  count: number
  value: number
  monthly: number
}

// Conservative headline: HIGH-confidence findings first and on their own,
// everything else as "requires review". Estimates are never HIGH, so they can
// only land in review. total = high + review, for a clearly labelled sum.
export function confidenceSplit(findings: Pick<FindingDraft, 'confidence' | 'meta' | 'estimated_value' | 'monthly_value'>[]): {
  high: ConfidenceTotals
  review: ConfidenceTotals
  total: ConfidenceTotals
  byLevel: Record<ConfidenceLevel, ConfidenceTotals>
} {
  const zero = (): ConfidenceTotals => ({ count: 0, value: 0, monthly: 0 })
  const byLevel: Record<ConfidenceLevel, ConfidenceTotals> = { HIGH: zero(), MEDIUM: zero(), LOW: zero() }
  for (const f of findings) {
    const t = byLevel[confidenceOf(f).level]
    t.count++
    t.value = pence(t.value + f.estimated_value)
    t.monthly = pence(t.monthly + f.monthly_value)
  }
  const add = (a: ConfidenceTotals, b: ConfidenceTotals): ConfidenceTotals => ({ count: a.count + b.count, value: pence(a.value + b.value), monthly: pence(a.monthly + b.monthly) })
  const review = add(byLevel.MEDIUM, byLevel.LOW)
  return { high: byLevel.HIGH, review, total: add(byLevel.HIGH, review), byLevel }
}
