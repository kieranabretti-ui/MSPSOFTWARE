import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyse } from '../engine/analyse'
import { buildDemoDataset } from '../demo/dataset'
import type { ConfidenceLevel, FindingDraft } from '../engine/types'
import { CONFIDENCE_DEFINITIONS, confidenceOf, confidenceSplit } from './confidence'

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
    // Licence HIGH (exact name match); margin estimates LOW (modelled);
    // out-of-scope work linked only by ticket keywords capped at MEDIUM.
    expect(by.HIGH).toEqual({ count: 9, value: 1405, monthly: 243 })
    expect(by.MEDIUM).toEqual({ count: 17, value: 1610, monthly: 0 })
    expect(by.LOW).toEqual({ count: 14, value: 1266, monthly: 113 })
  })

  it('splits the headline into high confidence and requires review without changing the total', () => {
    const split = confidenceSplit(findings)
    expect(split.high).toEqual({ count: 9, value: 1405, monthly: 243 })
    expect(split.review).toEqual({ count: 31, value: 2876, monthly: 113 })
    expect(split.total).toEqual({ count: 40, value: 4281, monthly: 356 })
  })

  it('classifies every demo finding from its confidence and rule', () => {
    const by: Record<string, number> = {}
    for (const f of findings) {
      expect(f.classification).toBe(confidenceOf(f).classification)
      by[f.classification!] = (by[f.classification!] ?? 0) + 1
    }
    expect(by).toEqual({ confirmed: 7, potential: 19, investigate: 14 })
  })

  it('writes the band midpoint as the stored score so old readers agree', () => {
    for (const f of findings) expect(f.confidence).toBe({ HIGH: 95, MEDIUM: 80, LOW: 50 }[confidenceOf(f).level])
  })

  it('gives every demo finding a basis', () => {
    for (const f of findings) expect(confidenceOf(f).basis).not.toMatch(/Run the analysis again/)
  })

  it('marks the margin estimate', () => {
    const f = findings.find((x) => x.meta.rule === 'margin.below_target')!
    expect(confidenceOf(f)).toMatchObject({
      level: 'LOW',
      basis: 'An estimate from logged support hours, the labour cost (£35/h) and target margin (30%) in Settings, and the software cost (£420 a month) from your clients export.',
      estimate: true,
      classification: 'investigate',
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
    expect(confidenceOf(f).basis).toBe('Contracted for 40 users and billed for 40; your users list shows 43 active. Valued at your own billing line price.')
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
    rate_source: 'contract' as const,
    match: 'strong' as const,
    ...over,
  })

  it('drops after-hours work judged on Settings hours to Medium', () => {
    const r = confidenceOf({ confidence: 94, meta: { rule: 'out_of_scope.after_hours', period_values: {}, calc: time({ after_hours: true, hours_source: 'settings' }) } })
    expect(r.level).toBe('MEDIUM')
  })

  it('treats a looser out-of-scope match as Medium', () => {
    expect(confidenceOf({ confidence: 80, meta: { rule: 'out_of_scope.onsite', period_values: {}, calc: time({ match: 'loose' }) } }).level).toBe('MEDIUM')
  })

  it('reads match strength from the stored score for rows saved before it was recorded', () => {
    const loose = confidenceOf({ confidence: 80, meta: { rule: 'out_of_scope.onsite', period_values: {}, calc: time({ match: undefined }) } })
    expect(loose.criteria.find((c) => c.id === 'strong_text_match')?.met).toBe(false)
    const strong = confidenceOf({ confidence: 94, meta: { rule: 'out_of_scope.onsite', period_values: {}, calc: time({ match: undefined }) } })
    expect(strong.criteria.find((c) => c.id === 'strong_text_match')?.met).toBe(true)
  })

  it('drops out-of-scope work valued at the Settings rate to Medium', () => {
    const r = confidenceOf({ confidence: 95, meta: { rule: 'out_of_scope.onsite', period_values: {}, calc: time({ rate_source: 'settings' }) } })
    expect(r).toMatchObject({ level: 'MEDIUM', classification: 'potential' })
    expect(r.criteria.find((c) => c.id === 'rate_from_agreement')?.met).toBe(false)
  })

  it('caps out-of-scope work linked only by ticket keywords at Medium, even with every other check met', () => {
    const r = confidenceOf({ confidence: 95, meta: { rule: 'out_of_scope.onsite', period_values: {}, calc: time({}) } })
    expect(r).toMatchObject({ level: 'MEDIUM', classification: 'potential' })
    expect(r.basis).toMatch(/keyword match/)
    expect(r.criteria.find((c) => c.id === 'structured_link')?.met).toBe(false)
    expect(r.criteria.filter((c) => c.id !== 'structured_link').every((c) => c.met)).toBe(true)
  })

  it('keeps a HIGH out-of-hours finding a potential opportunity, not a confirmed one', () => {
    const r = confidenceOf({ confidence: 95, meta: { rule: 'out_of_scope.after_hours', period_values: {}, calc: time({ after_hours: true, hours_source: 'contract' }) } })
    expect(r).toMatchObject({ level: 'HIGH', classification: 'potential' })
    expect(r.criteria.find((c) => c.id === 'structured_link')?.met).toBe(true)
  })

  it('says when no contract was there to check unbilled work', () => {
    const r = confidenceOf({ confidence: 65, meta: { rule: 'unbilled.onsite', period_values: {}, calc: time({ contract_checked: false }) } })
    expect(r).toMatchObject({ level: 'LOW', basis: "The ticket reads like chargeable work. No contract was uploaded for this client, so coverage couldn't be checked." })
  })

  it('drops drift on the clients file, an ambiguous price line or undated assets to Medium', () => {
    const seats = { kind: 'seats' as const, unit: 'device' as const, baseline: 10, actual: 12, unit_price: 8, price_label: 'Per device', billed: 10 }
    const read = (over: object) => confidenceOf({ confidence: 95, meta: { rule: 'drift.device', period_values: {}, calc: { ...seats, baseline_source: 'contract' as const, price_source: 'billing_line' as const, ...over } } })
    expect(read({})).toMatchObject({ level: 'HIGH', classification: 'confirmed' })
    expect(read({ baseline_source: 'client_record' })).toMatchObject({ level: 'MEDIUM', classification: 'potential' })
    expect(read({ baseline_conflict: 11 }).level).toBe('MEDIUM')
    expect(read({ price_ambiguous: true, price_candidates: ['A', 'B'] }).level).toBe('MEDIUM')
    expect(read({ undated: 2 }).level).toBe('MEDIUM')
  })

  it('drops drift valued at the default price or against billing to Medium', () => {
    const seats = { kind: 'seats' as const, unit: 'device' as const, baseline: 10, actual: 12, unit_price: 8, price_label: null }
    expect(confidenceOf({ confidence: 95, meta: { rule: 'drift.device', period_values: {}, calc: { ...seats, baseline_source: 'contract', price_source: 'default' } } }).basis).toBe(
      'No per-device billing line was found, so this uses your default price in Settings.',
    )
    expect(confidenceOf({ confidence: 95, meta: { rule: 'drift.device', period_values: {}, calc: { ...seats, baseline_source: 'billing', price_source: 'billing_line' } } }).level).toBe('MEDIUM')
  })

  it('rates a partial licence name match Medium and an exact one High', () => {
    const lic = { kind: 'licence' as const, licence: 'M365 BP', assigned: 5, billed: 4, unit_price: 18, price_label: 'M365 BP' }
    expect(confidenceOf({ confidence: 0, meta: { rule: 'license.unbilled', period_values: {}, calc: { ...lic, match: 'exact' } } }).level).toBe('HIGH')
    expect(confidenceOf({ confidence: 0, meta: { rule: 'license.unbilled', period_values: {}, calc: { ...lic, match: 'partial' } } }).level).toBe('MEDIUM')
  })

  it('falls back to the score for findings saved before calculations were recorded', () => {
    const old = (confidence: number) => confidenceOf({ confidence, meta: { rule: 'drift.user', period_values: {} } })
    expect(old(95).level).toBe('HIGH')
    expect(old(75).level).toBe('MEDIUM')
    expect(old(60).level).toBe('LOW')
    expect(old(95).basis).toBe('Run the analysis again to see what this confidence is based on.')
  })
})

describe('docs/methodology.md', () => {
  it('states the same confidence definitions as the code', () => {
    const doc = readFileSync(new URL('../../docs/methodology.md', import.meta.url), 'utf8')
    for (const [level, text] of Object.entries(CONFIDENCE_DEFINITIONS)) expect(doc, level).toContain(text)
  })
})
