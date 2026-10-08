import { CLASSIFICATION_DEFINITIONS } from '../../../lib/confidence'
import type { Contract, Evidence, EvidenceSource, FindingClass, SourceRef, Upload, WorkspaceSettings } from '../../../engine/types'

// Plain words for what the engine did, kept beside the finding pages so the
// detail page and the "Why was this flagged?" view say the same thing. The
// rule table mirrors docs/methodology.md section 2.

export interface RuleInfo {
  name: string
  // When the rule fires, in one sentence.
  fires: string
  // How the value is worked out.
  value: string
}

const RULES: Record<string, RuleInfo> = {
  out_of_scope: {
    name: 'Out-of-scope work',
    fires:
      "The ticket's wording matches a kind of work (such as personal devices, hardware repair, projects or out-of-hours support), the client's agreement has a clause excluding that work or making it chargeable, and the time was logged as non-billable.",
    value: 'One-off: non-billable time × hourly rate.',
  },
  'unbilled.billing_mismatch': {
    name: 'Billable ticket, non-billable time',
    fires: 'The ticket is marked billable in your PSA, but the time logged against it is marked non-billable.',
    value: 'One-off: non-billable time × hourly rate.',
  },
  unbilled: {
    name: 'Work that is usually chargeable',
    fires: "The ticket's wording matches work MSPs commonly charge for, no agreement clause says it is included, and the time was logged as non-billable.",
    value: 'One-off: non-billable time × hourly rate.',
  },
  mismatch: {
    name: 'Recurring charge mismatch',
    fires: 'The per-unit billing line bills fewer users or devices than the contracted quantity.',
    value: 'Recurring: (contracted − billed) × the billing line price.',
  },
  recurring: {
    name: 'Missing recurring charge',
    fires: 'A contracted quantity exists and the client has billing lines, but none of them is a per-user or per-device charge.',
    value: 'Recurring, as a guide only: contracted quantity × your default price in Settings.',
  },
  drift: {
    name: 'Agreement drift',
    fires: 'More active users or devices than contracted (or than billed, when no contracted figure exists).',
    value: 'Recurring: (active − contracted) × unit price.',
  },
  license: {
    name: 'Licence not billed',
    fires: 'More users are assigned a licence than the matching billing line bills.',
    value: 'Recurring: (assigned − billed) × the billing line price.',
  },
  usage: {
    name: 'Support above the included hours',
    fires: 'Non-billable hours in a month exceed the included hours by more than the tolerance in Settings.',
    value: 'One-off per month: (hours − included hours) × hourly rate.',
  },
  margin: {
    name: 'Margin below target',
    fires: 'The client has no included hours, pays a monthly fee, and its modelled margin is below your target.',
    value: 'Estimate: the monthly shortfall against your target margin.',
  },
}

export function ruleInfo(rule: string): RuleInfo | null {
  return RULES[rule] ?? RULES[rule.split('.')[0]] ?? null
}

export const CLASS_LABEL: Record<FindingClass, string> = {
  confirmed: 'Confirmed discrepancy',
  potential: 'Potential opportunity',
  investigate: 'Investigation required',
}

// The definition without its "Label:" lead, as a sentence.
export function classDefinition(c: FindingClass): string {
  const t = CLASSIFICATION_DEFINITIONS[c].replace(/^[^:]+:\s*/, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// ---------------------------------------------------------------- evidence sources

export const SOURCE_ORDER: EvidenceSource[] = ['agreement', 'client_record', 'psa', 'asset_register', 'billing', 'settings', 'derived']

export const SOURCE_META: Record<EvidenceSource, { label: string; blurb: string }> = {
  agreement: { label: 'Agreement', blurb: 'Clauses in the contracts you uploaded' },
  client_record: { label: 'Client record', blurb: 'Your clients file, not the signed agreement' },
  psa: { label: 'PSA', blurb: 'Tickets and time entries from your PSA export' },
  asset_register: { label: 'Asset register', blurb: 'Your users and devices export' },
  billing: { label: 'Billing', blurb: 'Recurring lines from your billing export' },
  settings: { label: 'Settings', blurb: 'Values you set in Settings, used where the records give none' },
  derived: { label: 'Derived', blurb: 'Totals worked out from the records above' },
}

// Evidence saved before sources existed: infer the system from the record kind.
export function sourceOf(e: Evidence): EvidenceSource {
  if (e.source) return e.source
  switch (e.kind) {
    case 'contract':
      return 'agreement'
    case 'ticket':
    case 'time_entry':
      return 'psa'
    case 'billing':
      return 'billing'
    case 'asset':
      return 'asset_register'
    case 'client':
      return 'client_record'
    default:
      return /^settings/i.test(e.label) ? 'settings' : 'derived'
  }
}

export function groupEvidence(evidence: Evidence[]): { source: EvidenceSource; items: { e: Evidence; i: number }[] }[] {
  const by = new Map<EvidenceSource, { e: Evidence; i: number }[]>()
  evidence.forEach((e, i) => {
    const s = sourceOf(e)
    by.set(s, [...(by.get(s) ?? []), { e, i }])
  })
  return SOURCE_ORDER.filter((s) => by.has(s)).map((s) => ({ source: s, items: by.get(s)! }))
}

export const SETTING_LABEL: Partial<Record<keyof WorkspaceSettings, string>> = {
  labour_cost_per_hour: 'Labour cost per hour',
  billable_rate_per_hour: 'Billable rate per hour',
  after_hours_multiplier: 'Out-of-hours multiplier',
  default_user_price: 'Default price per user',
  default_device_price: 'Default price per device',
  default_software_cost_per_user: 'Default software cost per user',
  target_margin: 'Target margin',
  excessive_usage_threshold: 'Usage tolerance',
  business_hours_start: 'Business hours start',
  business_hours_end: 'Business hours end',
}

// ---------------------------------------------------------------- references

export const TABLE_NOUN: Record<SourceRef['table'], [string, string]> = {
  tickets: ['ticket', 'tickets'],
  time_entries: ['time entry', 'time entries'],
  contracts: ['contract clause', 'contract clauses'],
  billing_items: ['billing line', 'billing lines'],
  assets: ['user or device', 'users and devices'],
  clients: ['client record', 'client records'],
}

// "2–40, 45, 47–48": sorted rows folded into ranges.
export function rowRanges(rows: number[]): string {
  const xs = [...new Set(rows)].sort((a, b) => a - b)
  const out: string[] = []
  for (let i = 0; i < xs.length; i++) {
    let j = i
    while (j + 1 < xs.length && xs[j + 1] === xs[j] + 1) j++
    out.push(j > i ? `${xs[i]}–${xs[j]}` : `${xs[i]}`)
    i = j
  }
  return out.join(', ')
}

// Where one record sits in the customer's own files: "clients.csv, row 5", or
// "section 3.1, page 2" for a contract clause.
export function refLocation(r: SourceRef): string | null {
  if (r.table === 'contracts') {
    const parts = [r.section ? `section ${r.section}` : null, r.page ? `page ${r.page}` : null, r.file_name ?? null].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  }
  if (r.file_name && r.row) return `${r.file_name}, row ${r.row}`
  if (r.file_name) return r.file_name
  return null
}

// The page in the app that shows a record, where one exists.
export function refRoute(r: SourceRef, contracts: Pick<Contract, 'id' | 'client_id'>[]): string | null {
  if (r.table === 'clients') return `/app/clients/${r.id}`
  if (r.table === 'contracts') {
    const c = contracts.find((x) => x.id === r.id)
    return c ? `/app/clients/${c.client_id}#contract` : null
  }
  return null
}

export interface FileSummary {
  key: string
  file_name: string
  upload: Upload | null
  rows: number[]
  count: number
  tables: Set<SourceRef['table']>
}

// The files a finding's records came from, with the rows used in each.
export function filesOf(refs: SourceRef[], uploads: Upload[]): FileSummary[] {
  const by = new Map<string, FileSummary>()
  const seen = new Set<string>()
  for (const r of refs) {
    if (r.table === 'contracts' || !r.file_name) continue
    const id = `${r.table}:${r.id}`
    if (seen.has(id)) continue
    seen.add(id)
    const key = r.upload_id ?? r.file_name
    const s = by.get(key) ?? { key, file_name: r.file_name, upload: uploads.find((u) => u.id === r.upload_id) ?? null, rows: [], count: 0, tables: new Set() }
    s.count++
    s.tables.add(r.table)
    if (r.row) s.rows.push(r.row)
    by.set(key, s)
  }
  return [...by.values()]
}

// Every record a finding cites: its source records plus each evidence line's refs.
export function allRefs(f: { source_data: SourceRef[]; evidence: Evidence[] }): SourceRef[] {
  return [...f.source_data, ...f.evidence.flatMap((e) => e.refs ?? [])]
}
