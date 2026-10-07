import { classifyText, isOutsideHours, CATEGORY_NOUNS, OUT_OF_SCOPE_TITLES, type Classification, type WorkCategory } from './classify'
import { extractClauses, type Clause, type ClauseType } from './contractTerms'
import type {
  AnalysisSummary,
  Asset,
  Category,
  Client,
  ClientMetrics,
  Dataset,
  Evidence,
  FindingCalc,
  FindingDraft,
  Health,
  Severity,
  Ticket,
  TimeEntry,
  WorkspaceSettings,
} from './types'

// ---------------------------------------------------------------- helpers

const round = (n: number) => Math.round(n)
const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const monthOf = (iso: string) => iso.slice(0, 7)
const gbp = (n: number) => `£${n.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
const poss = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`)
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export function monthLabel(month: string, style: 'short' | 'long' = 'short'): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleString('en-GB', style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' })
}

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

function severityFor(value: number, confidence: number, category: Category): Severity {
  const levels: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
  let i = value >= 600 ? 3 : value >= 200 ? 2 : value >= 60 ? 1 : 0
  const clearCut = ['OUT_OF_SCOPE', 'AGREEMENT_DRIFT', 'RECURRING_CHARGE_MISMATCH', 'MISSING_LICENSE'].includes(category)
  if (clearCut && confidence >= 90 && i < 2) i++
  if (confidence < 60 && i > 0) i--
  return levels[i]
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

// --------------------------------------------------------------- analysis

export interface AnalysisOutput {
  summary: AnalysisSummary
  findings: FindingDraft[]
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
  const findings: FindingDraft[] = []
  const clientById = new Map(ds.clients.map((c) => [c.id, c]))

  // ----- contract clauses per client
  const clausesByClient = new Map<string, { clauses: Clause[]; text: string; contractIds: string[]; titles: string[] }>()
  for (const c of ds.contracts) {
    const cur = clausesByClient.get(c.client_id) ?? { clauses: [], text: '', contractIds: [], titles: [] }
    cur.clauses.push(...extractClauses(c.text))
    cur.text += '\n' + c.text
    cur.contractIds.push(c.id)
    cur.titles.push(c.title)
    clausesByClient.set(c.client_id, cur)
  }

  // ----- hours per client per month (time entries first, ticket time where no entries)
  const hours = new Map<string, Record<string, number>>()
  const addHours = (clientId: string, month: string, mins: number) => {
    if (!hours.has(clientId)) hours.set(clientId, {})
    const h = hours.get(clientId)!
    h[month] = (h[month] ?? 0) + mins / 60
  }
  const ticketsWithEntries = new Set(ds.time_entries.filter((e) => e.ticket_external_id).map((e) => `${e.client_id}|${e.ticket_external_id}`))
  for (const e of ds.time_entries) addHours(e.client_id, monthOf(e.date), e.minutes)
  for (const t of ds.tickets) if (!ticketsWithEntries.has(`${t.client_id}|${t.external_id}`)) addHours(t.client_id, monthOf(t.date), t.time_spent_minutes)

  // ----- ticket-level rules: out of scope + unbilled
  const items = buildWorkItems(ds.tickets, ds.time_entries, firstMonth, lastMonth)
  for (const item of items) {
    const t = item.ticket
    const client = clientById.get(t.client_id)
    if (!client || item.minutes <= 0) continue
    const text = `${t.subject}. ${t.description ?? ''}`
    const cls: Classification[] = classifyText(text)
    const workTimes = item.entries.length ? item.entries.map((e) => e.date) : [t.date]
    if (workTimes.some((d) => isOutsideHours(d, s.business_hours_start, s.business_hours_end)) && !cls.some((c) => c.category === 'after_hours')) {
      cls.push({ category: 'after_hours', confidence: 90, matches: [] })
    }
    item.afterHours = cls.some((c) => c.category === 'after_hours')
    const contract = clausesByClient.get(t.client_id)
    const ticketEvidence: Evidence = {
      kind: 'ticket',
      label: `Ticket #${t.external_id} · ${t.subject}`,
      text: [t.subject, t.description].filter(Boolean).join('\n\n'),
      highlights: cls.flatMap((c) => c.matches),
    }
    const timeEvidence: Evidence = {
      kind: 'time_entry',
      label: 'Time logged',
      text: item.entries.length
        ? item.entries.map((e) => `${e.date.replace('T', ' ').slice(0, 16)} · ${e.technician ?? 'Unknown'} · ${fmtMinutes(e.minutes)} · ${e.billable ? 'billable' : 'non-billable'}`).join('\n')
        : `${t.date.replace('T', ' ').slice(0, 16)} · ${t.technician ?? 'Unknown'} · ${fmtMinutes(t.time_spent_minutes)} · ${t.billable ? 'billable' : 'non-billable'}`,
    }
    const sources = [
      { table: 'tickets' as const, id: t.id, label: `Ticket #${t.external_id}` },
      ...item.entries.map((e) => ({ table: 'time_entries' as const, id: e.id, label: `Time entry ${e.date.slice(0, 10)}` })),
    ]
    if (item.nonBillableMinutes <= 0) continue
    const multiplier = item.afterHours ? s.after_hours_multiplier : 1
    const rate = s.billable_rate_per_hour * multiplier
    const value = round((item.nonBillableMinutes / 60) * rate)
    if (value < 10) continue
    const month = monthOf(item.workDate)
    // After-hours work is judged against a support window: the contract's,
    // when its clause states the same hours as Settings, otherwise Settings alone.
    const statedHours = !!contract?.clauses.some((cl) => cl.type === 'business_hours' && statesTime(cl.sentence, s.business_hours_start) && statesTime(cl.sentence, s.business_hours_end))
    const calc: FindingCalc = {
      kind: 'time',
      minutes: item.nonBillableMinutes,
      rate,
      base_rate: s.billable_rate_per_hour,
      multiplier,
      after_hours: item.afterHours,
      hours_source: item.afterHours ? (statedHours ? 'contract' : 'settings') : null,
      contract_checked: !!contract,
    }
    const meta = {
      ticket_ref: t.external_id,
      technician: item.entries[0]?.technician ?? t.technician,
      minutes: item.nonBillableMinutes,
      work_date: item.workDate,
      period_values: { [month]: value },
      calc,
    }

    // Out of scope: an explicit contract exclusion matches the work.
    let best: { c: Classification; clause: Clause; conf: number } | null = null
    for (const c of cls) {
      const type = EXCLUDING_CLAUSE[c.category]
      if (!type || !contract) continue
      const clause = contract.clauses.find((cl) => cl.type === type)
      if (!clause) continue
      // After-hours only counts when the work really was outside hours.
      if (c.category === 'after_hours' && !workTimes.some((d) => isOutsideHours(d, s.business_hours_start, s.business_hours_end))) continue
      const conf = Math.min(97, round(c.confidence * 0.7 + 30))
      if (!best || conf > best.conf) best = { c, clause, conf }
    }
    if (best && best.conf >= 60) {
      const noun = CATEGORY_NOUNS[best.c.category]
      findings.push({
        finding_key: `OUT_OF_SCOPE:${t.client_id}:${t.external_id}`,
        client_id: t.client_id,
        category: 'OUT_OF_SCOPE',
        severity: severityFor(value, best.conf, 'OUT_OF_SCOPE'),
        confidence: best.conf,
        title: OUT_OF_SCOPE_TITLES[best.c.category],
        description: `Ticket #${t.external_id} ("${t.subject}") looks like ${noun}, which ${poss(client.name)} agreement excludes or makes chargeable. ${fmtMinutes(item.nonBillableMinutes)} was logged as non-billable${item.afterHours ? ' outside contracted hours' : ''}.`,
        evidence: [
          { kind: 'contract', label: `Contract · ${contract!.titles[0]}`, text: best.clause.sentence, highlights: [best.clause.highlight] },
          ticketEvidence,
          timeEvidence,
        ],
        estimated_value: value,
        monthly_value: 0,
        annual_value: 0,
        recommended_action: `Review whether this ${noun.replace(/^an? /, '')} should be treated as out of scope and charged at your ${item.afterHours ? 'out-of-hours' : 'standard'} rate (${gbp(rate)}/h). If it's a recurring request, agree how it will be billed with ${client.name}.`,
        source_data: [...sources, ...contract!.contractIds.map((id, i) => ({ table: 'contracts' as const, id, label: contract!.titles[i] }))],
        meta: { ...meta, rule: `out_of_scope.${best.c.category}` },
      })
      continue
    }

    // Unbilled: billing mismatch, or typically-billable work logged as non-billable.
    const mismatch = t.billable && item.entries.some((e) => !e.billable)
    const billableCls = cls
      .filter((c) => BILLABLE_TYPE.includes(c.category) && c.confidence >= 60)
      .filter((c) => !(contract && INCLUSION_WORDS[c.category]?.test(contract.text)))
      .filter((c) => c.category !== 'after_hours' || workTimes.some((d) => isOutsideHours(d, s.business_hours_start, s.business_hours_end)))
      .sort((a, b) => b.confidence - a.confidence)[0]
    if (!mismatch && !billableCls) continue
    const conf = mismatch ? 92 : Math.min(78, round(billableCls!.confidence * 0.75))
    const why = mismatch
      ? `The ticket is marked billable but ${fmtMinutes(item.nonBillableMinutes)} of time against it was logged as non-billable.`
      : `This looks like ${CATEGORY_NOUNS[billableCls!.category]}, which MSPs commonly charge for, but all ${fmtMinutes(item.nonBillableMinutes)} was logged as non-billable. ${contract ? "The agreement doesn't say this work is included." : 'No contract has been uploaded for this client, so coverage could not be checked.'}`
    findings.push({
      finding_key: `UNBILLED_TIME:${t.client_id}:${t.external_id}`,
      client_id: t.client_id,
      category: 'UNBILLED_TIME',
      severity: severityFor(value, conf, 'UNBILLED_TIME'),
      confidence: conf,
      title: mismatch ? 'Billable ticket with non-billable time' : `Potentially billable ${CATEGORY_NOUNS[billableCls!.category].replace(/^an? /, '').replace(/^support for (?:an? )?(.*)$/, '$1 support')} logged as non-billable`,
      description: `Ticket #${t.external_id} ("${t.subject}"). ${why}`,
      evidence: [ticketEvidence, timeEvidence],
      estimated_value: value,
      monthly_value: 0,
      annual_value: 0,
      recommended_action: mismatch
        ? 'Correct the time entries to billable and include them on the next invoice.'
        : `Check with the technician whether this work was agreed as included. If not, bill it at ${gbp(rate)}/h and tag similar tickets as billable going forward.`,
      source_data: sources,
      meta: { ...meta, rule: mismatch ? 'unbilled.billing_mismatch' : `unbilled.${billableCls!.category}` },
    })
  }

  // ----- client-level rules
  const assetsByClient = groupBy(ds.assets, (a) => a.client_id)
  const billingByClient = groupBy(ds.billing_items, (b) => b.client_id)

  for (const client of ds.clients) {
    const assets = (assetsByClient.get(client.id) ?? []).filter((a) => a.status === 'active')
    const billing = billingByClient.get(client.id) ?? []
    const users = assets.filter((a) => a.asset_type === 'user')
    const devices = assets.filter((a) => a.asset_type === 'device')
    const userLine = billing.find((b) => /\b(user|seat|per user)\b/i.test(b.service))
    const deviceLine = billing.find((b) => /\b(device|endpoint|workstation|per device)\b/i.test(b.service))

    for (const kind of ['user', 'device'] as const) {
      const list = kind === 'user' ? users : devices
      const contracted = kind === 'user' ? client.contracted_users : client.contracted_devices
      const line = kind === 'user' ? userLine : deviceLine
      const price = line?.unit_price ?? (kind === 'user' ? s.default_user_price : s.default_device_price)
      if (!list.length) continue

      // Billing quantity below contracted quantity
      if (line && contracted != null && line.quantity < contracted) {
        const gap = contracted - line.quantity
        const monthly = round(gap * price)
        const pv = Object.fromEntries(months.map((m) => [m, monthly]))
        findings.push({
          finding_key: `RECURRING_CHARGE_MISMATCH:${client.id}:${kind}`,
          client_id: client.id,
          category: 'RECURRING_CHARGE_MISMATCH',
          severity: severityFor(monthly * months.length, 95, 'RECURRING_CHARGE_MISMATCH'),
          confidence: 95,
          title: `Billing for ${gap} ${kind}${gap === 1 ? '' : 's'} below contracted quantity`,
          description: `${poss(client.name)} agreement covers ${contracted} ${kind}s but the recurring charge "${line.service}" bills ${line.quantity}.`,
          evidence: [
            { kind: 'client', label: 'Agreement', text: `Contracted ${kind}s: ${contracted}` },
            { kind: 'billing', label: 'Billing line', text: `${line.service}: ${line.quantity} × ${gbp(line.unit_price)} = ${gbp(line.monthly_value)}/month` },
          ],
          estimated_value: monthly * months.length,
          monthly_value: monthly,
          annual_value: monthly * 12,
          recommended_action: `Update the "${line.service}" recurring charge to ${contracted} to match the agreement.`,
          source_data: [
            { table: 'clients', id: client.id, label: client.name },
            { table: 'billing_items', id: line.id, label: line.service },
          ],
          meta: { rule: `mismatch.${kind}`, period_values: pv, calc: { kind: 'mismatch', unit: kind, contracted, billed: line.quantity, unit_price: price, price_label: line.service } },
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
        if (extra) pv[m] = round(extra * price)
      }
      const extraNow = list.length - baseline
      if (extraNow <= 0) continue
      const monthly = round(extraNow * price)
      const identified = Object.values(pv).reduce((a, b) => a + b, 0)
      const monthsAffected = Object.keys(pv).length
      const newest = [...list].filter((a) => a.first_seen).sort((a, b) => (b.first_seen! > a.first_seen! ? 1 : -1)).slice(0, extraNow)
      // With no contracted figure the comparison is with what's billed, and the
      // wording says so rather than claiming a contract.
      const byContract = contracted != null
      const gapNote = `${monthsAffected > 1 ? `, and the gap has existed for ${monthsAffected} months of the period analysed` : ''}.`
      findings.push({
        finding_key: `AGREEMENT_DRIFT:${client.id}:${kind}`,
        client_id: client.id,
        category: 'AGREEMENT_DRIFT',
        severity: severityFor(identified, 95, 'AGREEMENT_DRIFT'),
        confidence: 95,
        title: `${extraNow} more ${kind}${extraNow === 1 ? '' : 's'} than ${byContract ? 'contracted' : 'billed'}`,
        description: `${client.name} is ${byContract ? 'contracted' : 'billed'} for ${baseline} ${kind}s but ${list.length} active ${kind}s are being supported. At ${gbp(price)} per ${kind} that's ${gbp(monthly)}/month not on the agreement${gapNote}`,
        evidence: [
          byContract
            ? { kind: 'client', label: 'Agreement', text: `Contracted ${kind}s: ${baseline}${client.package ? ` (${client.package})` : ''}` }
            : { kind: 'billing', label: 'Billing line', text: `Billed ${kind}s: ${baseline} (no contracted figure in your clients file)` },
          {
            kind: 'asset',
            label: `${kind === 'user' ? 'Users' : 'Devices'} list`,
            text: `${list.length} active ${kind}s.${newest.length ? ` Most recently added: ${newest.map((a) => `${a.name} (${a.first_seen})`).join(', ')}.` : ''}`,
          },
          {
            kind: 'billing',
            label: 'Price used',
            text: line ? `${line.service}: ${gbp(line.unit_price)} per ${kind}` : `Workspace default: ${gbp(price)} per ${kind} (no matching billing line)`,
          },
        ],
        estimated_value: identified,
        monthly_value: monthly,
        annual_value: monthly * 12,
        recommended_action: `Review the agreement with ${client.name} and update the recurring charge to ${list.length} ${kind}s (+${gbp(monthly)}/month). ${monthsAffected > 1 ? `Consider whether the ${gbp(identified)} already delivered in the period can be back-billed.` : ''}`.trim(),
        source_data: [
          { table: 'clients', id: client.id, label: client.name },
          ...newest.map((a) => ({ table: 'assets' as const, id: a.id, label: a.name })),
          ...(line ? [{ table: 'billing_items' as const, id: line.id, label: line.service }] : []),
        ],
        meta: {
          rule: `drift.${kind}`,
          period_values: pv,
          calc: {
            kind: 'seats',
            unit: kind,
            baseline,
            baseline_source: byContract ? 'contract' : 'billing',
            actual: list.length,
            unit_price: price,
            price_source: line ? 'billing_line' : 'default',
            price_label: line?.service ?? null,
          },
        },
      })
    }

    // Licences assigned vs licences billed
    const byLicense = groupBy(users.filter((u) => u.license), (u) => u.license!)
    for (const [license, holders] of byLicense) {
      const line = billing.find((b) => norm(b.service).includes(norm(license)) || norm(license).includes(norm(b.service)))
      if (!line || holders.length <= line.quantity) continue
      const gap = holders.length - line.quantity
      const monthly = round(gap * line.unit_price)
      const pv: Record<string, number> = {}
      for (const m of months) {
        const active = holders.filter((a) => !a.first_seen || a.first_seen <= monthEnd(m)).length
        if (active > line.quantity) pv[m] = round((active - line.quantity) * line.unit_price)
      }
      const identified = Object.values(pv).reduce((a, b) => a + b, 0)
      findings.push({
        finding_key: `MISSING_LICENSE:${client.id}:${norm(license)}`,
        client_id: client.id,
        category: 'MISSING_LICENSE',
        severity: severityFor(identified, 93, 'MISSING_LICENSE'),
        confidence: 93,
        title: `${gap} ${license} licence${gap === 1 ? '' : 's'} assigned but not billed`,
        description: `${holders.length} users at ${client.name} are assigned ${license}, but the recurring charge bills ${line.quantity}.`,
        evidence: [
          { kind: 'asset', label: 'Users list', text: `${holders.length} active users with ${license}.` },
          { kind: 'billing', label: 'Billing line', text: `${line.service}: ${line.quantity} × ${gbp(line.unit_price)}` },
        ],
        estimated_value: identified,
        monthly_value: monthly,
        annual_value: monthly * 12,
        recommended_action: `Increase the "${line.service}" quantity to ${holders.length} (+${gbp(monthly)}/month), or remove unused licence assignments.`,
        source_data: [{ table: 'billing_items', id: line.id, label: line.service }],
        meta: { rule: 'license.unbilled', period_values: pv, calc: { kind: 'licence', licence: license, assigned: holders.length, billed: line.quantity, unit_price: line.unit_price, price_label: line.service } },
      })
    }

    // Usage vs included hours / margin
    const h = hours.get(client.id) ?? {}
    const included = client.included_hours ?? clausesByClient.get(client.id)?.clauses.find((c) => c.type === 'included_hours')?.value ?? null
    if (included != null) {
      const pv: Record<string, number> = {}
      const over: string[] = []
      const overByMonth: { month: string; used: number; over: number; value: number }[] = []
      for (const m of months) {
        const used = h[m] ?? 0
        if (used > included * (1 + s.excessive_usage_threshold)) {
          pv[m] = round((used - included) * s.billable_rate_per_hour)
          over.push(`${monthLabel(m, 'long')}: ${r1(used)}h used (${r1(used - included)}h over)`)
          overByMonth.push({ month: m, used: r2(used), over: r2(used - included), value: pv[m] })
        }
      }
      const identified = Object.values(pv).reduce((a, b) => a + b, 0)
      if (identified > 0) {
        const overMonths = Object.keys(pv).length
        const conf = overMonths >= 2 ? 88 : 80
        findings.push({
          finding_key: `EXCESSIVE_USAGE:${client.id}`,
          client_id: client.id,
          category: 'EXCESSIVE_USAGE',
          severity: severityFor(identified, conf, 'EXCESSIVE_USAGE'),
          confidence: conf,
          title: `Support usage above the ${included}h monthly allowance`,
          description: `${poss(client.name)} agreement includes ${included} hours of support a month. Usage went over that in ${overMonths} of the ${months.length} months analysed. No overage charge for those months was found in the data provided, so check whether it was invoiced.`,
          evidence: [
            { kind: 'client', label: 'Agreement', text: `Included support: ${included} hours/month` },
            { kind: 'metric', label: 'Monthly usage', text: over.join('\n') },
          ],
          estimated_value: identified,
          monthly_value: 0,
          annual_value: 0,
          recommended_action: `Bill the overage at ${gbp(s.billable_rate_per_hour)}/h as the agreement allows, or move ${client.name} to a tier with more included hours.`,
          source_data: [{ table: 'clients', id: client.id, label: client.name }],
          meta: {
            rule: 'usage.over_allowance',
            period_values: pv,
            calc: { kind: 'usage', included, included_source: client.included_hours != null ? 'client' : 'contract', rate: s.billable_rate_per_hour, months: overByMonth },
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
        const conf = 82
        // Agreement gaps already found for this client are extra revenue too. If
        // billing them alone restores the target margin, the two overlap: say so
        // rather than netting, so neither figure changes.
        const gaps = findings.filter((f) => f.client_id === client.id && (f.category === 'AGREEMENT_DRIFT' || f.category === 'RECURRING_CHARGE_MISMATCH' || f.category === 'MISSING_LICENSE'))
        const agreementMonthly = gaps.reduce((a, f) => a + f.monthly_value, 0)
        const overlaps = agreementMonthly > 0 && (avgContribution + agreementMonthly) / (mrr + agreementMonthly) >= s.target_margin ? gaps.map((f) => f.finding_key) : []
        findings.push({
          finding_key: `UNDERPRICED_CLIENT:${client.id}`,
          client_id: client.id,
          category: 'UNDERPRICED_CLIENT',
          severity: severityFor(identified, conf, 'UNDERPRICED_CLIENT'),
          confidence: conf,
          title: `Gross margin ${Math.round(margin * 100)}% against a ${Math.round(s.target_margin * 100)}% target`,
          description:
            `${client.name} pays ${gbp(mrr)} a month and averaged ${r1(avgHours)} support hours a month. At ${gbp(s.labour_cost_per_hour)}/h labour plus ${gbp(sw)} software, it earns ${gbp(round(avgContribution))} a month on average against the ${gbp(targetContribution)} a ${pct} margin needs. In the ${belowMonths} month${belowMonths === 1 ? '' : 's'} it fell below target the shortfall totalled ${gbp(identified)}, an average of ${gbp(monthly)} a month across the ${months.length}-month period.` +
            (overlaps.length ? ` Billing the agreement gaps found for ${client.name} (+${gbp(agreementMonthly)} a month) would restore the target margin on its own, so don't count both.` : ''),
          evidence: [
            { kind: 'client', label: 'Contract value', text: `MRR ${gbp(client.monthly_recurring_revenue)}${client.package ? ` · ${client.package}` : ''}` },
            { kind: 'metric', label: 'Support hours', text: months.map((m) => `${monthLabel(m, 'long')}: ${r1(h[m] ?? 0)}h`).join('\n') },
            { kind: 'metric', label: 'Cost basis', text: `Labour ${gbp(s.labour_cost_per_hour)}/h · Software ${gbp(sw)}/month · Target margin ${Math.round(s.target_margin * 100)}%` },
          ],
          estimated_value: identified,
          monthly_value: monthly,
          annual_value: monthly * 12,
          recommended_action: `Review pricing with ${client.name}: at this period's average hours and costs, about ${gbp(targetPrice)}/month (+${gbp(targetPrice - client.monthly_recurring_revenue)}) would restore your ${Math.round(s.target_margin * 100)}% target margin. Alternatively, look at what's driving ticket volume or move them to a higher support tier.`,
          source_data: [{ table: 'clients', id: client.id, label: client.name }],
          meta: {
            rule: 'margin.below_target',
            period_values: pv,
            calc: {
              kind: 'margin',
              mrr,
              labour_rate: s.labour_cost_per_hour,
              software: sw,
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

  // ----- summary
  const by_category: AnalysisSummary['by_category'] = {}
  for (const f of findings) {
    const c = (by_category[f.category] ??= { value: 0, count: 0, clients: 0 })
    c.value += f.estimated_value
    c.count++
  }
  for (const [cat, v] of Object.entries(by_category)) v.clients = new Set(findings.filter((f) => f.category === cat).map((f) => f.client_id)).size

  const trend = months.map((m) => ({
    month: m,
    label: monthLabel(m),
    value: findings.reduce((sum, f) => sum + (f.meta.period_values[m] ?? 0), 0),
  }))

  const client_metrics = computeClientMetrics(ds, findings, hours, months)
  const total_identified = findings.reduce((a, f) => a + f.estimated_value, 0)
  const monthly_recurring = findings.reduce((a, f) => a + f.monthly_value, 0)
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
      period_end: monthEnd(lastMonth),
      period_label: periodLabel(firstMonth, lastMonth),
      months,
      total_identified,
      monthly_recurring,
      annualised: monthly_recurring * 12,
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

export function periodLabel(first: string, last: string): string {
  if (first === last) return monthLabel(first, 'long')
  const sameYear = first.slice(0, 4) === last.slice(0, 4)
  const start = sameYear ? monthLabel(first, 'long').replace(/ \d{4}$/, '') : monthLabel(first, 'long')
  return `${start} – ${monthLabel(last, 'long')}`
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

// Health, reasons and a recommendation for one client from its metrics and the
// findings that still count. Shared by the engine and the live views, so
// dismissing a finding moves the client's health everywhere.
export function liveClientHealth(
  mt: ClientMetrics,
  findings: Pick<FindingDraft, 'category' | 'title' | 'estimated_value'>[],
  settings: Pick<WorkspaceSettings, 'target_margin'>,
  avgAllHours: number,
  months: number,
): { health: Health; reasons: string[]; recommendation: string; leakage: number } {
  const target = settings.target_margin
  const marginKnown = mt.mrr > 0
  const leakage = findings.reduce((a, f) => a + f.estimated_value, 0)
  const below = marginKnown && mt.margin < target
  const reasons: string[] = []
  if (!marginKnown) reasons.push("No monthly recurring revenue recorded, so margin can't be measured")
  if (below) reasons.push(`Margin ${Math.round(mt.margin * 100)}% is below your ${Math.round(target * 100)}% target`)
  if (avgAllHours > 0 && mt.avg_monthly_hours > avgAllHours * 1.5) reasons.push(`${r1(mt.avg_monthly_hours)} support hours/month against a client average of ${r1(avgAllHours)}h`)
  const drift = findings.filter((f) => f.category === 'AGREEMENT_DRIFT' || f.category === 'MISSING_LICENSE' || f.category === 'RECURRING_CHARGE_MISMATCH')
  if (drift.length) reasons.push(drift.map((f) => f.title).join('; '))
  const over = findings.find((f) => f.category === 'EXCESSIVE_USAGE')
  if (over) reasons.push(over.title)
  const oos = findings.filter((f) => f.category === 'OUT_OF_SCOPE' || f.category === 'UNBILLED_TIME').length
  if (oos) reasons.push(`${oos} ticket${oos === 1 ? '' : 's'} with potentially billable work done for free`)
  const periodRevenue = mt.mrr * months
  const leakShare = periodRevenue > 0 ? leakage / periodRevenue : 0
  const health: Health = !marginKnown
    ? 'watch'
    : below || leakShare > 0.08
      ? 'at_risk'
      : mt.margin < target + 0.12 || leakShare > 0.02
        ? 'watch'
        : 'healthy'
  const recommendation = !marginKnown
    ? "Add this client's monthly recurring revenue to measure margin."
    : below
      ? 'Review pricing or move this client to a higher support tier.'
      : over
        ? 'Bill overage hours or move the client to a tier with more included hours.'
        : drift.length
          ? 'Update the recurring charge to match users and devices actually supported.'
          : oos
            ? 'Agree how out-of-scope requests are billed and brief the service desk.'
            : 'No action needed. Keep monitoring.'
  return { health, reasons, recommendation, leakage }
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
