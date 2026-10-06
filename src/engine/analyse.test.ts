import { describe, expect, it } from 'vitest'
import { analyse } from './analyse'
import { buildDemoDataset } from '../demo/dataset'

describe('demo dataset analysis', () => {
  const { summary, findings } = analyse(buildDemoDataset('ws'))

  it('identifies the headline figures', () => {
    expect(summary.total_identified).toBe(4281)
    expect(summary.monthly_recurring).toBe(356)
    expect(summary.annualised).toBe(4272)
  })

  it('breaks down by category', () => {
    const c = summary.by_category
    expect(c.OUT_OF_SCOPE).toMatchObject({ value: 1240, count: 12 })
    expect(c.UNBILLED_TIME).toMatchObject({ value: 840, count: 17 })
    expect(c.AGREEMENT_DRIFT).toMatchObject({ value: 1120, count: 6 })
    expect(c.UNDERPRICED_CLIENT).toMatchObject({ value: 681, count: 3 })
  })

  it('flags the personal MacBook ticket with contract evidence', () => {
    const f = findings.find((x) => x.meta.ticket_ref === '18492')!
    expect(f.category).toBe('OUT_OF_SCOPE')
    expect(f.estimated_value).toBe(80)
    expect(f.confidence).toBe(94)
    expect(f.severity).toBe('HIGH')
    expect(f.evidence[0].text).toContain('company-owned devices only')
  })

  it('trend sums to the identified total', () => {
    expect(summary.trend.reduce((a, p) => a + p.value, 0)).toBe(summary.total_identified)
    expect(summary.trend).toHaveLength(6)
  })

  it('keeps most tickets clean', () => {
    const ticketFindings = findings.filter((f) => f.meta.ticket_ref).length
    expect(summary.data_counts.tickets).toBeGreaterThan(300)
    expect(ticketFindings / summary.data_counts.tickets).toBeLessThan(0.05)
  })
})
