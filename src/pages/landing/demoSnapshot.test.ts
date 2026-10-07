import { describe, expect, it } from 'vitest'
import { DEMO } from './demoSnapshot'
import { buildLandingSnapshot } from './buildSnapshot'

// The landing page shows real demo figures from a precomputed snapshot. If this
// fails, the engine or the demo dataset changed: regenerate the snapshot with
// `npx tsx src/pages/landing/writeSnapshot.ts` and check the page still reads.
describe('landing demo snapshot', () => {
  it('matches the engine run on the demo dataset', () => {
    expect(DEMO).toEqual(buildLandingSnapshot())
  })

  it('keeps the pinned headline figures', () => {
    expect(DEMO.totals.identified).toBe(4281)
    expect(DEMO.totals.monthly).toBe(356)
    expect(DEMO.totals.annual).toBe(4272)
  })

  it('prices the example client from its own costs at the target margin', () => {
    const c = DEMO.client
    const margin = (c.recommended - c.labour - c.software) / c.recommended
    expect(Math.abs(margin - DEMO.settings.targetMargin)).toBeLessThan(0.001)
    expect(c.leakage).toBe(c.findings.reduce((a, f) => a + f.value, 0))
  })

  it('splits every opportunity by confidence level and by stage', () => {
    const sum = (xs: { count: number; value: number }[]) => xs.reduce((a, x) => ({ count: a.count + x.count, value: a.value + x.value }), { count: 0, value: 0 })
    expect(sum(DEMO.levels)).toEqual({ count: DEMO.totals.findings, value: 4281 })
    expect(sum(DEMO.stages)).toEqual({ count: 40, value: DEMO.totals.identified })
  })

  it('never shows an overlapping finding in the hero ledger', () => {
    expect(DEMO.topFindings.some((f) => f.overlaps)).toBe(false)
    expect(DEMO.recurring.rows.reduce((a, f) => a + f.monthly, 0) + DEMO.recurring.restMonthly).toBe(DEMO.totals.monthly)
  })
})
