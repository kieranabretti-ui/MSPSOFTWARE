import { describe, expect, it } from 'vitest'
import { CONFIDENCE, FINDING_STATUS, LEVEL_ORDER, NEXT_STAGE, STAGE_ORDER, recurringKind } from './labels'

describe('opportunity stages', () => {
  it('labels the stored values with the stage names', () => {
    expect(FINDING_STATUS).toEqual({ open: 'New', reviewing: 'Reviewing', valid: 'Approved', resolved: 'Actioned', dismissed: 'Dismissed' })
  })

  it('orders the stages as the workflow runs', () => {
    expect(STAGE_ORDER.map((s) => FINDING_STATUS[s])).toEqual(['New', 'Reviewing', 'Approved', 'Actioned', 'Dismissed'])
  })

  it('steps forward one stage at a time and stops at Actioned', () => {
    expect(NEXT_STAGE.open).toEqual({ to: 'reviewing', label: 'Start review', toast: 'Moved to Reviewing.' })
    expect(NEXT_STAGE.reviewing).toEqual({ to: 'valid', label: 'Approve', toast: 'Approved.' })
    expect(NEXT_STAGE.valid).toEqual({ to: 'resolved', label: 'Mark actioned', toast: 'Marked as actioned.' })
    expect(NEXT_STAGE.resolved).toBeUndefined()
    expect(NEXT_STAGE.dismissed).toBeUndefined()
    for (const [from, next] of Object.entries(NEXT_STAGE)) expect(STAGE_ORDER.indexOf(next!.to)).toBe(STAGE_ORDER.indexOf(from as keyof typeof FINDING_STATUS) + 1)
  })
})

describe('confidence labels', () => {
  it('orders High, Medium, Low with fewer marks each step', () => {
    expect(LEVEL_ORDER.map((l) => CONFIDENCE[l].short)).toEqual(['High', 'Medium', 'Low'])
    expect(LEVEL_ORDER.map((l) => CONFIDENCE[l].marks)).toEqual([3, 2, 1])
  })

  it('splits recurring money into agreement and pricing', () => {
    expect(recurringKind('UNDERPRICED_CLIENT')).toBe('pricing')
    expect(recurringKind('AGREEMENT_DRIFT')).toBe('agreement')
    expect(recurringKind('MISSING_LICENSE')).toBe('agreement')
  })
})
