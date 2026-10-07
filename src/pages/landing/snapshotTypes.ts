import type { Category, ConfidenceLevel, FindingStatus, Health, Severity } from '../../engine/types'

// The shape of the landing page's demo snapshot. The figures are produced by
// running the real engine on the demo dataset (see buildSnapshot.ts), written
// to demoSnapshot.ts, and checked against the engine by demoSnapshot.test.ts,
// so the marketing page shows real numbers without shipping the engine.

export interface SnapshotFinding {
  title: string
  client: string
  category: Category
  severity: Severity
  confidence: number
  // The level the app shows; the percentage above never reaches the page.
  level: ConfidenceLevel
  // true when this overlaps another finding's value (disclosed, not netted)
  overlaps: boolean
  value: number
  monthly: number
  ticketRef: string | null
  workDate: string | null
}

// One logged time entry, as the engine quotes it.
export interface SnapshotTime {
  date: string
  time: string
  technician: string
  duration: string
  billable: boolean
}

// A finding on a single ticket: the ticket, the time logged against it and,
// for out-of-scope work, the contract clause it breaks.
export interface TicketExample {
  finding: SnapshotFinding
  subject: string
  body: string
  ticketHighlights: string[]
  clause: string | null
  clauseHighlights: string[]
  contractTitle: string | null
  time: SnapshotTime
}

export interface LandingSnapshot {
  msp: string
  period: { label: string; months: number; first: string; last: string }
  totals: {
    identified: number
    monthly: number
    annual: number
    findings: number
    clients: number
    atRisk: number
    billed: number
  }
  data: { clients: number; tickets: number; timeEntries: number; usersAndDevices: number; billingLines: number; contracts: number }
  settings: { labourRate: number; billableRate: number; targetMargin: number }
  categories: { category: Category; value: number; count: number; clients: number }[]
  // Opportunities by confidence level, High first.
  levels: { level: ConfidenceLevel; count: number; value: number }[]
  // Opportunities by stage, as the demo workspace opens (see demo/stages.ts).
  stages: { status: FindingStatus; count: number; value: number }[]
  // The ledger in the hero: the highest-value findings, in the engine's order,
  // leaving out any that overlap another (so no pound is shown twice).
  topFindings: SnapshotFinding[]
  // How many findings recur every month, the largest agreement corrections
  // among them, and the recurring findings those rows leave out.
  recurring: { count: number; rows: SnapshotFinding[]; restCount: number; restMonthly: number }
  // The four leak types, each with one concrete demo example.
  leaks: {
    scope: TicketExample
    unbilled: TicketExample
    drift: { finding: SnapshotFinding; contracted: number; active: number; unitPrice: number }
    underpriced: { finding: SnapshotFinding; mrr: number; avgHours: number; margin: number }
  }
  // The product section: the out-of-scope findings table and one finding's evidence.
  outOfScope: { count: number; value: number; rows: SnapshotFinding[] }
  // The calculation is precomputed so the page never loads lib/calculation.
  spotlight: TicketExample & { recommendedAction: string; basis: string; calculation: { lines: string[]; result: string } }
  // The client example, with the contract value its costs call for.
  client: {
    name: string
    package: string | null
    mrr: number
    avgHours: number
    monthlyHours: { month: string; hours: number }[]
    labour: number
    software: number
    contribution: number
    margin: number
    users: number
    contractedUsers: number | null
    devices: number
    contractedDevices: number | null
    health: Health
    leakage: number
    findings: SnapshotFinding[]
    recommended: number
    uplift: number
    driftMonthly: number
    mrrAfterDrift: number
    marginAfterDrift: number
    // true when the margin finding overlaps the client's agreement drift
    overlapNote: boolean
  }
}
