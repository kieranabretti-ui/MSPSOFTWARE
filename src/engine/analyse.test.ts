import { describe, expect, it } from 'vitest'
import { analyse } from './analyse'
import { liveClientHealth } from './health'
import { stripJoiners } from './format'
import { buildDemoDataset } from '../demo/dataset'

// Client ids are generated per build, so lookups by name use this dataset.
const demo = buildDemoDataset('ws')
const { summary, findings } = analyse(demo)
const clientNamed = (name: string) => demo.clients.find((c) => c.name === name)!

describe('demo dataset analysis', () => {

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
    // A keyword match links the ticket to personal-device work: Medium.
    expect(f.confidence).toBe(80)
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

  it('gives every finding a unique key', () => {
    expect(summary.finding_keys).toHaveLength(40)
    expect(new Set(summary.finding_keys).size).toBe(summary.finding_keys!.length)
  })

  it('discloses the overlap between ABC Ltd margin and its user drift', () => {
    const abc = clientNamed('ABC Ltd')
    const margin = findings.find((f) => f.client_id === abc.id && f.category === 'UNDERPRICED_CLIENT')!
    expect(margin.meta.overlaps).toContain(`AGREEMENT_DRIFT:${abc.id}:user`)
    expect(margin.description).toContain('£555')
    expect(margin.description).toContain('£56')
    expect(margin.description).toContain('£522')
    expect(margin.description).toContain('£336')
    expect(findings.filter((f) => f.meta.overlaps?.length)).toHaveLength(1)
  })

  it('tells ABC Ltd to bill its agreement gaps before repricing', () => {
    const abc = clientNamed('ABC Ltd')
    const mt = summary.client_metrics.find((c) => c.client_id === abc.id)!
    expect(mt.health).toBe('at_risk')
    expect(stripJoiners(mt.recommendation)).toBe('Bill the agreement gaps first (+£72 a month). That restores the 30% target margin on its own, so repricing can wait.')
    // With the user drift dismissed, nothing restores the margin but pricing.
    const live = findings.filter((f) => f.client_id === abc.id && f.finding_key !== `AGREEMENT_DRIFT:${abc.id}:user`)
    const h = liveClientHealth(mt, live, summary.settings!, summary.average_monthly_hours, summary.months.length)
    expect(h.recommendation).toBe('Review pricing or move this client to a higher support tier.')
    // Every other client's next step is unchanged by the overlap.
    expect(summary.client_metrics.filter((c) => /agreement gaps first/.test(c.recommendation)).map((c) => c.name)).toEqual(['ABC Ltd'])
  })

  it('records the drift calculation inputs', () => {
    const riverside = clientNamed('Riverside Care Group')
    const drift = findings.find((f) => f.client_id === riverside.id && f.meta.rule === 'drift.user')!
    expect(drift.meta.calc).toMatchObject({ kind: 'seats', baseline: 40, actual: 43, unit_price: 18, baseline_source: 'contract', price_source: 'billing_line' })
  })

  it('reports what the data covers', () => {
    expect(summary.coverage).toEqual({ clients: 15, clients_with_contract: 15, clients_with_mrr: 15, clients_with_assets: 15, time_entries_unmatched: 0 })
  })
})

describe('duplicate tickets', () => {
  it('ignores a ticket imported twice with the same id', () => {
    const ds = buildDemoDataset('ws')
    const { summary } = analyse({ ...ds, tickets: [...ds.tickets, ...ds.tickets] })
    expect(summary.total_identified).toBe(4281)
    expect(summary.finding_count).toBe(40)
  })

  it('ignores a ticket imported twice under new ids', () => {
    const ds = buildDemoDataset('ws')
    const copies = ds.tickets.map((t) => ({ ...t, id: `${t.id}-copy` }))
    const { summary, findings } = analyse({ ...ds, tickets: [...ds.tickets, ...copies] })
    expect(summary.total_identified).toBe(4281)
    expect(new Set(findings.map((f) => f.finding_key)).size).toBe(findings.length)
  })
})

describe('clients without MRR', () => {
  it("marks margin unknown and doesn't call the client at risk on margin", () => {
    const ds = buildDemoDataset('ws')
    const target = ds.clients[0]
    const { summary } = analyse({ ...ds, clients: ds.clients.map((c) => (c.id === target.id ? { ...c, monthly_recurring_revenue: 0 } : c)) })
    const mt = summary.client_metrics.find((c) => c.client_id === target.id)!
    expect(mt.margin_known).toBe(false)
    expect(mt.target_price).toBeNull()
    expect(mt.health).toBe('watch')
    expect(mt.reasons[0]).toMatch(/^No monthly recurring revenue recorded/)
    expect(mt.reasons.some((r) => /^Margin/.test(r))).toBe(false)
    expect(mt.recommendation).toBe("Add this client's monthly recurring revenue to measure margin.")
  })

  it('prices ABC Ltd for the target margin the same way as its margin finding', () => {
    expect(summary.client_metrics.find((c) => c.name === 'ABC Ltd')?.target_price).toBe(1897)
  })
})

describe('after-hours support window', () => {
  it('uses the contract when its clause states the Settings hours', () => {
    const afterHours = findings.filter((f) => f.meta.calc?.kind === 'time' && f.meta.calc.after_hours)
    expect(afterHours.length).toBeGreaterThan(0)
    for (const f of afterHours) expect(f.meta.calc).toMatchObject({ hours_source: 'contract' })
  })

  it('falls back to Settings when the clause states other hours', () => {
    const ds = buildDemoDataset('ws')
    const contracts = ds.contracts.map((c) => ({ ...c, text: c.text.replace('between 08:30 and 17:30', 'between 09:00 and 17:00') }))
    const { findings: fs } = analyse({ ...ds, contracts })
    const afterHours = fs.filter((f) => f.meta.calc?.kind === 'time' && f.meta.calc.after_hours)
    expect(afterHours.length).toBeGreaterThan(0)
    for (const f of afterHours) expect(f.meta.calc).toMatchObject({ hours_source: 'settings' })
  })
})
