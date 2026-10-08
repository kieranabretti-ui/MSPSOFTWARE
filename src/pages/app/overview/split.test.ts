import { describe, expect, it } from 'vitest'
import { analyse } from '../../../engine/analyse'
import { buildDemoDataset } from '../../../demo/dataset'
import { actionedOf, opportunitySplit } from './split'

const { findings } = analyse(buildDemoDataset('ws'))

describe('opportunity split (dashboard headline)', () => {
  const s = opportunitySplit(findings)

  it('separates High confidence from Requires review and adds up to the pinned total', () => {
    expect(Math.round(s.high.value)).toBe(2405)
    expect(Math.round(s.review.value)).toBe(1876)
    expect(Math.round(s.total.value)).toBe(4281)
    expect(s.total.count).toBe(40)
    expect(s.high.count + s.review.count).toBe(40)
    expect(s.medium + s.low).toBe(s.review.count)
  })

  it('keeps the pinned monthly figure and splits the period total into recurring and one-off', () => {
    expect(Math.round(s.total.monthly)).toBe(356)
    expect(Math.round(s.total.oneOff)).toBe(2435)
    expect(Math.round(s.high.monthly + s.review.monthly)).toBe(356)
  })

  it('counts every finding under one classification', () => {
    expect(s.byClass.confirmed + s.byClass.potential + s.byClass.investigate).toBe(40)
  })

  it('values only Actioned opportunities as actioned', () => {
    expect(
      actionedOf([
        { status: 'resolved', estimated_value: 10.5 },
        { status: 'valid', estimated_value: 99 },
        { status: 'resolved', estimated_value: 1.25 },
      ]),
    ).toEqual({ count: 2, value: 11.75 })
  })
})
