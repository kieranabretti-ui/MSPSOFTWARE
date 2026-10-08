import { analyse } from '../../engine/analyse'
import { buildDemoDataset } from '../../demo/dataset'
import { demoStageOf } from '../../demo/stages'
import { confidenceOf } from '../../lib/confidence'
import { formatCalculation } from '../../lib/calculation'
import { LEVEL_ORDER, STAGE_ORDER } from '../../lib/labels'
import type { Evidence, FindingDraft } from '../../engine/types'
import type { LandingSnapshot, SnapshotFinding, SnapshotTime, TicketExample } from './snapshotTypes'

// Runs the real engine on the demo dataset and keeps only what the landing
// page shows. Used by writeSnapshot.ts (to regenerate demoSnapshot.ts) and by
// demoSnapshot.test.ts (to fail when the snapshot drifts from the engine).
// Never imported by the page itself.

// The demo workspace's name, as the store creates it.
const DEMO_MSP = 'Northlight IT'

// The concrete examples the page tells its story with.
const PICKS = {
  scopeTicket: '18177', // out-of-hours work not charged
  unbilledTicket: '18094', // billable ticket with non-billable time
  spotlightTicket: '18492', // personal device supported free of charge
  driftClient: 'Riverside Care Group',
  underpricedClient: 'Castle Accountancy',
  exampleClient: 'ABC Ltd',
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function must<T>(value: T | undefined | null, what: string): T {
  if (value == null) throw new Error(`Landing snapshot: ${what} not found in the demo analysis`)
  return value
}

const TIME_LINE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) · (.+) · (.+?) · (billable|non-billable)$/
function parseTime(text: string): SnapshotTime {
  const m = must(TIME_LINE.exec(text.split('\n')[0].trim()), `time entry "${text}"`)
  return { date: m[1], time: m[2], technician: m[3], duration: m[4], billable: m[5] === 'billable' }
}

export function buildLandingSnapshot(): LandingSnapshot {
  const ds = buildDemoDataset('landing')
  const { summary: s, findings } = analyse(ds)
  const clientName = (id: string) =>
    must(
      ds.clients.find((c) => c.id === id),
      `client ${id}`,
    ).name

  const lite = (f: FindingDraft): SnapshotFinding => ({
    title: f.title,
    client: clientName(f.client_id),
    category: f.category,
    severity: f.severity,
    confidence: f.confidence,
    level: confidenceOf(f).level,
    overlaps: !!f.meta.overlaps?.length,
    value: f.estimated_value,
    monthly: f.monthly_value,
    ticketRef: f.meta.ticket_ref ?? null,
    workDate: f.meta.work_date ?? null,
  })

  const evidence = (f: FindingDraft, kind: Evidence['kind']) => f.evidence.find((e) => e.kind === kind)

  const ticketExample = (ref: string): TicketExample => {
    const f = must(
      findings.find((x) => x.meta.ticket_ref === ref),
      `finding for ticket #${ref}`,
    )
    const ticket = must(evidence(f, 'ticket'), `ticket evidence for #${ref}`)
    // The clause the finding rests on, not the hourly-rate or support-hours lines it also cites.
    const contract = f.evidence.find((e) => e.kind === 'contract' && e.source === 'agreement' && e.label.startsWith('Agreement'))
    const [subject, ...body] = ticket.text.split('\n\n')
    return {
      finding: lite(f),
      subject,
      body: body.join('\n\n'),
      ticketHighlights: ticket.highlights ?? [],
      clause: contract?.text ?? null,
      clauseHighlights: contract?.highlights ?? [],
      contractTitle: contract ? contract.label.split(' · ').slice(1).join(' · ') || null : null,
      time: parseTime(must(evidence(f, 'time_entry'), `time evidence for #${ref}`).text),
    }
  }

  const byClient = (name: string) => findings.filter((f) => clientName(f.client_id) === name)
  const metrics = (name: string) =>
    must(
      s.client_metrics.find((c) => c.name === name),
      `metrics for ${name}`,
    )

  // Agreement drift example: contracted against active users, at the agreed price.
  const driftFinding = must(
    byClient(PICKS.driftClient).find((f) => f.category === 'AGREEMENT_DRIFT'),
    `drift finding for ${PICKS.driftClient}`,
  )
  const driftClient = must(
    ds.clients.find((c) => c.name === PICKS.driftClient),
    PICKS.driftClient,
  )
  const driftMetrics = metrics(PICKS.driftClient)
  const userLine = must(
    ds.billing_items.find((b) => b.client_id === driftClient.id && /per user/i.test(b.service)),
    `per-user billing line for ${PICKS.driftClient}`,
  )

  // Underpriced example.
  const underFinding = must(
    byClient(PICKS.underpricedClient).find((f) => f.category === 'UNDERPRICED_CLIENT'),
    `underpriced finding for ${PICKS.underpricedClient}`,
  )
  const underMetrics = metrics(PICKS.underpricedClient)

  // Product section: the out-of-scope findings, newest first, as the findings table lists them.
  const oos = findings.filter((f) => f.category === 'OUT_OF_SCOPE')
  const oosRows = [...oos].sort((a, b) => (b.meta.work_date ?? '').localeCompare(a.meta.work_date ?? '')).slice(0, 8)

  const spotlightFinding = must(
    findings.find((f) => f.meta.ticket_ref === PICKS.spotlightTicket),
    `spotlight #${PICKS.spotlightTicket}`,
  )

  // The client example. The recommended contract value is the price at which
  // the client's average labour and software cost leave the target margin.
  const ex = metrics(PICKS.exampleClient)
  const exFindings = byClient(PICKS.exampleClient)
  const exUnder = must(
    exFindings.find((f) => f.category === 'UNDERPRICED_CLIENT'),
    `underpriced finding for ${PICKS.exampleClient}`,
  )
  const hoursText = must(
    exUnder.evidence.find((e) => e.label === 'Support hours'),
    `support hours for ${PICKS.exampleClient}`,
  ).text
  const monthlyHours = hoursText.split('\n').map((line) => {
    const m = must(/^(\w+) \d{4}: ([\d.]+)h$/.exec(line.trim()), `hours line "${line}"`)
    return { month: m[1].slice(0, 3), hours: Number(m[2]) }
  })
  const target = ds.settings.target_margin
  const recommended = Math.round((ex.labour_cost + ex.software_cost) / (1 - target))
  const driftMonthly = exFindings.filter((f) => f.category === 'AGREEMENT_DRIFT').reduce((a, f) => a + f.monthly_value, 0)
  const mrrAfterDrift = ex.mrr + driftMonthly

  const recurring = findings.filter((f) => f.monthly_value > 0).sort((a, b) => b.monthly_value - a.monthly_value)
  // Rows are the agreement and billing corrections; repricing is told through the client example.
  const recurringRows = recurring.filter((f) => f.category !== 'UNDERPRICED_CLIENT').slice(0, 4)
  const recurringRest = recurring.filter((f) => !recurringRows.includes(f))
  const spotlightCalc = must(formatCalculation(spotlightFinding), `calculation for #${PICKS.spotlightTicket}`)
  const sumBy = <K extends string>(keys: readonly K[], keyOf: (f: FindingDraft) => K) =>
    keys.map((k) => {
      const xs = findings.filter((f) => keyOf(f) === k)
      return { count: xs.length, value: xs.reduce((a, f) => a + f.estimated_value, 0) }
    })
  const [first, last] = [s.months[0], s.months[s.months.length - 1]]
  const monthName = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1]

  return {
    msp: DEMO_MSP,
    period: {
      label:
        first.slice(0, 4) === last.slice(0, 4) ? `${monthName(first)} to ${monthName(last)} ${last.slice(0, 4)}` : `${monthName(first)} ${first.slice(0, 4)} to ${monthName(last)} ${last.slice(0, 4)}`,
      months: s.months.length,
      first,
      last,
    },
    totals: {
      identified: s.total_identified,
      monthly: s.monthly_recurring,
      annual: s.annualised,
      findings: s.finding_count,
      clients: s.data_counts.clients,
      atRisk: s.client_metrics.filter((c) => c.health === 'at_risk').length,
      billed: s.client_metrics.reduce((a, c) => a + c.mrr, 0) * s.months.length,
    },
    data: {
      clients: s.data_counts.clients,
      tickets: s.data_counts.tickets,
      timeEntries: s.data_counts.time_entries,
      usersAndDevices: s.data_counts.assets,
      billingLines: s.data_counts.billing_items,
      contracts: s.data_counts.contracts,
    },
    settings: { labourRate: ds.settings.labour_cost_per_hour, billableRate: ds.settings.billable_rate_per_hour, targetMargin: target },
    categories: Object.entries(s.by_category)
      .map(([category, v]) => ({ category: category as SnapshotFinding['category'], value: v.value, count: v.count, clients: v.clients }))
      .sort((a, b) => b.value - a.value),
    levels: sumBy(LEVEL_ORDER, (f) => confidenceOf(f).level).map((x, i) => ({ level: LEVEL_ORDER[i], ...x })),
    stages: sumBy(STAGE_ORDER, (f) => demoStageOf(f, clientName)).map((x, i) => ({ status: STAGE_ORDER[i], ...x })),
    // The app's own order (highest value first), overlaps included and flagged.
    topFindings: [...findings]
      .sort((a, b) => b.estimated_value - a.estimated_value)
      .slice(0, 5)
      .map(lite),
    recurring: {
      count: recurring.length,
      rows: recurringRows.map(lite),
      restCount: recurringRest.length,
      restMonthly: recurringRest.reduce((a, f) => a + f.monthly_value, 0),
    },
    leaks: {
      scope: ticketExample(PICKS.scopeTicket),
      unbilled: ticketExample(PICKS.unbilledTicket),
      drift: {
        finding: lite(driftFinding),
        contracted: must(driftClient.contracted_users, 'contracted users'),
        active: driftMetrics.users,
        unitPrice: userLine.unit_price,
      },
      underpriced: { finding: lite(underFinding), mrr: underMetrics.mrr, avgHours: underMetrics.avg_monthly_hours, margin: Math.round(underMetrics.margin * 1000) / 1000 },
    },
    outOfScope: { count: oos.length, value: oos.reduce((a, f) => a + f.estimated_value, 0), rows: oosRows.map(lite) },
    spotlight: {
      ...ticketExample(PICKS.spotlightTicket),
      recommendedAction: spotlightFinding.recommended_action,
      basis: confidenceOf(spotlightFinding).basis,
      calculation: { lines: spotlightCalc.lines, result: spotlightCalc.result },
    },
    client: {
      name: ex.name,
      package: ex.package,
      mrr: ex.mrr,
      avgHours: ex.avg_monthly_hours,
      monthlyHours,
      labour: ex.labour_cost,
      software: ex.software_cost,
      contribution: ex.contribution,
      margin: Math.round(ex.margin * 1000) / 1000,
      users: ex.users,
      contractedUsers: ex.contracted_users,
      devices: ex.devices,
      contractedDevices: ex.contracted_devices,
      health: ex.health,
      leakage: ex.leakage,
      findings: exFindings.map(lite),
      recommended,
      uplift: recommended - ex.mrr,
      driftMonthly,
      mrrAfterDrift,
      marginAfterDrift: Math.round(((mrrAfterDrift - ex.labour_cost - ex.software_cost) / mrrAfterDrift) * 1000) / 1000,
      overlapNote: exFindings.some((f) => !!f.meta.overlaps?.length),
    },
  }
}

export function renderSnapshotModule(snapshot: LandingSnapshot): string {
  return [
    '// Generated by src/pages/landing/writeSnapshot.ts from the demo dataset and the',
    '// real engine. Do not edit by hand: run `npx tsx src/pages/landing/writeSnapshot.ts`.',
    '// demoSnapshot.test.ts fails if this drifts from the engine.',
    "import type { LandingSnapshot } from './snapshotTypes'",
    '',
    `export const DEMO: LandingSnapshot = ${JSON.stringify(snapshot, null, 2)}`,
    '',
  ].join('\n')
}
