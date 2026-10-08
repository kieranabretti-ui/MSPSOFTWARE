import { describe, expect, it } from 'vitest'
import { analyse } from './analyse'
import { importRows } from '../data/importers'
import { confidenceOf } from '../lib/confidence'
import { formatCalculation } from '../lib/calculation'
import { DEFAULT_SETTINGS, type Asset, type BillingItem, type Client, type Contract, type Dataset, type FindingDraft, type Ticket, type TimeEntry } from './types'

// Known-answer tests: tiny hand-built datasets whose right answer is worked out
// by hand, one per rule, independent of the demo. Every figure below can be
// checked with a calculator. If one fails, a rule's arithmetic, evidence or
// confidence changed.

const WS = 'ws'
let seq = 0
const id = (p: string) => `${p}-${++seq}`

function client(name: string, over: Partial<Client> = {}): Client {
  return {
    id: id('client'),
    workspace_id: WS,
    name,
    monthly_recurring_revenue: 0,
    contracted_users: null,
    contracted_devices: null,
    package: null,
    contract_start: null,
    contract_end: null,
    included_hours: null,
    monthly_software_cost: null,
    created_at: '2026-01-01T00:00:00Z',
    source: { upload_id: 'up-clients', file_name: 'clients.csv', row: 2 },
    ...over,
  }
}
const contract = (c: Client, title: string, text: string): Contract => ({ id: id('contract'), workspace_id: WS, client_id: c.id, title, text, upload_id: id('up-contract'), created_at: '2026-01-01T00:00:00Z' })
const line = (c: Client, service: string, quantity: number, unit_price: number, row = 2): BillingItem => ({
  id: id('bill'),
  workspace_id: WS,
  client_id: c.id,
  service,
  quantity,
  unit_price,
  monthly_value: quantity * unit_price,
  source: { upload_id: 'up-billing', file_name: 'billing.csv', row },
})
const users = (c: Client, n: number, first_seen = '2025-06-01', license: string | null = null): Asset[] =>
  Array.from({ length: n }, (_, i) => ({ id: id('asset'), workspace_id: WS, client_id: c.id, asset_type: 'user' as const, name: `User ${i + 1}`, ownership: null, license, status: 'active' as const, first_seen }))
const entry = (c: Client, date: string, minutes: number, billable: boolean, ticket: string | null = null): TimeEntry => ({
  id: id('time'),
  workspace_id: WS,
  client_id: c.id,
  ticket_external_id: ticket,
  date,
  technician: 'Sam',
  minutes,
  billable,
  source: { upload_id: 'up-time', file_name: 'time.csv', row: 2 },
})
const ticket = (c: Client, external_id: string, date: string, subject: string, minutes: number, billable = false): Ticket => ({
  id: id('ticket'),
  workspace_id: WS,
  client_id: c.id,
  external_id,
  date,
  technician: 'Sam',
  subject,
  description: null,
  status: 'Closed',
  time_spent_minutes: minutes,
  billable,
  source: { upload_id: 'up-tickets', file_name: 'tickets.csv', row: 7 },
})
const dataset = (over: Partial<Dataset>): Dataset => ({ settings: { ...DEFAULT_SETTINGS }, clients: [], contracts: [], tickets: [], time_entries: [], billing_items: [], assets: [], ...over })
// A billable entry with no ticket fixes the analysis window to September 2026
// without raising any finding of its own.
const window = (c: Client) => entry(c, '2026-09-10T10:00:00', 30, true)
const byRule = (fs: FindingDraft[], rule: string) => {
  const hit = fs.filter((f) => f.meta.rule === rule)
  expect(hit, rule).toHaveLength(1)
  return hit[0]
}
const claimTypes = (f: FindingDraft) => new Set(f.claims?.map((c) => c.type))

describe('known answer: agreement drift (brief example)', () => {
  // 39 contracted users, 47 active, £82 per user:
  // 47 − 39 = 8; 8 × £82 = £656 a month; £656 × 12 = £7,872 a year.
  const acme = client('Acme Ltd', { contracted_users: 39 })
  const agreement = contract(acme, 'Acme Managed Services Agreement', '1. Services\n\n1.1 Remote support for the Client.\n\n1.2 The monthly charge is based on 39 supported users.')
  // Users go through the real importer so provenance is tested end to end.
  const imported = importRows(
    'assets',
    Array.from({ length: 47 }, (_, i) => ({ client: 'Acme Ltd', type: 'user', name: `Person ${i + 1}`, status: 'active', first_seen: '2025-03-01' })),
    { workspaceId: WS, clients: [acme], upload_id: 'up-users', file_name: 'users.csv' },
  )
  const ds = dataset({ clients: [acme], contracts: [agreement], assets: imported.assets, billing_items: [line(acme, 'Managed Support (per user)', 39, 82)], time_entries: [window(acme)] })
  const { findings } = analyse(ds)
  const f = byRule(findings, 'drift.user')

  it('calculates 8 extra users, £656 a month and £7,872 a year', () => {
    expect(f.meta.calc).toMatchObject({ kind: 'seats', baseline: 39, actual: 47, unit_price: 82, baseline_source: 'contract', price_source: 'billing_line' })
    expect(f.monthly_value).toBe(656)
    expect(f.annual_value).toBe(7872)
    expect(f.estimated_value).toBe(656) // one month analysed
    expect(formatCalculation(f)).toMatchObject({
      lines: ['47 active users − 39 contracted = 8 users', '8 × £82 = £656 a month, priced as Managed Support (per user)', '£656 × 12 = £7,872 a year'],
      monthly: 656,
      annual: 7872,
      basis: 'recurring',
    })
  })

  it('is HIGH confidence and a confirmed discrepancy', () => {
    expect(confidenceOf(f)).toMatchObject({ level: 'HIGH', classification: 'confirmed', estimate: false })
    expect(f.classification).toBe('confirmed')
    expect(confidenceOf(f).criteria.every((c) => c.met)).toBe(true)
  })

  it('cites the agreement section, the clients file, every user and the billing line', () => {
    expect(f.evidence.map((e) => e.source)).toEqual(['agreement', 'client_record', 'asset_register', 'billing'])
    expect(f.evidence[0].label).toBe('Agreement · Acme Managed Services Agreement, section 1.2')
    expect(f.evidence[0].refs![0]).toMatchObject({ table: 'contracts', id: agreement.id, section: '1.2', upload_id: agreement.upload_id })
    const assetRefs = f.source_data.filter((r) => r.table === 'assets')
    expect(assetRefs).toHaveLength(47)
    expect(assetRefs[0]).toMatchObject({ upload_id: 'up-users', file_name: 'users.csv', row: 2 })
    expect(assetRefs[46]).toMatchObject({ file_name: 'users.csv', row: 48 })
    expect(f.source_data.find((r) => r.table === 'billing_items')).toMatchObject({ file_name: 'billing.csv', row: 2 })
  })

  it('separates facts, observations, interpretation and recommendation', () => {
    expect(claimTypes(f)).toEqual(new Set(['fact', 'observation', 'interpretation', 'recommendation']))
    expect(f.claims!.filter((c) => c.type === 'observation').map((c) => c.text)).toContain('8 × £82 = £656 a month, £7,872 a year.')
  })

  it('drops to MEDIUM when only the clients file states the contracted figure, and says so', () => {
    const { findings: fs } = analyse({ ...ds, contracts: [] })
    const g = byRule(fs, 'drift.user')
    expect(g.monthly_value).toBe(656)
    expect(confidenceOf(g)).toMatchObject({ level: 'MEDIUM', classification: 'potential' })
    expect(g.evidence[0]).toMatchObject({ source: 'client_record', label: 'Client record · clients file' })
    expect(g.evidence.some((e) => e.source === 'agreement')).toBe(false)
  })
})

describe('known answer: unbilled time', () => {
  // 90 non-billable minutes of new starter setup, no contract, £60/h in Settings:
  // 1.5h × £60 = £90, one-off. LOW: nothing confirms it is chargeable.
  const c = client('Beta Ltd')
  const t = ticket(c, '501', '2026-09-01T10:00:00', 'New starter account and mailbox', 90)
  const { findings } = analyse(dataset({ clients: [c], tickets: [t] }))
  const f = findings.find((x) => x.category === 'UNBILLED_TIME')!

  it('values 90 minutes at £60/h as £90 one-off', () => {
    expect(f.meta.rule).toBe('unbilled.new_user')
    expect(f.estimated_value).toBe(90)
    expect(f.monthly_value).toBe(0)
    expect(f.annual_value).toBe(0)
    expect(formatCalculation(f)).toMatchObject({ lines: ['1h 30m non-billable × £60/h = £90'], result: '£90 one-off', basis: 'one_off' })
  })

  it('is LOW confidence and needs investigation', () => {
    expect(confidenceOf(f)).toMatchObject({ level: 'LOW', classification: 'investigate' })
    expect(f.evidence.find((e) => e.source === 'settings')).toMatchObject({ setting_keys: ['billable_rate_per_hour'] })
    expect(f.source_data[0]).toMatchObject({ table: 'tickets', file_name: 'tickets.csv', row: 7 })
  })
})

describe('known answer: missing recurring charge', () => {
  // 20 contracted devices, no per-device billing line: 20 × £8 default = £160 a
  // month as a guide only. LOW: it may be bundled into the package fee.
  const c = client('Gamma Ltd', { contracted_devices: 20 })
  const { findings } = analyse(dataset({ clients: [c], billing_items: [line(c, 'Business Pro service fee', 1, 1000)], time_entries: [window(c)] }))
  const f = byRule(findings, 'recurring.missing_device')

  it('values it at the Settings default and says it is a guide', () => {
    expect(f.category).toBe('RECURRING_CHARGE_MISMATCH')
    expect(f.monthly_value).toBe(160)
    expect(f.annual_value).toBe(1920)
    expect(formatCalculation(f)!.lines).toEqual(['20 contracted devices with no per-device charge found', '20 × £8 = £160 a month, at the default price in Settings', '£160 × 12 = £1,920 a year'])
  })

  it('is LOW confidence, never a confirmed discrepancy', () => {
    expect(confidenceOf(f)).toMatchObject({ level: 'LOW', classification: 'investigate' })
    expect(f.claims!.some((x) => x.type === 'interpretation' && /package or service fee/.test(x.text))).toBe(true)
  })
})

describe('known answer: out of scope, clause in the second of two contracts', () => {
  // Personal MacBook work, 80 non-billable minutes. The exclusion is clause 2.3
  // on page 2 of the second contract, which also states £75 an hour:
  // 80 min × £75/h = £100.
  const c = client('Delta Ltd')
  const msa = contract(c, 'Master Services Agreement', '1. Term\n\n1.1 This agreement runs for 36 months from signature.')
  const schedule = contract(
    c,
    'Schedule 2: Scope of Service',
    '1. Scope\n\n1.1 Remote support is provided for the Client.\f2. Exclusions\n\n2.1 Printers are supported on a best endeavours basis only.\n\n2.3 Support applies to company-owned devices only. Personal devices are excluded.\n\n3. Charges\n\n3.1 The standard hourly rate is £75 per hour.',
  )
  const t = ticket(c, '18492', '2026-09-15T10:20:00', "Set up employee's personal MacBook", 80)
  const { findings } = analyse(dataset({ clients: [c], contracts: [msa, schedule], tickets: [t] }))
  const f = findings.find((x) => x.category === 'OUT_OF_SCOPE')!

  it('cites the second contract, its section and page, not the first', () => {
    expect(f.evidence[0].label).toBe('Agreement · Schedule 2: Scope of Service, section 2.3, page 2')
    expect(f.evidence[0].text).toBe('Support applies to company-owned devices only.')
    const contracts = f.source_data.filter((r) => r.table === 'contracts')
    expect(contracts.every((r) => r.id === schedule.id)).toBe(true)
    expect(contracts[0]).toMatchObject({ section: '2.3', page: 2 })
    expect(f.claims![0]).toEqual({ type: 'fact', text: 'Schedule 2: Scope of Service, section 2.3, page 2 says: "Support applies to company-owned devices only."' })
  })

  it('values the work at the rate the agreement states', () => {
    expect(f.estimated_value).toBe(100)
    expect(f.meta.calc).toMatchObject({ kind: 'time', rate: 75, rate_source: 'contract', match: 'strong' })
    expect(formatCalculation(f)!.lines).toEqual(['1h 20m non-billable × £75/h = £100'])
    expect(f.evidence.find((e) => e.label.startsWith('Hourly rate'))!.label).toBe('Hourly rate · Schedule 2: Scope of Service, section 3.1, page 2')
  })

  it('is HIGH confidence but a potential opportunity: charging it is the MSP’s call', () => {
    expect(confidenceOf(f)).toMatchObject({ level: 'HIGH', classification: 'potential' })
  })
})

describe('known answer: recurring charge below the contracted quantity', () => {
  // Agreement states 40 users; the per-user line bills 35 × £18:
  // 40 − 35 = 5; 5 × £18 = £90 a month; £1,080 a year.
  const c = client('Epsilon Ltd', { contracted_users: 40 })
  const agreement = contract(c, 'Epsilon MSA', '1.2 The monthly charge is based on 40 supported users.')
  const { findings } = analyse(
    dataset({ clients: [c], contracts: [agreement], assets: users(c, 40), billing_items: [line(c, 'Managed User Support (per user)', 35, 18)], time_entries: [window(c)] }),
  )
  const f = byRule(findings, 'mismatch.user')

  it('calculates £90 a month and £1,080 a year', () => {
    expect(f.monthly_value).toBe(90)
    expect(f.annual_value).toBe(1080)
    expect(formatCalculation(f)!.lines).toEqual(['40 contracted − 35 billed = 5 users', '5 × £18 = £90 a month, priced as Managed User Support (per user)', '£90 × 12 = £1,080 a year'])
    expect(findings.some((x) => x.meta.rule === 'drift.user')).toBe(false)
  })

  it('is HIGH confidence and confirmed when the agreement states the quantity', () => {
    expect(confidenceOf(f)).toMatchObject({ level: 'HIGH', classification: 'confirmed' })
    expect(f.evidence.map((e) => e.source)).toEqual(['agreement', 'client_record', 'billing'])
  })
})

describe('known answer: usage over the included allowance', () => {
  // 10 included hours (clients file and agreement). September: 13h non-billable
  // and 2h billable. Billable time is charged separately, so only 13h counts:
  // 13 − 10 = 3h × £60 = £180.
  const c = client('Zeta Ltd', { included_hours: 10 })
  const agreement = contract(c, 'Zeta Support Block', '3.1 The Service includes up to 10 hours of remote support per month.')
  const entries = [entry(c, '2026-09-02T10:00:00', 13 * 60, false), entry(c, '2026-09-03T10:00:00', 120, true)]
  const { findings } = analyse(dataset({ clients: [c], contracts: [agreement], time_entries: entries }))
  const f = byRule(findings, 'usage.over_allowance')

  it('counts only non-billable time: 3h over × £60 = £180', () => {
    expect(f.estimated_value).toBe(180)
    expect(f.meta.calc).toMatchObject({ kind: 'usage', included: 10, included_confirmed: true, non_billable_only: true, rate_source: 'settings' })
    expect(formatCalculation(f)!.lines).toEqual(['September 2026: 13h non-billable used − 10h included = 3h × £60 = £180'])
  })

  it('is MEDIUM: invoices are not in the data, so the overage may have been billed', () => {
    expect(confidenceOf(f)).toMatchObject({ level: 'MEDIUM', classification: 'potential' })
    expect(f.evidence.find((e) => e.source === 'derived')!.refs!.map((r) => r.id)).toEqual([entries[0].id])
  })
})

describe('known answer: client profitability', () => {
  // MRR £1,000, 20h at £35/h labour, £100 software, 30% target:
  // contribution 1,000 − 700 − 100 = £200 (20%); target £300; shortfall £100.
  // Price at target margin: (700 + 100) ÷ 0.7 = £1,142.86, rounded £1,143.
  const c = client('Eta Ltd', { monthly_recurring_revenue: 1000, monthly_software_cost: 100 })
  const { findings } = analyse(dataset({ clients: [c], time_entries: [entry(c, '2026-09-02T10:00:00', 20 * 60, false)] }))
  const f = byRule(findings, 'margin.below_target')

  it('models a £100 shortfall at a 20% margin', () => {
    expect(f.title).toBe('Gross margin 20% against a 30% target')
    expect(f.estimated_value).toBe(100)
    expect(f.monthly_value).toBe(100)
    expect(f.meta.calc).toMatchObject({ kind: 'margin', avg_contribution: 200, target_contribution: 300, target_price: 1143 })
  })

  it('is a LOW-confidence estimate that needs investigation', () => {
    expect(confidenceOf(f)).toMatchObject({ level: 'LOW', classification: 'investigate', estimate: true })
    expect(formatCalculation(f)!.basis).toBe('estimate')
    expect(f.evidence.map((e) => e.source)).toEqual(['client_record', 'derived', 'settings'])
  })
})

describe('known answer: prices with pence are rounded once, after annualising', () => {
  // 3 extra users at £8.50: £25.50 a month, £306 a year (not £26 and £312).
  const c = client('Theta Ltd', { contracted_users: 10 })
  const agreement = contract(c, 'Theta MSA', '1.2 The monthly charge is based on 10 supported users.')
  const { findings } = analyse(dataset({ clients: [c], contracts: [agreement], assets: users(c, 13), billing_items: [line(c, 'Managed support per user', 10, 8.5)], time_entries: [window(c)] }))
  const f = byRule(findings, 'drift.user')

  it('keeps the pence', () => {
    expect(f.monthly_value).toBe(25.5)
    expect(f.annual_value).toBe(306)
    expect(formatCalculation(f)!.lines).toEqual(['13 active users − 10 contracted = 3 users', '3 × £8.50 = £25.50 a month, priced as Managed support per user', '£25.50 × 12 = £306 a year'])
  })
})

describe('known answer: choosing the per-user price line', () => {
  const c = client('Iota Ltd', { contracted_users: 10 })
  const agreement = contract(c, 'Iota MSA', '1.2 The monthly charge is based on 10 supported users.')
  const base = { clients: [c], contracts: [agreement], assets: users(c, 12), time_entries: [window(c)] }

  it('ignores a licence line ahead of the support line', () => {
    const billing = [line(c, 'Microsoft 365 Business Standard (per user)', 12, 10.3), line(c, 'Managed support per user', 10, 82)]
    const f = byRule(analyse(dataset({ ...base, billing_items: billing })).findings, 'drift.user')
    expect(f.meta.calc).toMatchObject({ unit_price: 82, price_ambiguous: false })
    expect(f.monthly_value).toBe(164)
    expect(confidenceOf(f).level).toBe('HIGH')
  })

  it('takes the lowest of two candidate lines and drops to MEDIUM', () => {
    const billing = [line(c, 'Managed support per user (Premium)', 4, 82), line(c, 'Managed support per user (Standard)', 6, 60)]
    const f = byRule(analyse(dataset({ ...base, billing_items: billing })).findings, 'drift.user')
    expect(f.meta.calc).toMatchObject({ unit_price: 60, price_ambiguous: true })
    expect(confidenceOf(f).level).toBe('MEDIUM')
  })
})

describe('known answer: licence matching', () => {
  const c = client('Kappa Ltd')
  const holders = users(c, 5, '2025-06-01', 'Microsoft 365 Business Premium')

  it('matches an identically named billing line and is confirmed', () => {
    const { findings } = analyse(dataset({ clients: [c], assets: holders, billing_items: [line(c, 'Microsoft 365 Business Premium', 4, 18)], time_entries: [window(c)] }))
    const f = byRule(findings, 'license.unbilled')
    expect(f.monthly_value).toBe(18)
    expect(f.annual_value).toBe(216)
    expect(confidenceOf(f)).toMatchObject({ level: 'HIGH', classification: 'confirmed' })
    expect(f.source_data.filter((r) => r.table === 'assets')).toHaveLength(5)
  })

  it('does not match a generic line that could be any of several licences', () => {
    const mixed = [...holders, ...users(c, 3, '2025-06-01', 'Microsoft 365 Business Standard')]
    const { findings } = analyse(dataset({ clients: [c], assets: mixed, billing_items: [line(c, 'Microsoft 365', 2, 18)], time_entries: [window(c)] }))
    expect(findings.filter((f) => f.meta.rule === 'license.unbilled')).toHaveLength(0)
  })
})

describe('every finding is evidence-backed', () => {
  it('has claims of each required type, a classification and refs on its record evidence', async () => {
    const { buildDemoDataset } = await import('../demo/dataset')
    for (const f of analyse(buildDemoDataset('ws')).findings) {
      const types = claimTypes(f)
      expect(types.has('fact'), f.finding_key).toBe(true)
      expect(types.has('observation'), f.finding_key).toBe(true)
      expect(types.has('recommendation'), f.finding_key).toBe(true)
      expect(f.classification, f.finding_key).toBe(confidenceOf(f).classification)
      for (const e of f.evidence) {
        expect(e.source, `${f.finding_key} ${e.label}`).toBeDefined()
        if (e.source !== 'settings') expect(e.refs?.length, `${f.finding_key} ${e.label}`).toBeGreaterThan(0)
      }
      // Clients-file figures are never labelled as the agreement.
      for (const e of f.evidence.filter((x) => x.source === 'client_record')) expect(e.label).not.toMatch(/^Agreement/)
    }
  })
})
