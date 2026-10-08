// One report model, rendered both on screen and as a PDF. Evidence first:
// every opportunity carries its source records, its calculation, its
// confidence and classification, its review stage and the recommendation, and
// the headline shows high-confidence money apart from what still needs review.
import type { Analysis, Category, ClientMetrics, ConfidenceLevel, Finding, FindingClass, FindingStatus, Health, SourceRef, Workspace, WorkspaceSettings } from '../engine/types'
import { DEFAULT_SETTINGS } from '../engine/types'
import { liveClientHealth } from '../engine/health'
import type { WorkspaceData } from '../data/backend'
import { CATEGORY_META, CLASSIFICATION, CLASSIFICATION_ORDER, CONFIDENCE, CONFIDENCE_NOTE, FINDING_STATUS, HEALTH, LEVEL_ORDER, STAGE_ORDER, recurringKind } from './labels'
import { CLASSIFICATION_DEFINITIONS, CONFIDENCE_DEFINITIONS, confidenceOf, confidenceSplit, type ConfidenceTotals } from './confidence'
import { formatCalculation, type ValueBasis } from './calculation'
import { money, num, pct, hours, plural } from './format'
import { overlapOf } from './overlap'
import { stripJoiners } from '../engine/format'
import { evidenceFingerprint, sha256Hex } from '../../supabase/functions/ai-review/guard'
import { color, paper, rgb, viz } from '../brand/tokens'
import { COMPANY } from '../brand/brand'

const opportunities = (n: number) => plural(n, 'opportunity', 'opportunities')

export const REPORT_TITLE = 'Revenue Opportunity Report'

// Where one opportunity's figures came from, as a reader would look them up:
// the agreement clause, or the file and rows of an export.
export interface EvidenceSourceLine {
  source: string
  detail: string
}

export interface EvidenceRow {
  // E1, E2 ... in the order the report lists them, so tables point into the appendix.
  ref: string
  id: string
  client: string
  title: string
  category: Category
  categoryLabel: string
  level: ConfidenceLevel
  // What the confidence level rests on, in plain words.
  basis: string
  classification: FindingClass
  status: FindingStatus
  value: number
  monthly: number
  valueBasis: ValueBasis | null
  // "£72 a month", "£150 one-off", "£56 a month, estimated"
  result: string
  calc: string[]
  calcNote: string | null
  sources: EvidenceSourceLine[]
  action: string
  // Only an explanation written for the evidence shown, labelled as AI-assisted.
  ai: { text: string; model: string | null; generated: string | null } | null
}

export interface ReportModel {
  title: string
  workspace: string
  period: string
  generated: string
  isDemo: boolean
  analysisId: string
  analysisRun: string
  total: number
  monthly: number
  /** The recurring part from agreement and billing gaps, and from pricing below target. */
  recurringAgreement: number
  recurringPricing: number
  annual: number
  /** Conservative headline: HIGH confidence on its own, MEDIUM and LOW as "requires review". total = high + review. */
  split: { high: ConfidenceTotals; review: ConfidenceTotals }
  /** Agreement value over the analysed period: the monthly agreement value (MRR) in the clients file × months. Not invoiced amounts. */
  agreementValue: number
  months: number
  findingCount: number
  /** Opportunities excluded because the MSP dismissed them. */
  dismissedCount: number
  /** The workspace's target gross margin, so margins below it can be marked. */
  targetMargin: number
  executiveSummary: string[]
  breakdown: { category: Category; label: string; count: number; value: number; share: number; high: number }[]
  /** Opportunities by confidence level, for the "How to read confidence" box. */
  levels: { level: ConfidenceLevel; count: number; value: number; definition: string }[]
  classes: { classification: FindingClass; label: string; count: number; value: number; definition: string }[]
  /** Where each opportunity stands in review (dismissed ones are excluded from the report). */
  stages: { status: FindingStatus; label: string; count: number; value: number }[]
  /** health and status are live: they follow the opportunities still counted. known is false without MRR. */
  riskClients: { name: string; potential: number; margin: number; known: boolean; health: string; status: Health; reason: string }[]
  /** The largest opportunities, shown with their evidence in the body of the report. */
  top: EvidenceRow[]
  sections: {
    key: Category
    title: string
    intro: string
    value: number
    rows: EvidenceRow[]
    /** the opportunities past the listed rows, so the table still adds up to its heading */
    more: { count: number; value: number; from: string; to: string } | null
  }[]
  /** Every opportunity in the report, with its evidence. Ordered by ref. */
  evidence: EvidenceRow[]
  profitability: (ClientMetrics & { potential: number; known: boolean })[]
  /** largest value first; note says when an action covers the same money as another */
  actions: { ref: string; client: string; action: string; value: number; note?: string }[]
  /** money counted under two opportunities at once, disclosed and not netted */
  overlap: { value: number; monthly: number; clients: string[] }
  /** What the analysis read and the assumptions it used, so the figures can be reproduced. */
  inputs: { label: string; value: string }[]
  assumptions: { label: string; value: string }[]
  ai: { explained: number; total: number }
  clientName: (id: string) => string
}

// ---------------------------------------------------------------- fixed text

// The owner's methodology statement, verbatim, then what this version does.
export const METHODOLOGY = [
  'Findings are generated by comparing customer-provided operational, contractual and billing data. Financial calculations are deterministic. Contract interpretation and classification may use AI-assisted analysis. Findings should be reviewed by the MSP before billing or contractual changes are made.',
  'In this version, AI is not used for contract interpretation or classification: contract clauses, kinds of work, confidence levels and classifications all come from deterministic rules. AI is used only for an optional, labelled explanation of a single opportunity on the hosted service. Every figure is worked out from your records and the settings listed below, and each calculation is printed beside the opportunity so it can be checked by hand.',
  'Confidence reflects the strength and completeness of the underlying evidence. The high-confidence total counts only findings rated High; modelled estimates, such as margin below target, are never rated High and sit under requires review.',
]

export const AI_STATEMENT = 'AI assists with interpretation. Financial calculations are deterministic. No figure in this report was produced by AI.'
export const NO_AI_STATEMENT = 'No figure in this report was produced by AI, and no AI was used to prepare it: every figure, interpretation and classification comes from deterministic rules.'

export const DECISION_LINE = 'Recommendations require MSP review before action. The software recommends. The MSP decides.'

export const DISCLAIMER =
  'All figures are estimates of potential revenue based on the data provided and the settings configured in Headroom. They are not guaranteed to be recoverable. Review each opportunity against the client agreement before taking action.'

// ---------------------------------------------------------------- sources

const SOURCE_ORDER = ['Agreement', 'Client record', 'PSA', 'Asset register', 'Billing', 'Settings'] as const
const TABLE_SOURCE: Record<SourceRef['table'], (typeof SOURCE_ORDER)[number]> = {
  contracts: 'Agreement',
  clients: 'Client record',
  tickets: 'PSA',
  time_entries: 'PSA',
  assets: 'Asset register',
  billing_items: 'Billing',
}
const TABLE_NOUN: Record<SourceRef['table'], [string, string]> = {
  contracts: ['clause', 'clauses'],
  clients: ['client record', 'client records'],
  tickets: ['ticket', 'tickets'],
  time_entries: ['time entry', 'time entries'],
  assets: ['user or device', 'users and devices'],
  billing_items: ['billing line', 'billing lines'],
}
const SETTING_LABEL: Partial<Record<keyof WorkspaceSettings, string>> = {
  labour_cost_per_hour: 'labour cost per hour',
  billable_rate_per_hour: 'billable rate per hour',
  after_hours_multiplier: 'out-of-hours multiplier',
  default_user_price: 'default price per user',
  default_device_price: 'default price per device',
  default_software_cost_per_user: 'default software cost per user',
  target_margin: 'target margin',
  excessive_usage_threshold: 'usage tolerance',
  business_hours_start: 'business hours',
  business_hours_end: 'business hours',
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

// Every record a finding cites, grouped by the system it came from: agreement
// clauses by section and page, exports by file and row.
export function sourcesOf(f: Pick<Finding, 'source_data' | 'evidence'>): EvidenceSourceLine[] {
  const refs = [...f.source_data, ...f.evidence.flatMap((e) => e.refs ?? [])]
  const seen = new Set<string>()
  const by = new Map<string, string[]>()
  const add = (source: string, detail: string) => by.set(source, [...(by.get(source) ?? []), detail])

  // Agreement: one line per clause.
  for (const r of refs) {
    if (r.table !== 'contracts') continue
    const key = `c:${r.id}:${r.section ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    add('Agreement', [r.label, r.page ? `page ${r.page}` : null, r.file_name ?? null].filter(Boolean).join(', '))
  }
  // Exports: one line per file, with the rows used.
  const files = new Map<string, { source: string; file: string; table: SourceRef['table']; rows: number[]; labels: string[]; count: number }>()
  const loose = new Map<string, { source: string; table: SourceRef['table']; labels: string[] }>()
  for (const r of refs) {
    if (r.table === 'contracts') continue
    const key = `${r.table}:${r.id}`
    if (seen.has(key)) continue
    seen.add(key)
    const source = TABLE_SOURCE[r.table]
    if (r.file_name) {
      const k = `${source}:${r.upload_id ?? r.file_name}:${r.table}`
      const g = files.get(k) ?? { source, file: r.file_name, table: r.table, rows: [], labels: [], count: 0 }
      g.count++
      if (r.row) g.rows.push(r.row)
      g.labels.push(r.label)
      files.set(k, g)
    } else {
      const k = `${source}:${r.table}`
      const g = loose.get(k) ?? { source, table: r.table, labels: [] }
      g.labels.push(r.label)
      loose.set(k, g)
    }
  }
  for (const g of files.values()) {
    const noun = plural(g.count, TABLE_NOUN[g.table][0], TABLE_NOUN[g.table][1])
    const ranges = rowRanges(g.rows)
    // A scattered list of rows reads better as a count and a span.
    if (g.rows.length > 1 && ranges.split(', ').length > 6) {
      add(g.source, `${g.file}, ${noun} in rows ${num(Math.min(...g.rows))} to ${num(Math.max(...g.rows))}`)
      continue
    }
    const rows = g.rows.length ? `, ${g.rows.length === 1 ? 'row' : 'rows'} ${ranges}` : ''
    // Name a few tickets; a long list of users reads better as a count.
    const named = g.table === 'tickets' && g.count <= 3 ? ` (${g.labels.join(', ')})` : g.count > 1 ? ` (${noun})` : ''
    add(g.source, `${g.file}${rows}${named}`)
  }
  for (const g of loose.values()) {
    add(g.source, g.labels.length <= 3 ? `${g.labels.join(', ')} (no source file recorded)` : `${plural(g.labels.length, TABLE_NOUN[g.table][0], TABLE_NOUN[g.table][1])} with no source file recorded`)
  }
  // Settings the calculation used where the records gave no value.
  const keys = [...new Set(f.evidence.flatMap((e) => (e.source === 'settings' ? (e.setting_keys ?? []) : [])))]
  const names = [...new Set(keys.map((k) => SETTING_LABEL[k] ?? k))]
  if (names.length) add('Settings', `${names.join(', ')} (your Settings)`.replace(/^./, (c) => c.toUpperCase()))

  return SOURCE_ORDER.flatMap((s) => (by.get(s) ?? []).map((detail) => ({ source: s, detail })))
}

// ---------------------------------------------------------------- AI freshness

// Postgres jsonb orders object keys by length, then bytewise. The ai-review
// function hashes the finding as read back from the database, so the same
// ordering is tried before comparing.
function jsonbOrder(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(jsonbOrder)
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    return Object.fromEntries(keys.map((k) => [k, jsonbOrder((v as Record<string, unknown>)[k])]))
  }
  return v
}

// The findings whose stored AI explanation was written for the evidence they
// carry now. Explanations without a version, or for changed evidence, are left
// out of the report.
export async function currentAiExplanations(findings: Finding[]): Promise<Set<string>> {
  const ok = new Set<string>()
  await Promise.all(
    findings.map(async (f) => {
      const hash = f.ai_meta?.evidence_hash
      if (!f.ai_explanation || !hash) return
      try {
        const [a, b] = await Promise.all([sha256Hex(evidenceFingerprint(f)), sha256Hex(evidenceFingerprint(jsonbOrder({ ...f }) as Finding))])
        if (a === hash || b === hash) ok.add(f.id)
      } catch {
        // No hashing available: leave it out.
      }
    }),
  )
  return ok
}

// ---------------------------------------------------------------- the model

const dateLong = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

// Each category table lists its largest opportunities, then one line for the rest.
const SECTION_ROWS = 10
// The opportunities shown with full evidence in the body.
const TOP_ROWS = 5

export function buildReport(ws: Workspace, analysis: Analysis, data: WorkspaceData, opts: { aiCurrent?: Set<string> } = {}): ReportModel {
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name ?? 'Unknown client'
  const live = data.findings.filter((f) => f.status !== 'dismissed')
  const dismissedCount = data.findings.length - live.length
  const total = live.reduce((a, f) => a + f.estimated_value, 0)
  const monthly = live.reduce((a, f) => a + f.monthly_value, 0)
  const s = analysis.summary
  // The settings the analysis ran with, so targets match its opportunities.
  const settings = { ...DEFAULT_SETTINGS, ...ws.settings, ...s.settings }
  const split = confidenceSplit(live)
  const potentialBy = new Map<string, number>()
  const liveByClient = new Map<string, Finding[]>()
  live.forEach((f) => {
    potentialBy.set(f.client_id, (potentialBy.get(f.client_id) ?? 0) + f.estimated_value)
    liveByClient.set(f.client_id, [...(liveByClient.get(f.client_id) ?? []), f])
  })

  // Recurring money splits into gaps billing can close and pricing below target.
  let recurringAgreement = 0
  let recurringPricing = 0
  const pricedBelow = new Set<string>()
  for (const f of live) {
    if (!f.monthly_value) continue
    if (recurringKind(f.category) === 'pricing') {
      recurringPricing += f.monthly_value
      pricedBelow.add(f.client_id)
    } else recurringAgreement += f.monthly_value
  }

  const levelOf = new Map(live.map((f) => [f.id, confidenceOf(f)]))
  const levels = LEVEL_ORDER.map((level) => ({ level, count: split.byLevel[level].count, value: split.byLevel[level].value, definition: CONFIDENCE_DEFINITIONS[level] }))
  const classes = CLASSIFICATION_ORDER.map((c) => {
    const fs = live.filter((f) => levelOf.get(f.id)!.classification === c)
    return { classification: c, label: CLASSIFICATION[c].label, count: fs.length, value: fs.reduce((a, f) => a + f.estimated_value, 0), definition: CLASSIFICATION_DEFINITIONS[c].replace(/^[^:]+:\s*/, '').replace(/^./, (x) => x.toUpperCase()) }
  })
  const stages = STAGE_ORDER.filter((st) => st !== 'dismissed').map((status) => {
    const fs = live.filter((f) => f.status === status)
    return { status, label: FINDING_STATUS[status], count: fs.length, value: fs.reduce((a, f) => a + f.estimated_value, 0) }
  })

  const byCat = new Map<Category, { count: number; value: number; high: number }>()
  live.forEach((f) => {
    const c = byCat.get(f.category) ?? { count: 0, value: 0, high: 0 }
    c.count++
    c.value += f.estimated_value
    if (levelOf.get(f.id)!.level === 'HIGH') c.high += f.estimated_value
    byCat.set(f.category, c)
  })
  const breakdown = [...byCat.entries()].map(([k, v]) => ({ category: k, label: CATEGORY_META[k].label, ...v, share: total ? v.value / total : 0 })).sort((a, b) => b.value - a.value)

  // Every opportunity, numbered by category (largest category first), then by value.
  const ordered = breakdown.flatMap((b) => live.filter((f) => f.category === b.category).sort((a, c) => c.estimated_value - a.estimated_value))
  const evidence: EvidenceRow[] = ordered.map((f, i) => {
    const conf = levelOf.get(f.id)!
    const calc = formatCalculation(f)
    const aiOk = !!f.ai_explanation && !!opts.aiCurrent?.has(f.id)
    return {
      ref: `E${i + 1}`,
      id: f.id,
      client: clientName(f.client_id),
      title: stripJoiners(f.title),
      category: f.category,
      categoryLabel: CATEGORY_META[f.category].label,
      level: conf.level,
      basis: conf.basis,
      classification: conf.classification,
      status: f.status,
      value: f.estimated_value,
      monthly: f.monthly_value,
      valueBasis: calc?.basis ?? null,
      result: stripJoiners(calc?.result ?? (f.monthly_value ? `${money(f.monthly_value)} a month` : `${money(f.estimated_value)} in the period`)),
      calc: (calc?.lines ?? []).map(stripJoiners),
      // "See value by month" points at the app's chart, which a printed report doesn't have.
      calcNote: calc?.note ? stripJoiners(calc.note.replace(/\s*See value by month\.?/, '')) || null : null,
      sources: sourcesOf(f),
      action: stripJoiners(f.recommended_action),
      ai: aiOk ? { text: stripJoiners(f.ai_explanation!), model: f.ai_meta?.model ?? null, generated: f.ai_meta?.generated_at ? dateLong(f.ai_meta.generated_at) : null } : null,
    }
  })
  const rowOf = new Map(evidence.map((r) => [r.id, r]))
  const top = [...evidence].sort((a, b) => b.value - a.value).slice(0, TOP_ROWS)

  // Health, reasons and margin follow the opportunities still counted, as on
  // screen. A client without MRR has no margin to measure.
  const metrics = s.client_metrics.map((c) => {
    const h = liveClientHealth(c, liveByClient.get(c.client_id) ?? [], settings, s.average_monthly_hours, s.months.length)
    return { ...c, potential: potentialBy.get(c.client_id) ?? 0, health: h.health, reasons: h.reasons, recommendation: h.recommendation, known: c.margin_known ?? c.mrr > 0 }
  })
  const riskClients = [...metrics]
    .filter((c) => c.potential > 0 || c.health === 'at_risk')
    .sort((a, b) => b.potential - a.potential)
    .slice(0, 6)
    .map((c) => ({ name: c.name, potential: c.potential, margin: c.margin, known: c.known, health: c.known ? HEALTH[c.health].label : 'Needs MRR', status: c.health, reason: c.reasons[0] ?? '' }))

  const sections = breakdown.map((b) => {
    const rows = evidence.filter((r) => r.category === b.category)
    const rest = rows.slice(SECTION_ROWS)
    return {
      key: b.category,
      title: b.label,
      intro: `${CATEGORY_META[b.category].blurb}. ${opportunities(rows.length)} worth ${money(b.value)}${b.high === b.value ? ', all of it high confidence' : b.high > 0 ? `, of which ${money(b.high)} is high confidence` : ', none of it high confidence'}.`,
      value: b.value,
      rows: rows.slice(0, SECTION_ROWS),
      more: rest.length ? { count: rest.length, value: rest.reduce((a, r) => a + r.value, 0), from: rest[0].ref, to: rest[rest.length - 1].ref } : null,
    }
  })

  const topCat = breakdown[0]
  const worst = metrics.filter((c) => c.known).sort((a, b) => a.margin - b.margin)[0]
  const target = settings.target_margin
  // What recurs, and why: gaps that billing can close, and pricing below target.
  const recurs = [
    recurringAgreement > 0 ? `${money(recurringAgreement)} a month from agreement and billing gaps, which continue until agreements or billing are updated` : '',
    recurringPricing > 0 ? `${money(recurringPricing)} a month from ${plural(pricedBelow.size, 'client')} whose modelled margin is below your target` : '',
  ].filter(Boolean)
  // Overlaps are disclosed, never netted: say where the same money is counted twice.
  const ov = overlapOf(data.findings)
  const overlap = { value: ov.value, monthly: ov.monthly, clients: ov.clients.map(clientName) }
  const overlapNames = overlap.clients.join(' and ')
  // Out-of-scope checks need a contract: say how many clients had one.
  const withContract = s.coverage?.clients_with_contract
  const agreements =
    withContract != null && withContract < s.data_counts.clients
      ? `${plural(s.data_counts.clients, 'client')} (contracts uploaded for ${withContract})`
      : plural(s.data_counts.clients, 'client agreement')
  const reviewed = stages.filter((x) => x.status === 'valid' || x.status === 'resolved').reduce((a, x) => a + x.count, 0)
  const unreviewed = live.length - reviewed
  const CLASS_PLURAL: Record<FindingClass, [string, string]> = {
    confirmed: ['confirmed discrepancy', 'confirmed discrepancies'],
    potential: ['potential opportunity', 'potential opportunities'],
    investigate: ['needing investigation', 'needing investigation'],
  }
  const classLine = classes.filter((c) => c.count > 0).map((c) => `${plural(c.count, ...CLASS_PLURAL[c.classification])} (${money(c.value)})`)
  const listJoin = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '')
  const annualHigh = split.high.monthly * 12
  const executiveSummary = [
    `We analysed ${plural(s.data_counts.tickets, 'ticket')}, ${plural(s.data_counts.time_entries, 'time entry', 'time entries')} and ${agreements} for ${s.period_label}, and found ${opportunities(live.length)} worth ${money(total)} in total. ${money(split.high.value)} of it is high confidence (${opportunities(split.high.count)}); ${money(split.review.value)} requires review before action (${opportunities(split.review.count)}).`,
    classLine.length ? `By the strength of the claim: ${listJoin(classLine)}.` : '',
    live.length
      ? `Review status: ${num(reviewed)} approved or actioned, ${num(unreviewed)} new or in review. Each opportunity shows its stage.${dismissedCount ? ` ${plural(dismissedCount, 'dismissed opportunity', 'dismissed opportunities')} ${dismissedCount === 1 ? 'is' : 'are'} left out.` : ''}`
      : '',
    topCat ? `The largest type is ${topCat.label.toLowerCase()} (${money(topCat.value)}, ${pct(topCat.share)} of the total).` : '',
    monthly > 0 ? `${money(monthly)} a month recurs: ${recurs.join(', and ')}. That is ${money(monthly * 12)} a year, of which ${money(annualHigh)} is high confidence.` : '',
    worst && worst.margin < target ? `${worst.name} has the weakest modelled margin at ${pct(worst.margin)}, below the ${pct(target)} target, with ${hours(worst.avg_monthly_hours)} of support a month.` : '',
    overlap.value > 0
      ? `These totals include ${money(overlap.value)} at ${overlapNames} (${money(overlap.monthly)} a month) that overlaps with ${overlap.clients.length === 1 ? 'its' : 'their'} agreement gaps: billing those would restore the target margin on its own, so don't count both.`
      : '',
  ].filter(Boolean)

  // Largest value in the period first, as each row shows it.
  const open = [...live].filter((f) => f.status !== 'resolved').sort((a, b) => b.estimated_value - a.estimated_value)
  const listed = open.slice(0, 8)
  const actions = listed.map((f) => {
    const covered = live.filter((o) => o.id !== f.id && f.meta.overlaps?.includes(o.finding_key))
    const settled = covered.find((o) => o.status === 'resolved' || o.status === 'valid')
    const at = covered.map((o) => listed.indexOf(o)).find((i) => i >= 0)
    const note = !covered.length
      ? undefined
      : settled
        ? `Overlaps with its agreement gaps, already ${FINDING_STATUS[settled.status].toLowerCase()}. Billing those should restore the target margin, so check this again after the next analysis.`
        : at != null
          ? `Overlaps with action ${at + 1}: billing that alone restores the ${pct(target)} target margin, so don't count both.`
          : `Overlaps with its agreement gaps: billing those alone restores the ${pct(target)} target margin, so don't count both.`
    return { ref: rowOf.get(f.id)!.ref, client: clientName(f.client_id), action: stripJoiners(f.recommended_action), value: f.estimated_value, note }
  })

  const dc = s.data_counts
  const inputs = [
    { label: 'Analysis run', value: `${dateLong(analysis.created_at)} (ID ${analysis.id.slice(0, 8)})` },
    { label: 'Period', value: `${s.period_label} (${plural(s.months.length, 'month')})` },
    { label: 'Clients', value: num(dc.clients) },
    { label: 'Contracts', value: withContract != null ? `${num(dc.contracts)}, covering ${plural(withContract, 'client')}` : num(dc.contracts) },
    { label: 'Tickets', value: num(dc.tickets) },
    { label: 'Time entries', value: num(dc.time_entries) },
    { label: 'Users and devices', value: num(dc.assets) },
    { label: 'Billing lines', value: num(dc.billing_items) },
  ]
  const gbp = (n: number) => money(n, { decimals: !Number.isInteger(n) })
  const assumptions = [
    { label: 'Billable rate', value: `${gbp(settings.billable_rate_per_hour)} an hour, where the agreement states none` },
    { label: 'Out-of-hours multiplier', value: `× ${num(settings.after_hours_multiplier, 2)}, where the agreement states none` },
    { label: 'Business hours', value: `${settings.business_hours_start} to ${settings.business_hours_end}, where the agreement states none` },
    { label: 'Default prices', value: `${gbp(settings.default_user_price)} per user, ${gbp(settings.default_device_price)} per device a month, where no billing line gives one` },
    { label: 'Labour cost', value: `${gbp(settings.labour_cost_per_hour)} an hour (margin estimates only)` },
    { label: 'Software cost', value: `${gbp(settings.default_software_cost_per_user)} per user a month, where the clients file gives none` },
    { label: 'Target margin', value: pct(settings.target_margin) },
    { label: 'Usage tolerance', value: `${pct(settings.excessive_usage_threshold)} above included hours` },
  ]

  return {
    title: REPORT_TITLE,
    workspace: ws.name,
    period: s.period_label,
    generated: dateLong(new Date().toISOString()),
    isDemo: ws.is_demo,
    analysisId: analysis.id,
    analysisRun: dateLong(analysis.created_at),
    total,
    monthly,
    recurringAgreement,
    recurringPricing,
    annual: monthly * 12,
    split: { high: split.high, review: split.review },
    agreementValue: s.client_metrics.reduce((a, c) => a + c.mrr, 0) * s.months.length,
    months: s.months.length,
    findingCount: live.length,
    dismissedCount,
    targetMargin: target,
    executiveSummary,
    breakdown,
    levels,
    classes,
    stages,
    riskClients,
    top,
    sections,
    evidence,
    // Weakest margin first; clients without MRR go last.
    profitability: metrics.sort((a, b) => Number(b.known) - Number(a.known) || a.margin - b.margin),
    actions,
    overlap,
    inputs,
    assumptions,
    ai: { explained: evidence.filter((r) => r.ai).length, total: evidence.length },
    clientName,
  }
}

// The sentence under the cover figures: what is high confidence and what is not.
export function headlineSentence(r: ReportModel): string {
  if (!r.findingCount) return 'No opportunities were found in this period.'
  if (!r.split.review.count) return `All ${money(r.total)} is high-confidence opportunity, the strongest evidence in your data, still subject to your review.`
  if (!r.split.high.count) return `All ${money(r.total)} requires review before action: none of it is high confidence yet.`
  return `${money(r.split.high.value)} is high-confidence opportunity, the strongest evidence in your data, still subject to your review. A further ${money(r.split.review.value)} requires review before action.`
}

// The closing line, on screen and in the PDF.
export function annualSentence(r: ReportModel): string {
  const high = r.split.high.monthly * 12
  const base = `If the recurring items in this report are confirmed and corrected, the estimated annual opportunity is ${money(r.annual)} (${money(r.monthly)} a month), of which ${money(high)} is high confidence. This is in addition to the ${money(r.total)} identified in ${r.period}.`
  return r.overlap.monthly > 0 ? `${base} Up to ${money(r.overlap.monthly * 12)} a year of it overlaps at ${r.overlap.clients.join(' and ')}.` : base
}

// The AI line, from the data: how many explanations are included, and that no figure came from AI.
export function aiSentence(r: ReportModel): string {
  const used = r.ai.explained
    ? `${plural(r.ai.explained, 'opportunity', 'opportunities')} of ${num(r.ai.total)} include${r.ai.explained === 1 ? 's' : ''} an AI-assisted explanation, labelled as such in the appendix, with the model and the date it was written. It explains wording only.`
    : null
  return used ? `${AI_STATEMENT} ${used}` : NO_AI_STATEMENT
}

export function companyLine(): string | null {
  if (!COMPANY.legalName) return null
  return [`Headroom is a trading name of ${COMPANY.legalName}`, COMPANY.companyNumber ? `, company number ${COMPANY.companyNumber}` : '', COMPANY.registeredIn ? `, registered in ${COMPANY.registeredIn}` : '', '.'].join('')
}

type RGB = [number, number, number]
type Weight = 'normal' | 'bold'

// The PDF: an ink cover band in the product's own colours, then the report on
// paper. Lime only ever sits on ink; on white, money found takes the deep
// accent. Figures are tabular in Host Grotesk by default. The body leads with
// the conservative split and the largest opportunities with their evidence;
// the appendix carries the evidence for every opportunity.
export async function reportPdf(r: ReportModel): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }, brand] = await Promise.all([import('jspdf'), import('jspdf-autotable'), import('./pdfBrand')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const F = brand.registerFonts(doc)
  doc.setProperties({ title: `${r.title}, ${r.workspace}, ${r.period}`, subject: 'Evidence-backed revenue opportunities', author: 'Headroom', creator: 'Headroom' })

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const CW = W - M * 2
  const FOOT = 64 // kept clear for the footer
  const MEASURE = 432 // prose line length, about 80 characters

  // Paper
  const ink = rgb(paper.text)
  const ink2 = rgb(paper.textSecondary)
  const muted = rgb(paper.muted)
  const rule = rgb(paper.border)
  const track = rgb(paper.borderMuted)
  const sunken = rgb(paper.surfaceSunken)
  const found = rgb(color.accentDeep)
  // Health, calm as on screen: one danger dot for At risk beside a neutral
  // label, a hollow ring for Watch, no mark for Healthy.
  const danger = rgb(paper.danger)
  const HEALTH_MARK: Record<Health, { text: RGB; mark: 'dot' | 'ring' | null }> = {
    at_risk: { text: ink2, mark: 'dot' },
    watch: { text: muted, mark: 'ring' },
    healthy: { text: muted, mark: null },
  }
  // Ink band
  const band = rgb(color.ink)
  const bone = rgb(color.bone)
  const bone2 = rgb(color.textSecondary)
  const boneMuted = rgb(color.muted)
  const hairline = rgb(color.border)
  const lime = rgb(color.accent)

  // y is the top of the next block.
  let y = M
  const type = (size: number, weight: Weight, c: RGB) => doc.setFont(F, weight).setFontSize(size).setTextColor(...c)
  const width = (t: string, size: number, weight: Weight = 'normal') => doc.setFont(F, weight).setFontSize(size).getTextWidth(t)
  const fit = (t: string, maxW: number, size: number, min: number, weight: Weight = 'bold') => {
    while (size > min && width(t, size, weight) > maxW) size -= 1
    return size
  }
  const wrap = (t: string, size: number, maxW: number, weight: Weight = 'normal') => doc.setFont(F, weight).setFontSize(size).splitTextToSize(t, maxW) as string[]
  const after = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const ensure = (h: number) => {
    if (y + h > H - FOOT) {
      doc.addPage()
      y = M
    }
  }
  // Runs of differently styled text on one baseline, left or right aligned.
  const runs = (parts: { t: string; size: number; weight?: Weight; c: RGB }[], x: number, base: number, align: 'left' | 'right' = 'left') => {
    let cx = align === 'right' ? x - parts.reduce((a, p) => a + width(p.t, p.size, p.weight), 0) : x
    for (const p of parts) {
      const w = width(p.t, p.size, p.weight)
      doc.setFont(F, p.weight ?? 'normal').setFontSize(p.size).setTextColor(...p.c).text(p.t, cx, base)
      cx += w
    }
  }
  const para = (t: string, o: { size?: number; c?: RGB; w?: number; lead?: number; space?: number; x?: number; weight?: Weight } = {}) => {
    const size = o.size ?? 10
    const lead = o.lead ?? size * 1.5
    for (const ln of wrap(t, size, o.w ?? MEASURE, o.weight)) {
      ensure(lead)
      type(size, o.weight ?? 'normal', o.c ?? ink2).text(ln, o.x ?? M, y + size * 0.78)
      y += lead
    }
    y += o.space ?? 5
  }
  // A sentence whose figures carry their own weight and colour, wrapped by word.
  const statement = (segs: { t: string; bold?: boolean; c?: RGB }[], size: number, lead: number, maxW: number) => {
    const words = segs.flatMap((s) => s.t.split(/(\s+)/).filter(Boolean).map((t) => ({ t, weight: (s.bold ? 'bold' : 'normal') as Weight, c: s.c ?? ink })))
    let x = M
    ensure(lead)
    for (const w of words) {
      const ww = width(w.t, size, w.weight)
      if (/^\s+$/.test(w.t)) {
        if (x > M) x += ww
        continue
      }
      if (x + ww > M + maxW && x > M) {
        y += lead
        ensure(lead)
        x = M
      }
      doc.setFont(F, w.weight).setFontSize(size).setTextColor(...w.c).text(w.t, x, y + size * 0.78)
      x += ww
    }
    y += lead
  }
  // keep: the height to hold with the heading, so short tables never split.
  const h2 = (t: string, right?: string, keep = 0) => {
    if (y > M) y += 24
    ensure(Math.max(104, Math.min(keep, 380)))
    type(13, 'bold', ink).text(t, M, y + 10)
    if (right) type(10, 'bold', found).text(right, W - M, y + 10, { align: 'right' })
    y += 24
  }
  const h3 = (t: string, right?: string) => {
    y += 10
    ensure(90)
    type(10.5, 'bold', ink).text(t, M, y + 9)
    if (right) type(9, 'bold', ink2).text(right, W - M, y + 9, { align: 'right' })
    y += 20
  }

  // health: the column is a client's health label. flag: the row's figure is
  // below target, so it is set bold with a small danger dot before it.
  type Col = { head: string; right?: boolean; width?: number; c?: RGB; bold?: boolean; health?: (row: number) => Health; flag?: (row: number) => boolean }
  const PAD = { top: 5.5, bottom: 5.5, left: 0, right: 10 }
  const HEAD_PAD = { top: 0, bottom: 6, left: 0, right: 10 }
  const table = (cols: Col[], body: string[][], o: { foot?: string[]; size?: number; bar?: { col: number; share: (row: number) => number } } = {}) => {
    const size = o.size ?? 8.5
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: M, bottom: FOOT },
      head: [cols.map((c) => c.head.toUpperCase())],
      body,
      foot: o.foot ? [o.foot] : undefined,
      showFoot: 'lastPage',
      theme: 'plain',
      rowPageBreak: 'avoid',
      styles: { font: F, fontStyle: 'normal', fontSize: size, textColor: ink2, cellPadding: PAD, valign: 'top', overflow: 'linebreak', lineColor: rule, lineWidth: 0 },
      headStyles: { fontStyle: 'bold', fontSize: 6.5, textColor: muted, cellPadding: HEAD_PAD, valign: 'bottom', lineColor: ink, lineWidth: { bottom: 0.75 } },
      bodyStyles: { lineColor: rule, lineWidth: { bottom: 0.4 } },
      footStyles: { fontStyle: 'bold', textColor: ink, lineColor: ink, lineWidth: { top: 0.75 } },
      columnStyles: Object.fromEntries(cols.map((c, i) => [i, { cellWidth: c.width ?? (c.right ? 'wrap' : 'auto') }])),
      didParseCell: (d) => {
        const i = d.column.index
        const c = cols[i]
        const s = d.cell.styles
        if (c.right) s.halign = 'right'
        const pad = { ...(d.section === 'head' ? HEAD_PAD : PAD) }
        if (i === cols.length - 1) pad.right = 0
        if (c.health && d.section === 'body') pad.left = 9
        s.cellPadding = pad
        if (c.width) s.cellWidth = c.width
        if (d.section === 'body') {
          s.textColor = c.health ? HEALTH_MARK[c.health(d.row.index)].text : (c.c ?? (i === 0 || c.right ? ink : ink2))
          if (c.bold || c.flag?.(d.row.index)) s.fontStyle = 'bold'
        }
      },
      didDrawCell: (d) => {
        if (d.section !== 'body') return
        const c = cols[d.column.index]
        const mid = d.cell.y + PAD.top + size * 0.5
        if (c.health) {
          const mark = HEALTH_MARK[c.health(d.row.index)].mark
          if (mark === 'dot') doc.setFillColor(...danger).circle(d.cell.x + 2.5, mid, 2, 'F')
          if (mark === 'ring') doc.setDrawColor(...muted).setLineWidth(0.6).circle(d.cell.x + 2.5, mid, 1.7, 'S')
        }
        if (c.flag?.(d.row.index)) {
          const text = String(d.cell.raw ?? '')
          const right = d.cell.x + d.cell.width - (d.column.index === cols.length - 1 ? 0 : PAD.right)
          const x = c.right ? right - width(text, size, 'bold') - 5 : d.cell.x + PAD.left - 5
          doc.setFillColor(...danger).circle(x, mid, 1.6, 'F')
        }
        if (o.bar && d.column.index === o.bar.col) {
          const x0 = d.cell.x + 4
          const tw = d.cell.width - 4 - 34
          doc.setFillColor(...track).roundedRect(x0, mid - 1.5, tw, 3, 1.5, 1.5, 'F')
          const f = Math.max(0, Math.min(1, o.bar.share(d.row.index)))
          if (f > 0) doc.setFillColor(...muted).roundedRect(x0, mid - 1.5, Math.max(3, tw * f), 3, 1.5, 1.5, 'F')
        }
      },
    })
    y = after() + 4
  }
  // Label and text pairs, with no header row: the evidence of one opportunity,
  // or the inputs an analysis used.
  const pairs = (rows: [string, string][], o: { x?: number; label?: number; size?: number } = {}) => {
    const x = o.x ?? M
    const size = o.size ?? 8.5
    autoTable(doc, {
      startY: y,
      margin: { left: x, right: M, top: M, bottom: FOOT },
      body: rows,
      theme: 'plain',
      rowPageBreak: 'avoid',
      styles: { font: F, fontStyle: 'normal', fontSize: size, textColor: ink2, cellPadding: { top: 3.5, bottom: 3.5, left: 0, right: 10 }, valign: 'top', overflow: 'linebreak', lineColor: rule, lineWidth: 0 },
      columnStyles: { 0: { cellWidth: o.label ?? 92, textColor: muted, fontSize: size - 0.5 }, 1: { cellPadding: { top: 3.5, bottom: 3.5, left: 0, right: 0 } } },
    })
    y = after()
  }

  // Measured: heading 24, label row 18, a one-line row 21.
  const ROW = 21
  const tableH = (rows: number, foot = false) => 24 + 18 + rows * ROW + (foot ? ROW : 0) + 4

  // One opportunity with its evidence: ref, title and value; client, type and
  // result; confidence, classification and stage; then the working.
  const IND = 30
  const evidenceRows = (e: EvidenceRow): [string, string][] => {
    const rows: [string, string][] = [
      ['Calculation', [...e.calc, ...(e.calcNote ? [e.calcNote] : [])].join('\n') || e.result],
      ['Source', e.sources.map((s) => `${s.source}: ${s.detail}`).join('\n') || 'No source records were saved with this opportunity.'],
      ['Confidence basis', e.basis],
      ['Recommendation', e.action],
    ]
    if (e.ai) rows.push(['AI-assisted explanation', `${e.ai.text}\n${[e.ai.model ? `Model ${e.ai.model}` : null, e.ai.generated ? `written ${e.ai.generated}` : null].filter(Boolean).join(', ')}. Wording only: no figure here comes from AI.`])
    return rows
  }
  // The block's height before drawing it, so a page break falls between
  // opportunities, never inside one (unless one is taller than a page).
  const evidenceHeight = (e: EvidenceRow, titleLines: string[]) => {
    const valueW = CW - IND - 88
    const body = evidenceRows(e).reduce((h, [label, value]) => {
      const lines = Math.max(wrap(label, 7.5, 88 - 10).length, value.split('\n').reduce((n, part) => n + wrap(part, 8, valueW).length, 0))
      return h + lines * 8 * 1.15 + 7
    }, 0)
    return 6 + titleLines.length * 13 + 13 + 10 + body + 10
  }
  const evidenceBlock = (e: EvidenceRow) => {
    const titleLines = wrap(e.title, 10, CW - IND - 90, 'bold')
    ensure(Math.min(evidenceHeight(e, titleLines), H - FOOT - M))
    y += 6
    type(8.5, 'bold', muted).text(e.ref, M, y + 8)
    type(10, 'bold', ink).text(titleLines, M + IND, y + 8, { lineHeightFactor: 1.3 })
    type(10, 'bold', ink).text(money(e.value), W - M, y + 8, { align: 'right' })
    y += titleLines.length * 13
    type(8, 'normal', muted).text(wrap(`${e.client}  ·  ${e.categoryLabel}  ·  ${e.result}`, 8, CW - IND)[0], M + IND, y + 6)
    y += 13
    runs(
      [
        { t: CONFIDENCE[e.level].label, size: 8, weight: 'bold', c: ink2 },
        { t: `  ·  ${CLASSIFICATION[e.classification].label}  ·  Stage: `, size: 8, c: muted },
        { t: FINDING_STATUS[e.status], size: 8, weight: 'bold', c: ink2 },
      ],
      M + IND,
      y + 6,
    )
    y += 10
    pairs(evidenceRows(e), { x: M + IND, label: 88, size: 8 })
    y += 6
    doc.setDrawColor(...rule).setLineWidth(0.4).line(M, y, W - M, y)
    y += 4
  }

  // ---------------------------------------------------------------- cover

  // Cover band: High confidence first and on its own, then Requires review,
  // then the total as their labelled sum. The notes under each figure wrap in
  // their own columns, so they are measured before anything is drawn.
  const LABEL = 192
  const BASE = 240
  const NOTE = 258
  const COL1 = M + CW * 0.4
  const COL2 = M + CW * 0.7
  const covers = [
    { x: M, maxW: COL1 - M - 20, label: 'High confidence', value: money(r.split.high.value), c: r.split.high.value > 0 ? lime : bone2, size: 40, note: `${opportunities(r.split.high.count)}${r.split.high.monthly > 0 ? `, ${money(r.split.high.monthly)} a month recurring` : ''}` },
    { x: COL1, maxW: COL2 - COL1 - 16, label: 'Requires review', value: money(r.split.review.value), c: bone, size: 26, note: `${opportunities(r.split.review.count)}${r.split.review.monthly > 0 ? `, ${money(r.split.review.monthly)} a month recurring` : ''}` },
    { x: COL2, maxW: W - M - COL2, label: 'Total potential', value: money(r.total), c: bone, size: 26, note: `High confidence plus requires review, ${r.period}` },
  ].map((st) => {
    const size = fit(st.value, st.maxW, st.size, 14)
    return { ...st, size, lines: wrap(st.note, 8, st.maxW) }
  })
  const noteFoot = Math.max(...covers.map((st) => NOTE + (st.lines.length - 1) * 10))
  const GAP = Math.max(282, noteFoot + 18) // top of the gap bar
  const BAND = GAP + 46
  doc.setFillColor(...band).rect(0, 0, W, BAND, 'F')
  brand.drawMark(doc, M, 56 - 15, 15)
  type(15, 'bold', bone).text('Headroom', M + brand.markAdvance(15), 56, { charSpace: -0.3 })
  if (r.isDemo) {
    const label = 'Demo data'
    const pw = width(label, 8, 'bold') + 16
    doc.setDrawColor(...hairline).setLineWidth(0.75).roundedRect(W - M - pw, 42, pw, 18, 3, 3, 'S')
    type(8, 'bold', bone2).text(label, W - M - pw / 2, 53.8, { align: 'center' })
  }
  const titleSize = fit(r.title, CW, 28, 20)
  type(titleSize, 'bold', bone).text(r.title, M, 118, { charSpace: -titleSize * 0.02 })
  type(10, 'normal', bone2).text(`${r.workspace}  ·  ${r.period}  ·  Generated ${r.generated}`, M, 140)
  doc.setDrawColor(...hairline).setLineWidth(0.5).line(M, 166, W - M, 166)
  for (const st of covers) {
    type(9, 'normal', boneMuted).text(st.label, st.x, LABEL)
    type(st.size, 'bold', st.c).text(st.value, st.x, BASE, { charSpace: -st.size * 0.025 })
    type(8, 'normal', bone2).text(st.lines, st.x, NOTE, { lineHeightFactor: 10 / 8 })
  }

  // The gap: the agreement value over the period, and the potential
  // opportunity on top, with a hairline tick at the junction as on screen.
  if (r.agreementValue > 0) {
    const gy = GAP
    const gh = 12
    const share = r.total / (r.agreementValue + r.total)
    const gw = r.total > 0 ? Math.max(CW * share, CW * 0.015) : 0
    const bw = CW - (gw ? gw + 2 : 0)
    doc.setFillColor(...rgb(viz.series)).roundedRect(M, gy, bw, gh, 2, 2, 'F')
    if (gw) {
      doc.rect(M + bw - 2, gy, 2, gh, 'F')
      doc.setFillColor(...lime).roundedRect(W - M - gw, gy, gw, gh, 2, 2, 'F').rect(W - M - gw, gy, Math.min(2, gw), gh, 'F')
      doc.setDrawColor(...bone2).setLineWidth(0.6).line(M + bw + 1, gy - 4, M + bw + 1, gy + gh + 4)
    }
    runs(
      [
        { t: 'Agreement value over the period ', size: 8, c: boneMuted },
        { t: money(r.agreementValue), size: 8, c: bone2 },
      ],
      M,
      gy + gh + 16,
    )
    runs(
      [
        { t: 'Total potential ', size: 8, c: boneMuted },
        { t: money(r.total), size: 8, weight: 'bold', c: bone },
        { t: `   ${(share * 100).toFixed(1)}%`, size: 8, c: boneMuted },
      ],
      W - M,
      gy + gh + 16,
      'right',
    )
  }

  // ---------------------------------------------------------------- body

  y = BAND + 34
  if (r.split.high.count && r.split.review.count)
    statement(
      [
        { t: money(r.split.high.value), bold: true, c: found },
        { t: ' is high-confidence opportunity, the strongest evidence in your data, still subject to your review. A further ' },
        { t: money(r.split.review.value), bold: true },
        { t: ' requires review before action.' },
      ],
      14,
      21,
      CW,
    )
  else statement([{ t: headlineSentence(r) }], 14, 21, CW)
  y += 4
  // The recurring figures, on one quiet line under the headline.
  if (r.monthly > 0) {
    runs(
      [
        { t: 'Recurring ', size: 9, c: muted },
        { t: `${money(r.monthly)} a month`, size: 9, weight: 'bold', c: ink },
        { t: `  (${money(r.split.high.monthly)} high confidence)    Annualised `, size: 9, c: muted },
        { t: money(r.annual), size: 9, weight: 'bold', c: ink },
        { t: `  (${money(r.split.high.monthly * 12)} high confidence)`, size: 9, c: muted },
      ],
      M,
      y + 8,
    )
    y += 18
  }
  para(DECISION_LINE, { size: 9, c: muted, space: 0 })

  h2('Executive summary')
  r.executiveSummary.forEach((p) => para(p))

  h2('Potential opportunity by type', money(r.total), tableH(r.breakdown.length, true))
  const maxShare = Math.max(0.0001, ...r.breakdown.map((b) => b.share))
  table(
    [{ head: 'Type' }, { head: 'Opportunities', right: true, width: 70 }, { head: 'High confidence', right: true, width: 78 }, { head: 'Potential value', right: true, width: 80 }, { head: 'Share', right: true, width: 110 }],
    r.breakdown.map((b) => [b.label, String(b.count), money(b.high), money(b.value), pct(b.share)]),
    { foot: ['Total', String(r.findingCount), money(r.split.high.value), money(r.total), r.total ? '100%' : '0%'], bar: { col: 4, share: (i) => r.breakdown[i].share / maxShare } },
  )

  // How to read confidence and classification: each level's marks, word and
  // definition, with how many opportunities sit at it, on a sunken panel.
  {
    const PX = 16
    const DEF_X = M + PX + 70
    const DEF_W = CW - PX * 2 - 70 - 96
    const lvl = r.levels.map((l) => ({ ...l, lines: wrap(l.definition, 8, DEF_W) }))
    const cls = r.classes.map((c) => ({ ...c, lines: wrap(c.definition, 8, DEF_W) }))
    const rowsH = (xs: { lines: string[] }[]) => xs.reduce((a, x) => a + x.lines.length * 10.5 + 8, 0)
    const boxH = 22 + 14 + rowsH(lvl) + 12 + 14 + rowsH(cls) + 26
    y += 14
    ensure(boxH + 8)
    doc.setFillColor(...sunken).roundedRect(M, y, CW, boxH, 6, 6, 'F')
    type(9.5, 'bold', ink).text('How to read confidence', M + PX, y + 22)
    let base = y + 22 + 16
    for (const l of lvl) {
      const c = CONFIDENCE[l.level]
      for (let i = 0; i < 3; i++) doc.setFillColor(...(i < c.marks ? ink2 : rule)).circle(M + PX + 2 + i * 5.5, base - 2.8, 1.7, 'F')
      type(8.5, 'bold', ink).text(c.short, M + PX + 22, base)
      type(8, 'normal', ink2).text(l.lines, DEF_X, base, { lineHeightFactor: 10.5 / 8 })
      type(8, 'normal', muted).text(`${opportunities(l.count)}  ·  ${money(l.value)}`, W - M - PX, base, { align: 'right' })
      base += l.lines.length * 10.5 + 8
    }
    base += 6
    type(9.5, 'bold', ink).text('Classification', M + PX, base)
    base += 16
    for (const c of cls) {
      type(8.5, 'bold', ink).text(CLASSIFICATION[c.classification].short, M + PX, base)
      type(8, 'normal', ink2).text(c.lines, DEF_X, base, { lineHeightFactor: 10.5 / 8 })
      type(8, 'normal', muted).text(`${opportunities(c.count)}  ·  ${money(c.value)}`, W - M - PX, base, { align: 'right' })
      base += c.lines.length * 10.5 + 8
    }
    type(8, 'normal', muted).text(CONFIDENCE_NOTE, M + PX, base + 4)
    y += boxH + 4
  }

  h2('Review status', undefined, tableH(r.stages.length, true))
  para('Every opportunity starts as New. Approved means you have checked it; Actioned means it has been billed or the agreement updated. Dismissed opportunities are left out of this report.', { size: 9, space: 8 })
  table(
    [{ head: 'Stage' }, { head: 'Opportunities', right: true, width: 90 }, { head: 'Potential value', right: true, width: 100 }],
    r.stages.map((st) => [st.label, String(st.count), money(st.value)]),
    { foot: ['Total', String(r.findingCount), money(r.total)] },
  )

  if (r.top.length) {
    h2('Largest opportunities, with evidence', undefined, 200)
    para(`The ${r.top.length === 1 ? 'largest opportunity' : `${r.top.length} largest opportunities`}, each with the records it rests on and the calculation behind its value. The appendix shows the same for every opportunity.`, { size: 9, space: 4 })
    r.top.forEach(evidenceBlock)
  }

  h2('Highest risk clients', undefined, tableH(r.riskClients.length))
  table(
    [
      { head: 'Client', width: 128 },
      { head: 'Potential', right: true },
      { head: 'Margin', right: true, flag: (i) => r.riskClients[i].known && r.riskClients[i].margin < r.targetMargin },
      { head: 'Status', width: 64, health: (i) => (r.riskClients[i].known ? r.riskClients[i].status : 'healthy') },
      { head: 'Main reason' },
    ],
    r.riskClients.map((c) => [c.name, money(c.potential), c.known ? pct(c.margin) : '-', c.health, c.reason]),
  )

  for (const s of r.sections) {
    h2(s.title, money(s.value), tableH(s.rows.length) + 40)
    para(s.intro, { size: 9.5, space: 8 })
    table(
      [{ head: 'Ref', width: 26, c: muted }, { head: 'Client', width: 104 }, { head: 'Opportunity' }, { head: 'Confidence', width: 58 }, { head: 'Stage', width: 58 }, { head: 'Value', right: true }],
      [
        ...s.rows.map((x) => [x.ref, x.client, `${x.title}\n${x.result}`, CONFIDENCE[x.level].short, FINDING_STATUS[x.status], money(x.value)]),
        ...(s.more ? [['', '', `+ ${opportunities(s.more.count)} more (${s.more.from} to ${s.more.to} in the appendix)`, '', '', money(s.more.value)]] : []),
      ],
    )
  }

  h2('Client profitability')
  para(`Average month in the period, weakest margin first. Margins are modelled from your labour and software cost settings, not read from your accounts.`, { size: 9, space: 8 })
  table(
    [
      { head: 'Client' },
      { head: 'MRR', right: true },
      { head: 'Labour', right: true },
      { head: 'Software', right: true },
      { head: 'Contribution', right: true },
      { head: 'Margin', right: true, flag: (i) => r.profitability[i].known && r.profitability[i].margin < r.targetMargin },
      { head: 'Hours/mo', right: true },
      { head: 'Status', width: 58, health: (i) => (r.profitability[i].known ? r.profitability[i].health : 'healthy') },
    ],
    r.profitability.map((c) => [
      c.name,
      money(c.mrr),
      money(c.labour_cost),
      money(c.software_cost),
      money(c.contribution),
      c.known ? pct(c.margin) : '-',
      hours(c.avg_monthly_hours),
      c.known ? HEALTH[c.health].label : 'Needs MRR',
    ]),
    { size: 8 },
  )

  h2('Recommended actions')
  para('Opportunities not yet actioned, largest first. Each needs your review before you bill or change an agreement.', { size: 9, space: 8 })
  table(
    [{ head: '#', width: 18, c: muted }, { head: 'Ref', width: 26, c: muted }, { head: 'Client', width: 104 }, { head: 'Action' }, { head: 'Value', right: true }],
    r.actions.map((a, i) => [String(i + 1), a.ref, a.client, a.note ? `${a.action} ${a.note}` : a.action, money(a.value)]),
  )

  // Closing: the annual opportunity, set apart on a sunken panel.
  {
    const sentence = annualSentence(r)
    const PANEL = 20
    const LEFT = 168
    const lines = wrap(sentence, 9.5, CW - PANEL * 2 - LEFT)
    const panelH = Math.max(84, PANEL * 2 + lines.length * 14.5)
    y += 30
    ensure(panelH + 20)
    doc.setFillColor(...sunken).roundedRect(M, y, CW, panelH, 6, 6, 'F')
    type(8.5, 'normal', muted).text('Estimated annual opportunity', M + PANEL, y + PANEL + 7)
    const annualSize = fit(money(r.annual), LEFT - 16, 24, 16)
    type(annualSize, 'bold', ink).text(money(r.annual), M + PANEL, y + PANEL + 36, { charSpace: -annualSize * 0.02 })
    type(8, 'normal', muted).text(`${money(r.split.high.monthly * 12)} high confidence`, M + PANEL, y + PANEL + 52)
    type(9.5, 'normal', ink2).text(lines, M + PANEL + LEFT, y + PANEL + 8, { lineHeightFactor: 1.53 })
    y += panelH + 4
  }

  // ---------------------------------------------------------------- methodology

  h2('Methodology', undefined, 220)
  METHODOLOGY.forEach((p) => para(p, { size: 9.5 }))
  h3('Confidence levels')
  pairs(r.levels.map((l) => [CONFIDENCE[l.level].label, l.definition]), { label: 110 })
  h3('Classification')
  pairs(r.classes.map((c) => [c.label, c.definition]), { label: 110 })
  h3('AI')
  para(aiSentence(r), { size: 9.5 })
  h3('Data analysed')
  pairs(r.inputs.map((x) => [x.label, x.value]), { label: 110 })
  h3('Settings used')
  para('Used only where the records give no value. Each opportunity that relies on one says so in its source and confidence basis.', { size: 9, space: 4 })
  pairs(r.assumptions.map((x) => [x.label, x.value]), { label: 110 })
  h3('Agreement value')
  para(`The agreement value of ${money(r.agreementValue)} on the cover is the monthly agreement value (MRR) in your clients file multiplied by the ${plural(r.months, 'month')} analysed. It is not taken from invoices, so it may differ from your accounts.`, { size: 9.5 })
  y += 6
  para(DISCLAIMER, { size: 8, c: muted, w: CW, lead: 11.5 })
  const company = companyLine()
  if (company) para(`${company} Our Privacy Policy and Terms are published on the Headroom website.`, { size: 8, c: muted, w: CW, lead: 11.5 })

  // ---------------------------------------------------------------- appendix

  if (r.evidence.length) {
    doc.addPage()
    y = M
    type(13, 'bold', ink).text('Appendix: evidence for every opportunity', M, y + 10)
    y += 24
    para(`${opportunities(r.evidence.length)}, grouped by type and largest first. Each shows the records it rests on (agreement clause, or export file and row), the calculation, what its confidence is based on, its stage and the recommendation.`, { size: 9, space: 6 })
    for (const s of r.sections) {
      h3(s.title, money(s.value))
      r.evidence.filter((e) => e.category === s.key).forEach(evidenceBlock)
    }
  }

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const fy = H - 30
    doc.setDrawColor(...rule).setLineWidth(0.4).line(M, fy - 14, W - M, fy - 14)
    brand.drawMark(doc, M, fy - 7.5, 7.5, 'paper')
    type(7.5, 'normal', muted).text(`Headroom  ·  ${r.workspace}  ·  ${r.period}  ·  Figures are calculated, not AI-generated. Review before action.`, M + brand.markAdvance(7.5), fy)
    doc.text(`Page ${i} of ${pages}`, W - M, fy, { align: 'right' })
  }
  return doc.output('blob')
}
