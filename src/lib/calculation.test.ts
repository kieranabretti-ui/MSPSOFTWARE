import { describe, expect, it } from 'vitest'
import { analyse } from '../engine/analyse'
import { buildDemoDataset } from '../demo/dataset'
import { formatCalculation } from './calculation'

const demo = buildDemoDataset('ws')
const { findings } = analyse(demo)
const clientId = (name: string) => demo.clients.find((c) => c.name === name)!.id

describe('formatCalculation on the demo', () => {
  it('reproduces every finding value from its calculation inputs', () => {
    for (const f of findings) {
      expect(f.meta.calc, f.finding_key).toBeDefined()
      const calc = formatCalculation(f)!
      expect(calc.total, f.finding_key).toBe(f.estimated_value)
      expect(calc.monthly, f.finding_key).toBe(f.monthly_value)
      expect(calc.annual, f.finding_key).toBe(f.annual_value)
      expect(calc.lines.length).toBeGreaterThan(0)
    }
  })

  it('shows the out-of-scope sum for the personal MacBook ticket', () => {
    const f = findings.find((x) => x.meta.ticket_ref === '18492')!
    expect(formatCalculation(f)).toMatchObject({ lines: ['1h 20m non-billable × £60/h = £80'], result: '£80 one-off' })
  })

  it('shows the out-of-hours rate when it applies', () => {
    const f = findings.find((x) => x.meta.calc?.kind === 'time' && x.meta.calc.after_hours)!
    expect(formatCalculation(f)!.lines[0]).toMatch(/× £90\/h \(£60 × 1\.5 out of hours\) = £\d+$/)
  })

  it('shows the drift sum at the billing line price', () => {
    const f = findings.find((x) => x.client_id === clientId('ABC Ltd') && x.meta.rule === 'drift.user')!
    expect(formatCalculation(f)).toEqual({
      lines: ['39 active users − 35 contracted = 4 users', '4 × £18 (Managed User Support (per user)) = £72 a month', '£72 × 12 = £864 a year'],
      result: '£72 a month',
      note: '£324 across the period as users were added. See value by month.',
      total: 324,
      monthly: 72,
      annual: 864,
      basis: 'recurring',
    })
  })

  it('shows the margin sum for ABC Ltd', () => {
    const f = findings.find((x) => x.client_id === clientId('ABC Ltd') && x.category === 'UNDERPRICED_CLIENT')!
    const calc = formatCalculation(f)!
    expect(calc.lines).toContain('Target contribution: 30% × £1,850 = £555 a month')
    expect(calc.lines).toContain('£336 ÷ 6 months = £56 a month on average')
    expect(calc.lines.some((l) => l.startsWith('Shortfall in the 4 months below target: ') && l.endsWith('= £336'))).toBe(true)
    expect(calc.result).toBe('£56 a month, estimated')
    expect(calc.basis).toBe('estimate')
    expect(calc.note).toBe('Price that restores 30% at average cost: £1,897 a month (+\u2060£47). An estimate from your cost settings, not a count of records.')
  })

  it('shows one line per month over the allowance', () => {
    const f = findings.find((x) => x.meta.rule === 'usage.over_allowance')!
    const calc = formatCalculation(f)!
    expect(calc.lines[0]).toBe('August 2026: 13h non-billable used − 10h included = 3h × £60 = £180')
    expect(calc.result).toBe('£355 one-off across 2 months')
  })

  it('shows the licence sum', () => {
    const f = findings.find((x) => x.meta.rule === 'license.unbilled')!
    expect(formatCalculation(f)!.lines).toEqual(['22 assigned − 21 billed = 1 licence', '1 × £15 (Microsoft 365 Business Standard) = £15 a month', '£15 × 12 = £180 a year'])
  })

  it('returns null for findings saved before calculations were recorded', () => {
    expect(formatCalculation({ estimated_value: 10, monthly_value: 0, meta: { rule: 'unbilled.onsite', period_values: {} } })).toBeNull()
  })
})
