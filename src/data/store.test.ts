import { describe, expect, it } from 'vitest'
import type { Finding, FindingDraft } from '../engine/types'
import { decisionEvents, isDecided, mergeFindings, normaliseContractText } from './store'

const draft = (key: string, over: Partial<FindingDraft> = {}): FindingDraft => ({
  finding_key: key,
  client_id: 'c1',
  category: 'UNBILLED_TIME',
  severity: 'MEDIUM',
  confidence: 60,
  title: key,
  description: '',
  evidence: [],
  estimated_value: 10,
  monthly_value: 0,
  annual_value: 0,
  recommended_action: '',
  source_data: [],
  meta: { rule: 'unbilled.keyword', period_values: {} },
  ...over,
})

const stored = (key: string, over: Partial<Finding> = {}): Finding => ({
  ...draft(key),
  id: `id-${key}`,
  workspace_id: 'ws',
  analysis_id: 'old',
  status: 'open',
  ai_explanation: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
  ...over,
})

const ctx = { workspaceId: 'ws', analysisId: 'new', at: '2026-10-08T12:00:00Z' }

describe('mergeFindings', () => {
  it('keeps ids and decisions for findings that still apply', () => {
    const prev = [stored('a', { status: 'dismissed', dismiss_reason: 'goodwill', decision_note: 'Agreed with the client', owner: 'Sam', decided_at: '2026-10-02T00:00:00Z', first_viewed_at: '2026-10-02T00:00:00Z', ai_explanation: 'x' })]
    const r = mergeFindings(prev, [draft('a', { estimated_value: 20 })], ctx)
    expect(r.created).toBe(0)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]).toMatchObject({
      id: 'id-a',
      analysis_id: 'new',
      status: 'dismissed',
      dismiss_reason: 'goodwill',
      decision_note: 'Agreed with the client',
      owner: 'Sam',
      decided_at: '2026-10-02T00:00:00Z',
      first_viewed_at: '2026-10-02T00:00:00Z',
      ai_explanation: 'x',
      estimated_value: 20,
      stale: false,
      created_at: '2026-10-01T00:00:00Z',
      updated_at: ctx.at,
    })
  })

  it('keeps a decided finding the engine no longer produces as stale, and drops undecided ones', () => {
    const prev = [stored('approved', { status: 'valid' }), stored('noted', { decision_note: 'check' }), stored('owned', { owner: 'Sam' }), stored('untouched'), stored('blank-note', { decision_note: '  ' })]
    const r = mergeFindings(prev, [draft('fresh')], ctx)
    expect(r.created).toBe(1)
    expect(r.live.map((f) => f.finding_key)).toEqual(['fresh'])
    expect(r.stale).toBe(3)
    expect(r.removed).toBe(2)
    const stale = r.findings.filter((f) => f.stale)
    expect(stale.map((f) => f.finding_key)).toEqual(['approved', 'noted', 'owned'])
    // a stale finding keeps its analysis and decision untouched
    expect(stale[0]).toMatchObject({ id: 'id-approved', analysis_id: 'old', status: 'valid', updated_at: ctx.at })
  })

  it('revives a stale finding that is detected again', () => {
    const prev = [stored('a', { stale: true, status: 'resolved', updated_at: '2026-10-03T00:00:00Z' })]
    const r = mergeFindings(prev, [draft('a')], ctx)
    expect(r.findings).toHaveLength(1)
    expect(r.findings[0]).toMatchObject({ id: 'id-a', stale: false, status: 'resolved' })
    expect(r.stale).toBe(0)
  })

  it('leaves an already stale finding as it was', () => {
    const prev = [stored('a', { stale: true, status: 'valid', updated_at: '2026-10-03T00:00:00Z' })]
    const r = mergeFindings(prev, [], ctx)
    expect(r.findings[0].updated_at).toBe('2026-10-03T00:00:00Z')
  })
})

describe('isDecided', () => {
  it('is true once a person moved, noted or owned it', () => {
    expect(isDecided({ status: 'open' })).toBe(false)
    expect(isDecided({ status: 'reviewing' })).toBe(true)
    expect(isDecided({ status: 'open', decision_note: 'x' })).toBe(true)
    expect(isDecided({ status: 'open', owner: 'Sam' })).toBe(true)
  })
})

describe('decisionEvents', () => {
  const base = { status: 'open' as const, decision_note: null, owner: null, dismiss_reason: null }
  it('records a dismissal with its reason', () => {
    expect(decisionEvents(base, { ...base, status: 'dismissed', dismiss_reason: 'data_wrong' }, 'queue')).toEqual([{ action: 'finding.dismissed', detail: { from: 'open', reason: 'data_wrong', via: 'queue' } }])
  })
  it('records a reopen from Dismissed or Actioned, and forward steps as stage changes', () => {
    expect(decisionEvents({ ...base, status: 'dismissed' }, { ...base, status: 'reviewing' }, 'detail')[0].action).toBe('finding.reopened')
    expect(decisionEvents({ ...base, status: 'resolved' }, { ...base, status: 'valid' }, 'detail')[0].action).toBe('finding.reopened')
    expect(decisionEvents({ ...base, status: 'reviewing' }, { ...base, status: 'open' }, 'detail')[0].action).toBe('finding.reopened')
    expect(decisionEvents(base, { ...base, status: 'reviewing' }, 'detail')).toEqual([{ action: 'finding.stage_changed', detail: { from: 'open', to: 'reviewing', via: 'detail' } }])
  })
  it('records note and owner changes without their text', () => {
    const ev = decisionEvents(base, { ...base, decision_note: 'Checked with Sam', owner: 'Sam' }, 'detail')
    expect(ev).toEqual([
      { action: 'finding.note', detail: { cleared: false, length: 16 } },
      { action: 'finding.owner', detail: { assigned: true } },
    ])
  })
  it('records nothing when nothing changed', () => {
    expect(decisionEvents(base, base, 'detail')).toEqual([])
  })
})

describe('normaliseContractText', () => {
  it('keeps page breaks and line breaks, drops other control characters', () => {
    expect(normaliseContractText('Page one\r\n1. Scope\f\nPage two\u0000\u0007\tend')).toBe('Page one\n1. Scope\f\nPage two\tend')
  })
})
