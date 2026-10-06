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
})
