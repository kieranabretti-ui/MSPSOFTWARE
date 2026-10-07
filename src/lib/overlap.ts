import type { Finding } from '../engine/types'

// Opportunities that cover the same money as another one still counted. The
// engine records them in meta.overlaps (a margin shortfall that billing a
// client's agreement gaps would restore on its own) and they are disclosed,
// never netted, so the totals stay as found. Dismissed opportunities count for
// neither side.
export interface Overlap {
  /** period value of the overlapping opportunities */
  value: number
  /** their monthly value */
  monthly: number
  /** client ids, in the order found */
  clients: string[]
  /** the overlapping opportunities themselves */
  findings: Finding[]
}

export function overlapOf(findings: Finding[]): Overlap {
  const live = findings.filter((f) => f.status !== 'dismissed')
  const keys = new Set(live.map((f) => f.finding_key))
  const over = live.filter((f) => f.meta.overlaps?.some((k) => keys.has(k)))
  return {
    value: over.reduce((a, f) => a + f.estimated_value, 0),
    monthly: over.reduce((a, f) => a + f.monthly_value, 0),
    clients: [...new Set(over.map((f) => f.client_id))],
    findings: over,
  }
}

/** The live opportunities a given one overlaps with. */
export function overlappedBy(f: Finding, findings: Finding[]): Finding[] {
  const keys = new Set(f.meta.overlaps ?? [])
  return keys.size ? findings.filter((o) => o.id !== f.id && o.status !== 'dismissed' && keys.has(o.finding_key)) : []
}
