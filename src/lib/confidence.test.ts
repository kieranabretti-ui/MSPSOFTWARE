import { describe, expect, it } from 'vitest'
import { analyse } from '../engine/analyse'
import { buildDemoDataset } from '../demo/dataset'
import type { ConfidenceLevel, FindingDraft } from '../engine/types'
import { confidenceOf } from './confidence'

const { findings } = analyse(buildDemoDataset('ws'))

describe('confidenceOf', () => {
  it('splits the demo into High, Medium and Low', () => {
    const by: Record<ConfidenceLevel, { count: number; value: number; monthly: number }> = {
      HIGH: { count: 0, value: 0, monthly: 0 },
      MEDIUM: { count: 0, value: 0, monthly: 0 },
      LOW: { count: 0, value: 0, monthly: 0 },
    }
    for (const f of findings) {
      const l = by[confidenceOf(f).level]
      l.count++
      l.value += f.estimated_value
      l.monthly += f.monthly_value
    }
    expect(by.HIGH).toEqual({ count: 18, value: 2360, monthly: 228 })
    expect(by.MEDIUM).toEqual({ count: 11, value: 1336, monthly: 128 })
    expect(by.LOW).toEqual({ count: 11, value: 585, monthly: 0 })
  })

  it('gives every demo finding a basis', () => {
    for (const f of findings) expect(confidenceOf(f).basis).not.toMatch(/Run the analysis again/)
  })

  it('marks the margin estimate', () => {
    const f = findings.find((x) => x.meta.rule === 'margin.below_target')!
    expect(confidenceOf(f)).toEqual({
      level: 'MEDIUM',
      basis: 'An estimate from logged support hours, the labour cost (£35/h) and target margin (30%) in Settings, and the software cost (£420 a month) from your clients export.',
      estimate: true,
    })
  })

  it('names the Settings default when a client has no software cost of its own', () => {
    const f = findings.find((x) => x.meta.rule === 'margin.below_target')!
    const calc = f.meta.calc as Extract<NonNullable<FindingDraft['meta']['calc']>, { kind: 'margin' }>
    const fallback = { ...f, meta: { ...f.meta, calc: { ...calc, software_source: 'default' as const } } }
    expect(confidenceOf(fallback).basis).toBe(
      'An estimate from logged support hours and the labour cost (£35/h), default software cost per user and target margin (30%) in Settings.',
    )
  })

  it('reads the drift basis from its calculation', () => {
    const f = findings.find((x) => x.meta.calc?.kind === 'seats' && x.meta.calc.baseline === 40)!
    expect(confidenceOf(f).basis).toBe('Contracted for 40 users; your users list shows 43 active. Valued at your own billing line price.')
  })

  const time = (over: Partial<Extract<NonNullable<FindingDraft['meta']['calc']>, { kind: 'time' }>>) => ({
    kind: 'time' as const,
    minutes: 60,
    rate: 60,
    base_rate: 60,
    multiplier: 1,
    after_hours: false,
    hours_source: null,
    contract_checked: true,
    ...over,
  })

  it('drops after-hours work judged on Settings hours to Medium', () => {
    const r = confidenceOf({ confidence: 94, meta: { rule: 'out_of_scope.after_hours', period_values: {}, calc: time({ after_hours: true, hours_source: 'settings' }) } })
    expect(r.level).toBe('MEDIUM')
  })

  it('treats a looser out-of-scope match as Medium', () => {
    expect(confidenceOf({ confidence: 80, meta: { rule: 'out_of_scope.onsite', period_values: {}, calc: time({}) } }).level).toBe('MEDIUM')
  })

  it('says when no contract was there to check unbilled work', () => {
    const r = confidenceOf({ confidence: 65, meta: { rule: 'unbilled.onsite', period_values: {}, calc: time({ contract_checked: false }) } })
    expect(r).toMatchObject({ level: 'LOW', basis: "The ticket reads like chargeable work. No contract was uploaded for this client, so coverage couldn't be checked." })
  })

  it('drops drift valued at the default price or against billing to Medium', () => {
    const seats = { kind: 'seats' as const, unit: 'device' as const, baseline: 10, actual: 12, unit_price: 8, price_label: null }
    expect(confidenceOf({ confidence: 95, meta: { rule: 'drift.device', period_values: {}, calc: { ...seats, baseline_source: 'contract', price_source: 'default' } } }).basis).toBe(
      'No per-device billing line was found, so this uses your default price in Settings.',
    )
    expect(confidenceOf({ confidence: 95, meta: { rule: 'drift.device', period_values: {}, calc: { ...seats, baseline_source: 'billing', price_source: 'billing_line' } } }).level).toBe('MEDIUM')
  })

  it('falls back to the score for findings saved before calculations were recorded', () => {
    const old = (confidence: number) => confidenceOf({ confidence, meta: { rule: 'drift.user', period_values: {} } })
    expect(old(95).level).toBe('HIGH')
    expect(old(75).level).toBe('MEDIUM')
    expect(old(60).level).toBe('LOW')
    expect(old(95).basis).toBe('Run the analysis again to see what this confidence is based on.')
  })
})
