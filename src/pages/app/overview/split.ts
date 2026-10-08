import type { FindingClass, FindingDraft, FindingStatus } from '../../../engine/types'
import { pence } from '../../../engine/money'
import { confidenceOf } from '../../../lib/confidence'

// The conservative headline: High confidence on its own, Medium and Low
// together as Requires review, each split into its monthly and one-off parts.
// Pure, so the Overview, Opportunities and Queue add up the same way.

export interface SplitPart {
  count: number
  // the period value (what the opportunity is worth over the analysis period)
  value: number
  // the recurring part, a month
  monthly: number
  // period value of opportunities with no monthly part
  oneOff: number
}

export interface OpportunitySplit {
  high: SplitPart
  review: SplitPart
  total: SplitPart
  // Medium and Low inside review, for the caption
  medium: number
  low: number
  byClass: Record<FindingClass, number>
}

type Row = Pick<FindingDraft, 'confidence' | 'meta' | 'estimated_value' | 'monthly_value'>

const zero = (): SplitPart => ({ count: 0, value: 0, monthly: 0, oneOff: 0 })
const add = (a: SplitPart, b: SplitPart): SplitPart => ({
  count: a.count + b.count,
  value: pence(a.value + b.value),
  monthly: pence(a.monthly + b.monthly),
  oneOff: pence(a.oneOff + b.oneOff),
})

export function opportunitySplit(findings: Row[]): OpportunitySplit {
  const high = zero()
  const review = zero()
  let medium = 0
  let low = 0
  const byClass: Record<FindingClass, number> = {
    confirmed: 0,
    potential: 0,
    investigate: 0,
  }
  for (const f of findings) {
    const r = confidenceOf(f)
    const part = r.level === 'HIGH' ? high : review
    if (r.level === 'MEDIUM') medium++
    if (r.level === 'LOW') low++
    byClass[r.classification]++
    part.count++
    part.value = pence(part.value + f.estimated_value)
    if (f.monthly_value > 0) part.monthly = pence(part.monthly + f.monthly_value)
    else part.oneOff = pence(part.oneOff + f.estimated_value)
  }
  return { high, review, total: add(high, review), medium, low, byClass }
}

// Value of opportunities the MSP has marked Actioned.
export function actionedOf(findings: { status: FindingStatus; estimated_value: number }[]): { count: number; value: number } {
  const done = findings.filter((f) => f.status === 'resolved')
  return {
    count: done.length,
    value: pence(done.reduce((a, f) => a + f.estimated_value, 0)),
  }
}
