import { classifyText, isOutsideHours, CATEGORY_NOUNS, OUT_OF_SCOPE_TITLES, type Classification, type WorkCategory } from './classify'
import { clauseCitation, extractClauses, statedValue, type Clause, type ClauseType } from './contractTerms'
import { confidenceOf, SCORE_FOR_LEVEL } from './confidence'
import { liveClientHealth } from './health'
import { fmtMinutes, monthLabel, periodLabel, signed } from './format'
import { pence, sumPence } from './money'

export { fmtMinutes, monthLabel, periodLabel }
import type {
  AnalysisSummary,
  Asset,
  BillingItem,
  Category,
  Claim,
  Client,
  ClientMetrics,
  ConfidenceLevel,
  Contract,
  Dataset,
  Evidence,
  EvidenceSource,
  FindingDraft,
  Provenance,
  Severity,
  SourceRef,
  Ticket,
  TimeEntry,
  WorkspaceSettings,
} from './types'

// Every rule below is deterministic: the same records and Settings always give
// the same findings and figures. Each finding carries
// - evidence lines grouped by source system, each pointing at the records
//   (with file and row, or contract section and page) it was read from;
// - claims kept apart by type: fact, observation, interpretation, recommendation;
// - its calculation inputs (meta.calc), from which src/lib/calculation.ts
//   rebuilds every figure and src/engine/confidence.ts derives the level.
// docs/methodology.md documents the rules.

// ---------------------------------------------------------------- helpers

const round = (n: number) => Math.round(n)
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const monthOf = (iso: string) => iso.slice(0, 7)
const gbp = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`
const dayLabel = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
const poss = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 0))
  return d.toISOString().slice(0, 10)
}

function monthsBetween(first: string, last: string): string[] {
  const out: string[] = []
  let [y, m] = first.split('-').map(Number)
  const [ly, lm] = last.split('-').map(Number)
  while (y < ly || (y === ly && m <= lm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

// Does a contract sentence state this time of day? Accepts 08:30, 8:30 and 8.30.
function statesTime(sentence: string, hhmm: string): boolean {
  const [h, m] = hhmm.split(':')
  if (!h || !m) return false
  return new RegExp(`(?<!\\d)0?${Number(h)}[:.]${m}(?!\\d)`).test(sentence)
}

// A priority hint from value and confidence. Only HIGH-confidence findings can
// reach the top band, so an uncertain finding is never labelled critical.
function severityFor(value: number, level: ConfidenceLevel, category: Category): Severity {
  const levels: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  let i = value >= 600 ? 3 : value >= 200 ? 2 : value >= 60 ? 1 : 0
  const clearCut = ['OUT_OF_SCOPE', 'AGREEMENT_DRIFT', 'RECURRING_CHARGE_MISMATCH', 'MISSING_LICENSE'].includes(category)
  if (clearCut && level === 'HIGH' && i < 2) i++
  if (level === 'LOW' && i > 0) i--
  if (level !== 'HIGH' && i > 2) i = 2
  return levels[i]
}

// ----- provenance and evidence builders

const prov = (s?: Provenance | null): Partial<SourceRef> => (s ? { upload_id: s.upload_id, file_name: s.file_name, row: s.row } : {})
const ref = {
  ticket: (t: Ticket): SourceRef => ({ table: 'tickets', id: t.id, label: `Ticket #${t.external_id}`, ...prov(t.source) }),
  entry: (e: TimeEntry): SourceRef => ({ table: 'time_entries', id: e.id, label: `Time entry ${e.date.slice(0, 10)}${e.technician ? ` · ${e.technician}` : ''}`, ...prov(e.source) }),
  asset: (a: Asset): SourceRef => ({ table: 'assets', id: a.id, label: a.name, ...prov(a.source) }),
  billing: (b: BillingItem): SourceRef => ({ table: 'billing_items', id: b.id, label: b.service, ...prov(b.source) }),
  client: (c: Client): SourceRef => ({ table: 'clients', id: c.id, label: c.name, ...prov(c.source) }),
  clause: (cl: Clause, contract: Contract | undefined): SourceRef => ({
    table: 'contracts',
    id: cl.contract_id ?? contract?.id ?? '',
    label: clauseCitation(cl),
    upload_id: contract?.upload_id ?? null,
    file_name: null,
    section: cl.section,
    page: cl.page,
  }),
}

function dedupeRefs(refs: SourceRef[]): SourceRef[] {
  const seen = new Map<string, SourceRef>()
  for (const r of refs) {
    const k = `${r.table}:${r.id}:${r.section ?? ''}:${r.page ?? ''}`
    if (!seen.has(k)) seen.set(k, r)
  }
  return [...seen.values()]
}

const ev = (source: EvidenceSource, kind: Evidence['kind'], label: string, text: string, refs: SourceRef[], extra: Partial<Evidence> = {}): Evidence => ({ kind, source, label, text, refs, ...extra })
const settingsEv = (label: string, text: string, keys: (keyof WorkspaceSettings)[]): Evidence => ({ kind: 'metric', source: 'settings', label: `Settings · ${label}`, text, refs: [], setting_keys: keys })

function claimsOf(parts: { facts: string[]; observations: string[]; interpretations?: string[]; recommendation: string }): Claim[] {
  return [
    ...parts.facts.map((text): Claim => ({ type: 'fact', text })),
    ...parts.observations.map((text): Claim => ({ type: 'observation', text })),
    ...(parts.interpretations ?? []).map((text): Claim => ({ type: 'interpretation', text })),
    { type: 'recommendation', text: parts.recommendation },
  ]
}

// Which contract clause makes a category of work out of scope.
const EXCLUDING_CLAUSE: Partial<Record<WorkCategory, ClauseType>> = {
  personal_device: 'company_devices_only',
  hardware_repair: 'excludes_hardware',
  project_work: 'excludes_projects',
  onsite: 'onsite_chargeable',
  after_hours: 'business_hours',
  third_party_app: 'third_party_excluded',
  new_user: 'new_user_chargeable',
  new_device: 'new_device_chargeable',
}

// Phrases that, when a contract says they're included, suppress a
// "potentially billable" finding for that category.
const INCLUSION_WORDS: Partial<Record<WorkCategory, RegExp>> = {
  new_user: /(new (user|starter)s?|onboarding|joiners?)[^.]{0,60}(are |is )?(included|covered)/i,
  new_device: /(new (device|laptop)s?|device (setup|builds?))[^.]{0,60}(are |is )?(included|covered)/i,
  onsite: /(on[- ]?site|site visits?)[^.]{0,60}(are |is )?(included|covered|unlimited)/i,
  project_work: /(projects?)[^.]{0,60}(are |is )?(included|covered)/i,
  third_party_app: /(third[- ]party|line[- ]of[- ]business)[^.]{0,80}(are |is )?(included|covered|supported)/i,
  hardware_repair: /(hardware)[^.]{0,60}(are |is )?(included|covered)/i,
  after_hours: /(24\/7|24x7|out of hours)[^.]{0,60}(included|covered)/i,
}

const BILLABLE_TYPE: WorkCategory[] = [
  'project_work',
  'new_device',
  'onsite',
  'hardware_repair',
  'new_user',
  'personal_device',
  'third_party_app',
  'after_hours',
  'unsupported_software',
]

// A ticket classification at or above this is a strong wording match (one or
// more of the category's strong phrases), below it a looser one.
const STRONG_MATCH = 86

interface WorkItem {
  ticket: Ticket
  entries: TimeEntry[]
  minutes: number
  nonBillableMinutes: number
  billableMinutes: number
  workDate: string
  afterHours: boolean
}

function buildWorkItems(tickets: Ticket[], entries: TimeEntry[], start: string, end: string): WorkItem[] {
  const byTicket = new Map<string, TimeEntry[]>()
  for (const e of entries) {
    if (!e.ticket_external_id) continue
    const k = `${e.client_id}|${e.ticket_external_id}`
    if (!byTicket.has(k)) byTicket.set(k, [])
    byTicket.get(k)!.push(e)
  }
  const items: WorkItem[] = []
  for (const t of tickets) {
    const es = byTicket.get(`${t.client_id}|${t.external_id}`) ?? []
    let minutes: number, nonBill: number
    if (es.length) {
      minutes = es.reduce((s, e) => s + e.minutes, 0)
      nonBill = es.filter((e) => !e.billable).reduce((s, e) => s + e.minutes, 0)
    } else {
      minutes = t.time_spent_minutes
      nonBill = t.billable ? 0 : t.time_spent_minutes
    }
    const workDate = es[0]?.date ?? t.date
    if (monthOf(workDate) < start || monthOf(workDate) > end) continue
    items.push({
      ticket: t,
      entries: es,
      minutes,
      nonBillableMinutes: nonBill,
      billableMinutes: minutes - nonBill,
      workDate,
      afterHours: false,
    })
  }
  return items
}

// Per client: every contract's clauses (each clause knows its contract,
// section and page), and the text of all of them for inclusion checks.
interface ClientContracts {
  clauses: Clause[]
  text: string
  contracts: Contract[]
}

// The hourly rate for a client's work: stated in its agreement when the
// agreement states exactly one, otherwise Settings.
interface RateBasis {
  base: number
  multiplier: number
  baseClause: Clause | null
  multiplierClause: Clause | null
}
function rateBasis(cc: ClientContracts | undefined, s: WorkspaceSettings): RateBasis {
  const r = cc ? statedValue(cc.clauses, 'hourly_rate') : null
  const m = cc ? statedValue(cc.clauses, 'out_of_hours_multiplier') : null
  return { base: r?.value ?? s.billable_rate_per_hour, multiplier: m?.value ?? s.after_hours_multiplier, baseClause: r?.clause ?? null, multiplierClause: m?.clause ?? null }
}

// --------------------------------------------------------------- analysis

export interface AnalysisOutput {
  summary: AnalysisSummary
  findings: FindingDraft[]
}

type Draft = Omit<FindingDraft, 'severity' | 'confidence' | 'classification' | 'source_data'>

// Severity, confidence score and classification all derive from the
// confidence model; source_data is every record the evidence points at.
function finalise(d: Draft): FindingDraft {
  const r = confidenceOf({ confidence: 0, meta: d.meta })
  return {
    ...d,
    severity: severityFor(d.estimated_value, r.level, d.category),
    confidence: SCORE_FOR_LEVEL[r.level],
    classification: r.classification,
    source_data: dedupeRefs(d.evidence.flatMap((e) => e.refs ?? [])),
  }
}

export function analyse(input: Dataset): AnalysisOutput {
  // Guard against the same ticket arriving twice (a re-import before natural
  // keys, or two rows in one file): keep the last row per client and ticket number.
  const lastTicket = new Map(input.tickets.map((t) => [`${t.client_id}|${t.external_id}`, t]))
  const ds: Dataset = lastTicket.size === input.tickets.length ? input : { ...input, tickets: [...lastTicket.values()] }
  const s = ds.settings
  const dated = [...ds.tickets.map((t) => t.date), ...ds.time_entries.map((e) => e.date)].filter(Boolean).sort()
  const firstMonth = dated.length ? monthOf(dated[0]) : monthOf(new Date().toISOString())
  const lastMonth = dated.length ? monthOf(dated[dated.length - 1]) : firstMonth
  const months = monthsBetween(firstMonth, lastMonth)
  const periodEnd = monthEnd(lastMonth)
  const drafts: Draft[] = []
  const clientById = new Map(ds.clients.map((c) => [c.id, c]))
  const contractById = new Map(ds.contracts.map((c) => [c.id, c]))

  // ----- contract clauses per client, each tagged with its own contract
  const contractsByClient = new Map<string, ClientContracts>()
  for (const c of ds.contracts) {
    const cur = contractsByClient.get(c.client_id) ?? { clauses: [], text: '', contracts: [] }
    cur.clauses.push(...extractClauses(c.text, { id: c.id, title: c.title }))
    cur.text += '\n' + c.text
    cur.contracts.push(c)
    contractsByClient.set(c.client_id, cur)
  }
  const clauseEv = (label: string, cl: Clause): Evidence =>
    ev('agreement', 'contract', `${label} · ${clauseCitation(cl)}`, cl.sentence, [ref.clause(cl, contractById.get(cl.contract_id ?? ''))], { highlights: [cl.highlight] })

  // ----- hours per client per month (time entries first, ticket time where no
  // entries), with the records behind them. All hours feed the margin model;
  // only non-billable hours count against an included-hours allowance, since
  // billable time is charged separately.
  const hours = new Map<string, Record<string, number>>()
  const nbHours = new Map<string, Record<string, number>>()
  const workRefs = new Map<string, Record<string, SourceRef[]>>()
  const nbRefs = new Map<string, Record<string, SourceRef[]>>()
  const addTo = <T,>(m: Map<string, Record<string, T>>, clientId: string) => {
    if (!m.has(clientId)) m.set(clientId, {})
    return m.get(clientId)!
  }
  const addHours = (clientId: string, month: string, mins: number, billable: boolean, r: SourceRef) => {
    const h = addTo(hours, clientId)
    h[month] = (h[month] ?? 0) + mins / 60
    ;(addTo(workRefs, clientId)[month] ??= []).push(r)
    if (billable) return
    const nb = addTo(nbHours, clientId)
    nb[month] = (nb[month] ?? 0) + mins / 60
    ;(addTo(nbRefs, clientId)[month] ??= []).push(r)
  }
  const ticketsWithEntries = new Set(ds.time_entries.filter((e) => e.ticket_external_id).map((e) => `${e.client_id}|${e.ticket_external_id}`))
  for (const e of ds.time_entries) addHours(e.client_id, monthOf(e.date), e.minutes, e.billable, ref.entry(e))
  for (const t of ds.tickets) if (!ticketsWithEntries.has(`${t.client_id}|${t.external_id}`)) addHours(t.client_id, monthOf(t.date), t.time_spent_minutes, t.billable, ref.ticket(t))

  // ----- ticket-level rules: out of scope + unbilled
  const items = buildWorkItems(ds.tickets, ds.time_entries, firstMonth, lastMonth)
  for (const item of items) {
    const t = item.ticket
    const client = clientById.get(t.client_id)
    if (!client || item.minutes <= 0) continue
    const text = `${t.subject}. ${t.description ?? ''}`
    const cls: Classification[] = classifyText(text)
    const workTimes = item.entries.length ? item.entries.map((e) => e.date) : [t.date]
    const outside = workTimes.some((d) => isOutsideHours(d, s.business_hours_start, s.business_hours_end))
    if (outside && !cls.some((c) => c.category === 'after_hours')) {
      cls.push({ category: 'after_hours', confidence: 90, matches: [] })
    }
    item.afterHours = cls.some((c) => c.category === 'after_hours')
    const contract = contractsByClient.get(t.client_id)
    const ticketRef = ref.ticket(t)
    const ticketEvidence = ev('psa', 'ticket', `Ticket #${t.external_id} · ${t.subject}`, [t.subject, t.description].filter(Boolean).join('\n\n'), [ticketRef], {
      highlights: cls.flatMap((c) => c.matches),
    })
    const timeEvidence = ev(
      'psa',
      'time_entry',
      'Time logged',
      item.entries.length
        ? item.entries.map((e) => `${e.date.replace('T', ' ').slice(0, 16)} · ${e.technician ?? 'Unknown'} · ${fmtMinutes(e.minutes)} · ${e.billable ? 'billable' : 'non-billable'}`).join('\n')
        : `${t.date.replace('T', ' ').slice(0, 16)} · ${t.technician ?? 'Unknown'} · ${fmtMinutes(t.time_spent_minutes)} · ${t.billable ? 'billable' : 'non-billable'}`,
      item.entries.length ? item.entries.map(ref.entry) : [ticketRef],
    )
    if (item.nonBillableMinutes <= 0) continue
    const rb = rateBasis(contract, s)
    const multiplier = item.afterHours ? rb.multiplier : 1
    const rate = rb.base * multiplier
    const rateFromAgreement = !!rb.baseClause && (!item.afterHours || !!rb.multiplierClause)
    const value = round((item.nonBillableMinutes / 60) * rate)
    if (value < 10) continue
    const month = monthOf(item.workDate)
    // After-hours work is judged against a support window: the contract's,
    // when its clause states the same hours as Settings, otherwise Settings alone.
    const hoursClause = contract?.clauses.find((cl) => cl.type === 'business_hours' && statesTime(cl.sentence, s.business_hours_start) && statesTime(cl.sentence, s.business_hours_end)) ?? null
    const rateEvidence: Evidence[] = rateFromAgreement
      ? [clauseEv('Hourly rate', rb.baseClause!), ...(item.afterHours && rb.multiplierClause && rb.multiplierClause.sentence !== rb.baseClause!.sentence ? [clauseEv('Out-of-hours rate', rb.multiplierClause)] : [])]
      : [
          settingsEv(
            'Hourly rate',
            item.afterHours ? `Billable rate ${gbp(rb.base)}/h × ${multiplier} out of hours = ${gbp(rate)}/h` : `Billable rate ${gbp(rate)}/h`,
            item.afterHours ? ['billable_rate_per_hour', 'after_hours_multiplier'] : ['billable_rate_per_hour'],
          ),
        ]
    const hoursEvidence: Evidence[] = item.afterHours
      ? hoursClause
        ? [clauseEv('Support hours', hoursClause)]
        : [settingsEv('Support hours', `Business hours ${s.business_hours_start} to ${s.business_hours_end}, Monday to Friday`, ['business_hours_start', 'business_hours_end'])]
      : []
    const baseCalc = {
      kind: 'time' as const,
      minutes: item.nonBillableMinutes,
      rate,
      base_rate: rb.base,
      multiplier,
      after_hours: item.afterHours,
      hours_source: item.afterHours ? (hoursClause ? ('contract' as const) : ('settings' as const)) : null,
      contract_checked: !!contract,
      rate_source: rateFromAgreement ? ('contract' as const) : ('settings' as const),
    }
    const meta = {
      ticket_ref: t.external_id,
      technician: item.entries[0]?.technician ?? t.technician,
      minutes: item.nonBillableMinutes,
      work_date: item.workDate,
      period_values: { [month]: value },
    }
    const timeFact = `Ticket #${t.external_id} ("${t.subject}") has ${fmtMinutes(item.nonBillableMinutes)} logged as non-billable${item.entries.length ? ` across ${item.entries.length} time ${item.entries.length === 1 ? 'entry' : 'entries'}` : ''}, on ${dayLabel(item.workDate)}.`
    const calcObs = `${fmtMinutes(item.nonBillableMinutes)} × ${gbp(rate)}/h = ${gbp(value)} (one-off).`
    const outsideObs = item.afterHours && outside ? [`The work was logged outside ${hoursClause ? 'the support hours stated in the agreement' : 'the business hours in your Settings'} (${s.business_hours_start} to ${s.business_hours_end}).`] : []

    // Out of scope: an explicit contract exclusion matches the work.
    let best: { c: Classification; clause: Clause; conf: number } | null = null
    for (const c of cls) {
      const type = EXCLUDING_CLAUSE[c.category]
      if (!type || !contract) continue
      const clause = contract.clauses.find((cl) => cl.type === type)
      if (!clause) continue
      // After-hours only counts when the work really was outside hours.
      if (c.category === 'after_hours' && !outside) continue
      const conf = Math.min(97, round(c.confidence * 0.7 + 30))
      if (!best || conf > best.conf) best = { c, clause, conf }
    }
    if (best && best.conf >= 60) {
      const noun = CATEGORY_NOUNS[best.c.category]
      const citation = clauseCitation(best.clause)
      const action = `Review whether this ${noun.replace(/^an? /, '')} should be treated as out of scope and charged at ${rateFromAgreement ? 'the agreement rate' : `your ${item.afterHours ? 'out-of-hours' : 'standard'} rate`} (${gbp(rate)}/h). If it's a recurring request, agree how it will be billed with ${client.name}.`
      const words = best.c.matches.length ? ` (for example "${best.c.matches.slice(0, 2).join('", "')}")` : ''
      drafts.push({
        finding_key: `OUT_OF_SCOPE:${t.client_id}:${t.external_id}`,
        client_id: t.client_id,
        category: 'OUT_OF_SCOPE',
        title: OUT_OF_SCOPE_TITLES[best.c.category],
        description: `Ticket #${t.external_id} ("${t.subject}") reads as ${noun}. ${citation} excludes or charges separately for this kind of work. ${fmtMinutes(item.nonBillableMinutes)} was logged as non-billable${item.afterHours ? ' outside contracted hours' : ''}.`,
        evidence: [clauseEv('Agreement', best.clause), ticketEvidence, timeEvidence, ...hoursEvidence, ...rateEvidence],
        estimated_value: value,
        monthly_value: 0,
        annual_value: 0,
        recommended_action: action,
        claims: claimsOf({
          facts: [`${citation} says: "${best.clause.sentence}"`, timeFact],
          observations: [...outsideObs, calcObs],
          interpretations: [`The ticket's wording${words} suggests ${noun}, which that clause excludes or makes chargeable. This is a keyword match, so read the ticket before charging.`],
          recommendation: action,
        }),
        meta: { ...meta, rule: `out_of_scope.${best.c.category}`, calc: { ...baseCalc, match: best.conf >= 90 ? 'strong' : 'loose' } },
      })
      continue
    }

    // Unbilled: billing mismatch, or typically-billable work logged as non-billable.
    const mismatch = t.billable && item.entries.some((e) => !e.billable)
    const billableCls = cls
      .filter((c) => BILLABLE_TYPE.includes(c.category) && c.confidence >= 60)
      .filter((c) => !(contract && INCLUSION_WORDS[c.category]?.test(contract.text)))
      .filter((c) => c.category !== 'after_hours' || outside)
      .sort((a, b) => b.confidence - a.confidence)[0]
    if (!mismatch && !billableCls) continue
    const noun = billableCls ? CATEGORY_NOUNS[billableCls.category] : ''
    const why = mismatch
      ? `The ticket is marked billable but ${fmtMinutes(item.nonBillableMinutes)} of time against it was logged as non-billable.`
      : `This reads like ${noun}, which MSPs commonly charge for, but all ${fmtMinutes(item.nonBillableMinutes)} was logged as non-billable. ${contract ? "The agreement doesn't say this work is included." : 'No contract has been uploaded for this client, so coverage could not be checked.'}`
    const action = mismatch
      ? 'Check whether the non-billable time was a deliberate write-off. If not, correct the time entries to billable and include them on the next invoice.'
      : `Check with the technician whether this work was agreed as included. If not, consider billing it at ${gbp(rate)}/h and tagging similar tickets as billable going forward.`
    drafts.push({
      finding_key: `UNBILLED_TIME:${t.client_id}:${t.external_id}`,
      client_id: t.client_id,
      category: 'UNBILLED_TIME',
      title: mismatch ? 'Billable ticket with non-billable time' : `Potentially billable ${noun.replace(/^an? /, '').replace(/^support for (?:an? )?(.*)$/, '$1 support')} logged as non-billable`,
      description: `Ticket #${t.external_id} ("${t.subject}"). ${why}`,
      evidence: [ticketEvidence, timeEvidence, ...hoursEvidence, ...rateEvidence],
      estimated_value: value,
      monthly_value: 0,
      annual_value: 0,
      recommended_action: action,
      claims: claimsOf({
        facts: mismatch ? [`Ticket #${t.external_id} is marked billable in your PSA.`, timeFact] : [timeFact, contract ? `${poss(client.name)} agreement was checked and no clause says this work is included or chargeable.` : `No agreement has been uploaded for ${client.name}.`],
        observations: [...outsideObs, calcObs],
        interpretations: mismatch
          ? ['Your PSA records disagree about whether this work is billable. It may be a deliberate write-off.']
          : [`The ticket's wording suggests ${noun}, which is often chargeable. Whether it was agreed as included, or done as goodwill, isn't in the data.`],
        recommendation: action,
      }),
      meta: {
        ...meta,
        rule: mismatch ? 'unbilled.billing_mismatch' : `unbilled.${billableCls!.category}`,
        calc: { ...baseCalc, match: mismatch || billableCls!.confidence >= STRONG_MATCH ? 'strong' : 'loose' },
      },
    })
  }

  // ----- client-level rules
  const assetsByClient = groupBy(ds.assets, (a) => a.client_id)
  const billingByClient = groupBy(ds.billing_items, (b) => b.client_id)

  for (const client of ds.clients) {
    const cc = contractsByClient.get(client.id)
    const clauses = cc?.clauses ?? []
    // Active assets present by the end of the period analysed.
    const assets = (assetsByClient.get(client.id) ?? []).filter((a) => a.status === 'active' && (!a.first_seen || a.first_seen <= periodEnd))
    const billing = billingByClient.get(client.id) ?? []
    const users = assets.filter((a) => a.asset_type === 'user')
    const devices = assets.filter((a) => a.asset_type === 'device')
    const licenceNames = new Set(users.filter((u) => u.license).map((u) => norm(u.license!)))
    const clientRecordEv = (text: string) => ev('client_record', 'client', 'Client record · clients file', text, [ref.client(client)])

    // The per-unit charge: lines named per user/seat (or per device), never a
    // licence line. If more than one remains, prefer support/managed lines; if
    // that still leaves several, take the lowest price and mark it ambiguous.
    const perUnitLine = (kind: 'user' | 'device') => {
      const re = kind === 'user' ? /\b(user|seat|per user)\b/i : /\b(device|endpoint|workstation|per device)\b/i
      let cands = billing.filter((b) => re.test(b.service) && !licenceNames.has(norm(b.service)))
      if (cands.length > 1) {
        const pref = cands.filter((b) => /support|managed|monitor/i.test(b.service))
        if (pref.length) cands = pref
      }
      if (!cands.length) return null
      const line = cands.reduce((a, b) => (b.unit_price < a.unit_price ? b : a))
      return { line, ambiguous: cands.length > 1, candidates: cands }
    }

    for (const kind of ['user', 'device'] as const) {
      const list = kind === 'user' ? users : devices
      const record = kind === 'user' ? client.contracted_users : client.contracted_devices
      const stated = statedValue(clauses, kind === 'user' ? 'contracted_users' : 'contracted_devices')
      // The agreement's figure wins over the clients file; a disagreement is recorded.
      const contracted = stated?.value ?? record
      const contractedSource: 'contract' | 'client_record' | null = stated ? 'contract' : record != null ? 'client_record' : null
      const conflict = stated && record != null && record !== stated.value ? record : null
      const unit = perUnitLine(kind)
      const line = unit?.line ?? null
      const price = line?.unit_price ?? (kind === 'user' ? s.default_user_price : s.default_device_price)
      const contractedEvidence: Evidence[] =
        contractedSource === 'contract'
          ? [clauseEv('Agreement', stated!.clause), ...(record != null ? [clientRecordEv(`Contracted ${kind}s: ${record}${conflict != null ? ` (the agreement states ${stated!.value})` : ''}`)] : [])]
          : contractedSource === 'client_record'
            ? [clientRecordEv(`Contracted ${kind}s: ${record}${client.package ? ` (${client.package})` : ''}. No uploaded agreement states this figure.`)]
            : []
      const contractedFact =
        contractedSource === 'contract'
          ? `${clauseCitation(stated!.clause)} states ${contracted} ${kind}s.`
          : contractedSource === 'client_record'
            ? `Your clients file records ${contracted} contracted ${kind}s for ${client.name}.`
            : null
      const lineEvidence = (l: BillingItem) => ev('billing', 'billing', 'Billing line', `${l.service}: ${l.quantity} × ${gbp(l.unit_price)} = ${gbp(l.monthly_value)}/month`, [ref.billing(l)])

      // A contracted service with no per-unit charge at all.
      if (!line && contracted != null && contracted > 0 && billing.length > 0) {
        const monthlyExact = contracted * price
        const monthly = pence(monthlyExact)
        const pv = Object.fromEntries(months.map((m) => [m, monthly]))
        const action = `Check how ${client.name} is charged for ${kind}s. If the ${contracted} contracted ${kind}s aren't covered by another line, such as a package fee, add a per-${kind} recurring charge.`
        drafts.push({
          finding_key: `RECURRING_CHARGE_MISMATCH:${client.id}:${kind}:missing`,
          client_id: client.id,
          category: 'RECURRING_CHARGE_MISMATCH',
          title: `No per-${kind} charge found for ${contracted} contracted ${kind}s`,
          description: `${client.name} is contracted for ${contracted} ${kind}s, but none of its ${plural(billing.length, 'billing line')} is a per-${kind} charge. It may be bundled into another line. Valued at your default price of ${gbp(price)} per ${kind} only as a guide.`,
          evidence: [
            ...contractedEvidence,
            ev('billing', 'billing', 'Billing lines', billing.map((b) => `${b.service}: ${b.quantity} × ${gbp(b.unit_price)}`).join('\n'), billing.map(ref.billing)),
            settingsEv('Default price', `${gbp(price)} per ${kind}`, [kind === 'user' ? 'default_user_price' : 'default_device_price']),
          ],
          estimated_value: sumPence(Object.values(pv)),
          monthly_value: monthly,
          annual_value: pence(monthlyExact * 12),
          recommended_action: action,
          claims: claimsOf({
            facts: [contractedFact!, `${poss(client.name)} billing has ${plural(billing.length, 'line')}, none named per ${kind}.`],
            observations: [`At your Settings default of ${gbp(price)} per ${kind}, ${contracted} × ${gbp(price)} = ${gbp(monthly)} a month.`],
            interpretations: [`The ${kind}s may be charged inside a package or service fee, in which case nothing is missing.`],
            recommendation: action,
          }),
          meta: { rule: `recurring.missing_${kind}`, period_values: pv, calc: { kind: 'missing', unit: kind, contracted, contracted_source: contractedSource!, unit_price: price, price_source: 'default' } },
        })
      }
      if (!list.length) continue

      // Billing quantity below contracted quantity
      if (line && contracted != null && line.quantity < contracted) {
        const gap = contracted - line.quantity
        const monthlyExact = gap * price
        const monthly = pence(monthlyExact)
        const pv = Object.fromEntries(months.map((m) => [m, monthly]))
        const action = `Check the agreement, then update the "${line.service}" recurring charge to ${contracted} to match it.`
        drafts.push({
          finding_key: `RECURRING_CHARGE_MISMATCH:${client.id}:${kind}`,
          client_id: client.id,
          category: 'RECURRING_CHARGE_MISMATCH',
          title: `Billing for ${plural(gap, kind)} below contracted quantity`,
          description: `${contractedSource === 'contract' ? `${poss(client.name)} agreement` : `Your clients file for ${client.name}`} covers ${contracted} ${kind}s but the recurring charge "${line.service}" bills ${line.quantity}.`,
          evidence: [...contractedEvidence, ...(unit!.ambiguous ? unit!.candidates.map(lineEvidence) : [lineEvidence(line)])],
          estimated_value: sumPence(Object.values(pv)),
          monthly_value: monthly,
          annual_value: pence(monthlyExact * 12),
          recommended_action: action,
          claims: claimsOf({
            facts: [contractedFact!, `The recurring charge "${line.service}" bills ${line.quantity} × ${gbp(line.unit_price)}.`],
            observations: [`${contracted} − ${line.quantity} = ${plural(gap, kind)} contracted but not billed. ${gap} × ${gbp(price)} = ${gbp(monthly)} a month (${gbp(pence(monthlyExact * 12))} a year).`],
            interpretations: unit!.ambiguous ? [`More than one billing line could be the per-${kind} charge; the lowest-priced was used.`] : [],
            recommendation: action,
          }),
          meta: {
            rule: `mismatch.${kind}`,
            period_values: pv,
            calc: { kind: 'mismatch', unit: kind, contracted, contracted_source: contractedSource!, billed: line.quantity, unit_price: price, price_label: line.service, price_ambiguous: unit!.ambiguous },
          },
        })
      }

      // Drift: actual above contracted (or billed when no contract figure)
      const baseline = contracted ?? line?.quantity ?? null
      if (baseline == null) continue
      const pv: Record<string, number> = {}
      for (const m of months) {
        const end = monthEnd(m)
        const active = list.filter((a) => !a.first_seen || a.first_seen <= end).length
        const extra = Math.max(0, active - baseline)
        if (extra) pv[m] = pence(extra * price)
      }
      const extraNow = list.length - baseline
      if (extraNow <= 0) continue
      const monthlyExact = extraNow * price
      const monthly = pence(monthlyExact)
      const annual = pence(monthlyExact * 12)
      const identified = sumPence(Object.values(pv))
      const monthsAffected = Object.keys(pv).length
      const undated = list.filter((a) => !a.first_seen).length
      const newest = [...list].filter((a) => a.first_seen).sort((a, b) => (b.first_seen! > a.first_seen! ? 1 : -1)).slice(0, extraNow)
      // With no contracted figure the comparison is with what's billed, and the
      // wording says so rather than claiming a contract.
      const byContract = contracted != null
      const versus = byContract ? 'contracted' : 'billed'
      const gapNote = `${monthsAffected > 1 ? `, and the gap has existed for ${monthsAffected} months of the period analysed` : ''}.`
      const action = `Review the agreement with ${client.name}. If the extra ${kind}s are confirmed, update the recurring charge to ${list.length} ${kind}s (${signed(gbp(monthly))}/month). ${monthsAffected > 1 ? `Consider whether the ${gbp(identified)} already delivered in the period can be back-billed.` : ''}`.trim()
      const priceEvidence: Evidence[] = line
        ? unit!.ambiguous
          ? [ev('billing', 'billing', 'Price used', `More than one line could be the per-${kind} charge: ${unit!.candidates.map((b) => `${b.service} (${gbp(b.unit_price)})`).join(', ')}. The lowest price, ${gbp(price)}, was used.`, unit!.candidates.map(ref.billing))]
          : [ev('billing', 'billing', 'Price used', `${line.service}: ${gbp(line.unit_price)} per ${kind}`, [ref.billing(line)])]
        : [settingsEv('Default price', `${gbp(price)} per ${kind} (no matching billing line)`, [kind === 'user' ? 'default_user_price' : 'default_device_price'])]
      drafts.push({
        finding_key: `AGREEMENT_DRIFT:${client.id}:${kind}`,
        client_id: client.id,
        category: 'AGREEMENT_DRIFT',
        title: `${extraNow} more ${kind}${extraNow === 1 ? '' : 's'} than ${versus}`,
        description: `${client.name} is ${versus} for ${baseline} ${kind}s${byContract ? (contractedSource === 'contract' ? ' in its agreement' : ' in your clients file') : ''} and ${list.length} active ${kind}s are listed. At ${gbp(price)} per ${kind} the difference is ${gbp(monthly)} a month${gapNote}`,
        evidence: [
          ...(byContract ? contractedEvidence : [lineEvidence(line!)]),
          ev(
            'asset_register',
            'asset',
            `${kind === 'user' ? 'Users' : 'Devices'} list`,
            `${list.length} active ${kind}s.${newest.length ? ` Most recently added: ${newest.map((a) => `${a.name} (${dayLabel(a.first_seen!)})`).join(', ')}.` : ''}${undated ? ` ${undated} without a first-seen date.` : ''}`,
            list.map(ref.asset),
          ),
          ...priceEvidence,
        ],
        estimated_value: identified,
        monthly_value: monthly,
        annual_value: annual,
        recommended_action: action,
        claims: claimsOf({
          facts: [
            `Your ${kind}s list shows ${list.length} active ${kind}s for ${client.name}.`,
            contractedFact ?? `"${line!.service}" bills ${baseline} ${kind}s. No contracted figure was found.`,
            line ? `"${line.service}" is billed at ${gbp(line.unit_price)} per ${kind}.` : `No per-${kind} billing line was found; your Settings default is ${gbp(price)} per ${kind}.`,
          ],
          observations: [
            `${list.length} − ${baseline} = ${plural(extraNow, kind)} more than ${versus}.`,
            `${extraNow} × ${gbp(price)} = ${gbp(monthly)} a month, ${gbp(annual)} a year.`,
            ...(monthsAffected > 1 ? [`Counting each ${kind} from its first-seen date, the gap totals ${gbp(identified)} across ${monthsAffected} months of the period.`] : []),
          ],
          interpretations: [`The extra ${kind}s may be supported without being charged for. Some may be leavers not yet removed from the list, or covered by a separate arrangement.`],
          recommendation: action,
        }),
        meta: {
          rule: `drift.${kind}`,
          period_values: pv,
          calc: {
            kind: 'seats',
            unit: kind,
            baseline,
            baseline_source: byContract ? contractedSource! : 'billing',
            baseline_conflict: conflict,
            actual: list.length,
            unit_price: price,
            price_source: line ? 'billing_line' : 'default',
            price_label: line?.service ?? null,
            price_ambiguous: !!unit?.ambiguous,
            ...(unit?.ambiguous ? { price_candidates: unit.candidates.map((b) => b.service) } : {}),
            undated,
          },
        },
      })
    }

    // Licences assigned vs licences billed. A licence matches a billing line
    // when the names are the same once normalised; a partial name match is
    // used only when it is the only candidate for that line and that licence.
    const byLicense = groupBy(users.filter((u) => u.license), (u) => u.license!)
    const partialHits = (a: string, b: string) => norm(a).includes(norm(b)) || norm(b).includes(norm(a))
    for (const [license, holders] of byLicense) {
      const exact = billing.filter((b) => norm(b.service) === norm(license))
      let line: BillingItem
      let match: 'exact' | 'partial'
      if (exact.length === 1) {
        line = exact[0]
        match = 'exact'
      } else if (exact.length > 1) continue
      else {
        const partial = billing.filter((b) => partialHits(b.service, license))
        if (partial.length !== 1) continue
        if ([...byLicense.keys()].some((l) => l !== license && partialHits(partial[0].service, l))) continue
        line = partial[0]
        match = 'partial'
      }
      if (holders.length <= line.quantity) continue
      const gap = holders.length - line.quantity
      const monthlyExact = gap * line.unit_price
      const monthly = pence(monthlyExact)
      const pv: Record<string, number> = {}
      for (const m of months) {
        const active = holders.filter((a) => !a.first_seen || a.first_seen <= monthEnd(m)).length
        if (active > line.quantity) pv[m] = pence((active - line.quantity) * line.unit_price)
      }
      const identified = sumPence(Object.values(pv))
      const action = `Check the licence assignments, then increase the "${line.service}" quantity to ${holders.length} (${signed(gbp(monthly))}/month), or remove unused assignments.`
      drafts.push({
        finding_key: `MISSING_LICENSE:${client.id}:${norm(license)}`,
        client_id: client.id,
        category: 'MISSING_LICENSE',
        title: `${gap} ${license} licence${gap === 1 ? '' : 's'} assigned beyond those billed`,
        description: `${holders.length} users at ${client.name} are assigned ${license}, but the recurring charge "${line.service}" bills ${line.quantity}.`,
        evidence: [
          ev('asset_register', 'asset', 'Users list', `${holders.length} active users with ${license}.`, holders.map(ref.asset)),
          ev('billing', 'billing', 'Billing line', `${line.service}: ${line.quantity} × ${gbp(line.unit_price)}`, [ref.billing(line)]),
        ],
        estimated_value: identified,
        monthly_value: monthly,
        annual_value: pence(monthlyExact * 12),
        recommended_action: action,
        claims: claimsOf({
          facts: [`Your users list shows ${holders.length} active users assigned ${license}.`, `The recurring charge "${line.service}" bills ${line.quantity} × ${gbp(line.unit_price)}.`],
          observations: [`${holders.length} − ${line.quantity} = ${plural(gap, 'licence')} assigned beyond those billed. ${gap} × ${gbp(line.unit_price)} = ${gbp(monthly)} a month (${gbp(pence(monthlyExact * 12))} a year).`],
          interpretations: match === 'partial' ? [`The licence was matched to "${line.service}" by a partial name match.`] : [],
          recommendation: action,
        }),
        meta: { rule: 'license.unbilled', period_values: pv, calc: { kind: 'licence', licence: license, assigned: holders.length, billed: line.quantity, unit_price: line.unit_price, price_label: line.service, match } },
      })
    }

    // Usage vs included hours / margin
    const h = hours.get(client.id) ?? {}
    const nb = nbHours.get(client.id) ?? {}
    const hoursStated = statedValue(clauses, 'included_hours')
    const contractHours = hoursStated?.value ?? null
    const included = client.included_hours ?? contractHours
    if (included != null) {
      const rb = rateBasis(cc, s)
      const pv: Record<string, number> = {}
      const over: string[] = []
      const overByMonth: { month: string; used: number; over: number; value: number }[] = []
      const monthRefs: SourceRef[] = []
      for (const m of months) {
        const used = nb[m] ?? 0
        if (used > included * (1 + s.excessive_usage_threshold)) {
          pv[m] = round((used - included) * rb.base)
          over.push(`${monthLabel(m, 'long')}: ${r1(used)}h non-billable time logged (${r1(used - included)}h over)`)
          overByMonth.push({ month: m, used: r2(used), over: r2(used - included), value: pv[m] })
          monthRefs.push(...(nbRefs.get(client.id)?.[m] ?? []))
        }
      }
      const identified = Object.values(pv).reduce((a, b) => a + b, 0)
      if (identified > 0) {
        const overMonths = Object.keys(pv).length
        const action =
          contractHours != null
            ? `Check your invoices for an overage charge. If none was raised, bill the overage at ${gbp(rb.base)}/h as the agreement allows, or move ${client.name} to a tier with more included hours.`
            : `Check whether the agreement allows overage and whether it was invoiced, then bill it at ${gbp(rb.base)}/h, or move ${client.name} to a tier with more included hours.`
        const allowanceEv: Evidence[] = [
          ...(hoursStated ? [clauseEv('Agreement', hoursStated.clause)] : []),
          ...(client.included_hours != null ? [clientRecordEv(`Included support: ${client.included_hours} hours/month`)] : []),
        ]
        drafts.push({
          finding_key: `EXCESSIVE_USAGE:${client.id}`,
          client_id: client.id,
          category: 'EXCESSIVE_USAGE',
          title: `Support usage above the ${included}h monthly allowance`,
          description: `${hoursStated ? `${poss(client.name)} agreement` : `Your clients file for ${client.name}`} includes ${included} hours of support a month. Non-billable time went over that in ${overMonths} of the ${months.length} months analysed. Your invoices aren't in the data provided, so check whether an overage charge was raised.`,
          evidence: [
            ...allowanceEv,
            ev('derived', 'metric', 'Monthly usage', over.join('\n'), monthRefs),
            ...(rb.baseClause ? [clauseEv('Hourly rate', rb.baseClause)] : [settingsEv('Hourly rate', `Billable rate ${gbp(rb.base)}/h`, ['billable_rate_per_hour'])]),
          ],
          estimated_value: identified,
          monthly_value: 0,
          annual_value: 0,
          recommended_action: action,
          claims: claimsOf({
            facts: [
              hoursStated ? `${clauseCitation(hoursStated.clause)} states ${contractHours} included hours a month.` : `Your clients file records ${included} included hours a month.`,
              ...overByMonth.map((m) => `${monthLabel(m.month, 'long')}: ${m.used}h of non-billable time logged.`),
            ],
            observations: overByMonth.map((m) => `${monthLabel(m.month, 'long')}: ${m.used}h − ${included}h = ${m.over}h over × ${gbp(rb.base)} = ${gbp(m.value)}.`),
            interpretations: ['No overage charge appears in the data provided, but invoices are not part of it, so the overage may already have been billed.'],
            recommendation: action,
          }),
          meta: {
            rule: 'usage.over_allowance',
            period_values: pv,
            calc: {
              kind: 'usage',
              included,
              included_source: client.included_hours != null ? 'client' : 'contract',
              included_confirmed: contractHours != null && contractHours === included,
              rate: rb.base,
              rate_source: rb.baseClause ? 'contract' : 'settings',
              non_billable_only: true,
              months: overByMonth,
            },
          },
        })
      }
    } else if (client.monthly_recurring_revenue > 0) {
      const sw = softwareCost(client, users.length, s.default_software_cost_per_user)
      const pv: Record<string, number> = {}
      let totalContribution = 0
      for (const m of months) {
        const contribution = client.monthly_recurring_revenue - (h[m] ?? 0) * s.labour_cost_per_hour - sw
        totalContribution += contribution
        const shortfall = s.target_margin * client.monthly_recurring_revenue - contribution
        if (shortfall > 0) pv[m] = round(shortfall)
      }
      const margin = totalContribution / (client.monthly_recurring_revenue * months.length)
      const identified = Object.values(pv).reduce((a, b) => a + b, 0)
      if (margin < s.target_margin && identified > 0) {
        const mrr = client.monthly_recurring_revenue
        const avgHours = sumValues(h) / months.length
        const monthly = round(identified / months.length)
        const avgContribution = totalContribution / months.length
        const targetContribution = round(s.target_margin * mrr)
        const pct = `${Math.round(s.target_margin * 100)}%`
        const belowMonths = Object.keys(pv).length
        // The price that earns the target margin on average costs: raising the
        // price raises the margin owed on it, so this is more than the shortfall.
        const avgCost = mrr - avgContribution
        const targetPrice = round(avgCost / (1 - s.target_margin))
        // Agreement gaps already found for this client are extra revenue too. If
        // billing them alone restores the target margin, the two overlap: say so
        // rather than netting, so neither figure changes.
        const gaps = drafts.filter((f) => f.client_id === client.id && (f.category === 'AGREEMENT_DRIFT' || f.category === 'RECURRING_CHARGE_MISMATCH' || f.category === 'MISSING_LICENSE'))
        const agreementMonthly = gaps.reduce((a, f) => a + f.monthly_value, 0)
        const overlaps = agreementMonthly > 0 && (avgContribution + agreementMonthly) / (mrr + agreementMonthly) >= s.target_margin ? gaps.map((f) => f.finding_key) : []
        const action = `Review pricing with ${client.name}: at this period's average hours and costs, about ${gbp(targetPrice)}/month (${signed(gbp(targetPrice - client.monthly_recurring_revenue))}) would restore your ${pct} target margin. Alternatively, look at what's driving ticket volume or move them to a higher support tier.`
        const allWork = Object.values(workRefs.get(client.id) ?? {}).flat()
        drafts.push({
          finding_key: `UNDERPRICED_CLIENT:${client.id}`,
          client_id: client.id,
          category: 'UNDERPRICED_CLIENT',
          title: `Gross margin ${Math.round(margin * 100)}% against a ${pct} target`,
          description:
            `${client.name} pays ${gbp(mrr)} a month and averaged ${r1(avgHours)} support hours a month. At ${gbp(s.labour_cost_per_hour)}/h labour plus ${gbp(sw)} software, it earns ${gbp(round(avgContribution))} a month on average against the ${gbp(targetContribution)} a ${pct} margin needs. In the ${belowMonths} month${belowMonths === 1 ? '' : 's'} it fell below target the shortfall totalled ${gbp(identified)}, an average of ${gbp(monthly)} a month across the ${months.length}-month period. This is an estimate from your cost settings.` +
            (overlaps.length ? ` Billing the agreement gaps found for ${client.name} (${signed(gbp(agreementMonthly))} a month) would restore the target margin on its own, so don't count both.` : ''),
          evidence: [
            clientRecordEv(`MRR ${gbp(client.monthly_recurring_revenue)}${client.package ? ` · ${client.package}` : ''}${client.monthly_software_cost != null ? ` · Software cost ${gbp(client.monthly_software_cost)}/month` : ''}`),
            ev('derived', 'metric', 'Support hours', months.map((m) => `${monthLabel(m, 'long')}: ${r1(h[m] ?? 0)}h`).join('\n'), allWork),
            settingsEv(
              'Cost basis',
              `Labour ${gbp(s.labour_cost_per_hour)}/h · Software ${gbp(sw)}/month${client.monthly_software_cost == null ? ` (${gbp(s.default_software_cost_per_user)} per user default)` : ''} · Target margin ${pct}`,
              client.monthly_software_cost == null ? ['labour_cost_per_hour', 'default_software_cost_per_user', 'target_margin'] : ['labour_cost_per_hour', 'target_margin'],
            ),
          ],
          estimated_value: identified,
          monthly_value: monthly,
          // A modelled average, annualised from the whole-pound monthly figure
          // shown to the user. Annualising the unrounded average would move the
          // pinned demo annualised total (£4,272 to £4,278); see methodology.
          annual_value: monthly * 12,
          recommended_action: action,
          claims: claimsOf({
            facts: [`${client.name} pays ${gbp(mrr)} a month (clients file).`, `${r1(avgHours)} support hours a month were logged on average over ${months.length} months.`],
            observations: [
              `Estimated average contribution: ${gbp(round(avgContribution))} a month, against ${gbp(targetContribution)} for a ${pct} margin.`,
              `Shortfall in the ${belowMonths} month${belowMonths === 1 ? '' : 's'} below target: ${gbp(identified)}, an average of ${gbp(monthly)} a month.`,
            ],
            interpretations: [
              `This is a model, not a count: it depends on the labour cost, software cost and target margin you set, and treats all logged time as cost against the monthly fee.`,
              ...(overlaps.length ? [`Billing the agreement gaps for ${client.name} would restore the target margin on its own, so this overlaps with them.`] : []),
            ],
            recommendation: action,
          }),
          meta: {
            rule: 'margin.below_target',
            period_values: pv,
            calc: {
              kind: 'margin',
              mrr,
              labour_rate: s.labour_cost_per_hour,
              software: sw,
              software_source: client.monthly_software_cost != null ? 'client' : 'default',
              target_margin: s.target_margin,
              avg_hours: r2(avgHours),
              avg_contribution: round(avgContribution),
              target_contribution: targetContribution,
              shortfall: months.filter((m) => pv[m] != null).map((m) => ({ month: m, value: pv[m] })),
              months: months.length,
              target_price: targetPrice,
            },
            ...(overlaps.length ? { overlaps } : {}),
          },
        })
      }
    }
  }

  const findings = drafts.map(finalise)

  // ----- summary
  const by_category: AnalysisSummary['by_category'] = {}
  for (const f of findings) {
    const c = (by_category[f.category] ??= { value: 0, count: 0, clients: 0 })
    c.value = pence(c.value + f.estimated_value)
    c.count++
  }
  for (const [cat, v] of Object.entries(by_category)) v.clients = new Set(findings.filter((f) => f.category === cat).map((f) => f.client_id)).size

  const trend = months.map((m) => ({
    month: m,
    label: monthLabel(m),
    value: sumPence(findings.map((f) => f.meta.period_values[m] ?? 0)),
  }))

  const client_metrics = computeClientMetrics(ds, findings, hours, months)
  const total_identified = sumPence(findings.map((f) => f.estimated_value))
  const monthly_recurring = sumPence(findings.map((f) => f.monthly_value))
  const sortedFindings = findings.sort((a, b) => b.estimated_value - a.estimated_value)

  // What the data could support, so the UI can say what wasn't checked.
  const ticketKeys = new Set(ds.tickets.map((t) => `${t.client_id}|${t.external_id}`))
  const withContract = new Set(ds.contracts.map((c) => c.client_id))
  const withAssets = new Set(ds.assets.map((a) => a.client_id))
  const coverage = {
    clients: ds.clients.length,
    clients_with_contract: ds.clients.filter((c) => withContract.has(c.id)).length,
    clients_with_mrr: ds.clients.filter((c) => c.monthly_recurring_revenue > 0).length,
    clients_with_assets: ds.clients.filter((c) => withAssets.has(c.id)).length,
    time_entries_unmatched: ds.time_entries.filter((e) => e.ticket_external_id && !ticketKeys.has(`${e.client_id}|${e.ticket_external_id}`)).length,
  }

  return {
    findings: sortedFindings,
    summary: {
      period_start: `${firstMonth}-01`,
      period_end: periodEnd,
      period_label: periodLabel(firstMonth, lastMonth),
      months,
      total_identified,
      monthly_recurring,
      annualised: sumPence(findings.map((f) => f.annual_value)),
      finding_count: findings.length,
      by_category,
      trend,
      client_metrics,
      average_monthly_hours: client_metrics.length ? r1(client_metrics.reduce((a, c) => a + c.avg_monthly_hours, 0) / client_metrics.length) : 0,
      data_counts: {
        clients: ds.clients.length,
        tickets: ds.tickets.length,
        time_entries: ds.time_entries.length,
        assets: ds.assets.length,
        billing_items: ds.billing_items.length,
        contracts: ds.contracts.length,
      },
      finding_keys: sortedFindings.map((f) => f.finding_key),
      coverage,
      settings: { ...s },
    },
  }
}

function softwareCost(client: Client, users: number, perUser: number) {
  return client.monthly_software_cost ?? round((users || client.contracted_users || 0) * perUser)
}

function sumValues(o: Record<string, number>) {
  return Object.values(o).reduce((a, b) => a + b, 0)
}

function groupBy<T>(xs: T[], key: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    const k = key(x)
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(x)
  }
  return m
}

function computeClientMetrics(ds: Dataset, findings: FindingDraft[], hours: Map<string, Record<string, number>>, months: string[]): ClientMetrics[] {
  const s = ds.settings
  const assets = groupBy(ds.assets.filter((a: Asset) => a.status === 'active'), (a) => a.client_id)
  const avgAll = ds.clients.length ? ds.clients.reduce((a, c) => a + sumValues(hours.get(c.id) ?? {}), 0) / months.length / ds.clients.length : 0
  return ds.clients
    .map((c) => {
      const list = assets.get(c.id) ?? []
      const users = list.filter((a) => a.asset_type === 'user').length
      const devices = list.filter((a) => a.asset_type === 'device').length
      const h = hours.get(c.id) ?? {}
      const avgHours = sumValues(h) / months.length
      const latest = h[months[months.length - 1]] ?? 0
      const sw = softwareCost(c, users, s.default_software_cost_per_user)
      const labour = avgHours * s.labour_cost_per_hour
      const mrr = c.monthly_recurring_revenue
      const contribution = mrr - labour - sw
      const margin = mrr > 0 ? contribution / mrr : 0
      const fs = findings.filter((f) => f.client_id === c.id)
      const mt: ClientMetrics = {
        client_id: c.id,
        name: c.name,
        package: c.package,
        mrr,
        software_cost: sw,
        avg_monthly_hours: r1(avgHours),
        latest_month_hours: r1(latest),
        labour_cost: round(labour),
        contribution: round(contribution),
        margin,
        revenue_per_hour: avgHours > 0 ? round(mrr / avgHours) : null,
        users,
        devices,
        contracted_users: c.contracted_users,
        contracted_devices: c.contracted_devices,
        leakage: 0,
        finding_count: fs.length,
        health: 'healthy',
        reasons: [],
        recommendation: '',
        margin_known: mrr > 0,
        // Same formula as the margin rule's target price, so they always agree.
        target_price: mrr > 0 ? round((labour + sw) / (1 - s.target_margin)) : null,
      }
      // Unrounded hours here so the engine's own results don't move.
      const live = liveClientHealth({ ...mt, avg_monthly_hours: avgHours }, fs, s, avgAll, months.length)
      return { ...mt, leakage: live.leakage, health: live.health, reasons: live.reasons, recommendation: live.recommendation }
    })
    .sort((a, b) => b.leakage - a.leakage)
}
