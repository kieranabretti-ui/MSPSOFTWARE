import { describe, expect, it } from 'vitest'
import type { AuditAction, Finding } from '../engine/types'
import { auditEvent, describeAuditEvent, safeDetail, trustMetrics } from './audit'

let n = 0
function finding(over: Partial<Finding> = {}): Finding {
  n++
  return {
    id: `f${n}`,
    workspace_id: 'ws',
    analysis_id: 'a1',
    finding_key: `k${n}`,
    client_id: 'c1',
    category: 'AGREEMENT_DRIFT',
    severity: 'HIGH',
    confidence: 95,
    title: 't',
    description: 'd',
    evidence: [],
    estimated_value: 100,
    monthly_value: 0,
    annual_value: 0,
    recommended_action: 'r',
    source_data: [],
    // drift.user valued at a billing line against a contracted baseline: HIGH
    meta: { rule: 'drift.user', period_values: {}, calc: { kind: 'seats', unit: 'user', baseline: 39, baseline_source: 'contract', actual: 47, unit_price: 82, price_source: 'billing_line', price_label: 'Per user' } },
    status: 'open',
    ai_explanation: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    ...over,
  }
}

// usage.over_allowance is MEDIUM: needs review
const medium = (over: Partial<Finding> = {}) =>
  finding({ meta: { rule: 'usage.over_allowance', period_values: {}, calc: { kind: 'usage', included: 10, included_source: 'client', rate: 60, months: [] } }, ...over })

describe('trustMetrics', () => {
  it('returns zeros, and no false-positive rate, for an empty workspace', () => {
    const m = trustMetrics([], [])
    expect(m).toMatchObject({ total: 0, decided: 0, opened_pct: 0, reviewed_pct: 0, false_positive_rate: null, avg_opportunity: 0, high_confidence_value: 0, requires_review_value: 0, recovered_value: 0 })
  })

  it('measures review rates over current findings', () => {
    const fs = [
      finding({ first_viewed_at: '2026-10-02T00:00:00Z' }),
      finding({ id: 'seen-in-log' }),
      finding({ status: 'reviewing' }),
      finding({ status: 'valid' }),
      finding({ status: 'resolved', estimated_value: 300 }),
      finding({ status: 'dismissed', dismiss_reason: 'data_wrong' }),
      finding({ status: 'dismissed', dismiss_reason: 'goodwill' }),
      finding(),
    ]
    const m = trustMetrics(fs, [{ action: 'finding.viewed', target_id: 'seen-in-log' }, { action: 'finding.note', target_id: fs[7].id }])
    expect(m.total).toBe(8)
    expect(m.opened_pct).toBe(25) // first_viewed_at, or a finding.viewed event
    expect(m.reviewed_pct).toBe(62.5) // 5 of 8 off New
    expect(m.dismissed_pct).toBe(25)
    expect(m.actioned_pct).toBe(12.5)
    expect(m.approved_pct).toBe(25) // Approved or Actioned
    expect(m.decided).toBe(4)
    // one of four decided was dismissed as wrong; goodwill is valid-but-waived
    expect(m.false_positive_rate).toBe(25)
    expect(m.recovered_value).toBe(300)
  })

  it('splits counted value by confidence and leaves dismissed out', () => {
    const fs = [finding({ estimated_value: 656 }), medium({ estimated_value: 120 }), medium({ estimated_value: 80, status: 'dismissed', dismiss_reason: 'other' })]
    const m = trustMetrics(fs, [])
    expect(m.high_confidence_value).toBe(656)
    expect(m.requires_review_value).toBe(120)
    expect(m.avg_opportunity).toBe(388)
  })

  it('counts stale findings in decisions and recovery, not in current rates or value', () => {
    const fs = [finding({ estimated_value: 50 }), finding({ stale: true, status: 'resolved', estimated_value: 200 }), finding({ stale: true, status: 'dismissed', dismiss_reason: 'contract_allows' })]
    const m = trustMetrics(fs, [])
    expect(m.total).toBe(1)
    expect(m.decided).toBe(2)
    expect(m.false_positive_rate).toBe(50)
    expect(m.recovered_value).toBe(200)
    expect(m.high_confidence_value).toBe(50)
  })
})

describe('audit events', () => {
  it('keeps only ids, counts, kinds and flags in detail', () => {
    expect(safeDetail({ rows: 12, kind: 'tickets', ok: true, none: null, note: 'Client said they would pay next month', id: '0b7a6c1e-1f1e-4c51-9b7b-4b0e2f1c9d10' })).toEqual({
      rows: 12,
      kind: 'tickets',
      ok: true,
      none: null,
      id: '0b7a6c1e-1f1e-4c51-9b7b-4b0e2f1c9d10',
    })
  })

  it('builds an event with actor and target', () => {
    const e = auditEvent('ws', { id: 'u1', email: 'a@b.test' }, 'finding.dismissed', { type: 'finding', id: 'f1' }, { reason: 'data_wrong' }, '2026-10-08T09:00:00Z')
    expect(e).toMatchObject({ workspace_id: 'ws', actor_id: 'u1', actor_email: 'a@b.test', action: 'finding.dismissed', target_type: 'finding', target_id: 'f1', detail: { reason: 'data_wrong' }, created_at: '2026-10-08T09:00:00Z' })
    expect(e.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('describes each action in plain English', () => {
    const d = (action: AuditAction, detail = {}) => describeAuditEvent({ action, detail })
    expect(d('upload.created', { kind: 'tickets', rows: 240 })).toBe('Imported a tickets file (240 rows)')
    expect(d('upload.created', { kind: 'contract', file_stored: true })).toBe('Added a contract (original file stored)')
    expect(d('upload.deleted', { kind: 'assets', assets: 47, clients: 1 })).toBe('Deleted a users and devices upload and 48 records it produced')
    expect(d('analysis.run', { findings: 40, stale: 2, removed: 1 })).toBe('Ran an analysis: 40 opportunities found, 2 no longer detected but kept because they had a decision, 1 no longer detected and removed')
    expect(d('analysis.deleted', { findings: 1 })).toBe('Deleted an analysis and its 1 opportunity')
    expect(d('finding.created', { count: 40 })).toBe('40 new opportunities recorded')
    expect(d('finding.viewed')).toBe('Opened an opportunity for the first time')
    expect(d('finding.stage_changed', { from: 'open', to: 'reviewing' })).toBe('Moved an opportunity from New to Reviewing')
    expect(d('finding.stage_changed', { from: 'open', to: 'reviewing', via: 'task' })).toBe('Moved an opportunity from New to Reviewing by adding a task')
    expect(d('finding.dismissed', { reason: 'contract_allows' })).toBe('Dismissed an opportunity: the agreement covers it')
    expect(d('finding.dismissed')).toBe('Dismissed an opportunity: no reason given')
    expect(d('finding.reopened', { from: 'dismissed' })).toBe('Reopened an opportunity (was Dismissed)')
    expect(d('finding.note', { cleared: false })).toBe('Added or edited a note on an opportunity')
    expect(d('finding.owner', { assigned: true })).toBe('Assigned an owner to an opportunity')
    expect(d('ai.explained')).toBe('Requested an AI-assisted explanation of an opportunity')
    expect(d('export.pdf')).toBe('Downloaded the PDF report')
    expect(d('export.csv', { rows: 1 })).toBe('Exported 1 opportunity as CSV')
    expect(d('settings.changed', { fields: 2, renamed: false })).toBe('Changed 2 settings')
    expect(d('settings.changed', { fields: 0, renamed: true })).toBe('Renamed the workspace')
    expect(d('data.cleared')).toBe('Cleared all workspace data')
    expect(d('workspace.deleted')).toBe('Deleted the workspace')
    expect(d('account.deleted')).toBe('Deleted the account')
  })
})
