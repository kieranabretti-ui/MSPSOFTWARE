import type { Category, Severity } from '../../engine/types'

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
  // The ledger in the hero: the highest-value findings, in the engine's order.
  topFindings: SnapshotFinding[]
  // How many findings recur every month, and the largest agreement corrections among them.
  recurring: { count: number; rows: SnapshotFinding[] }
  // The four leak types, each with one concrete demo example.
  leaks: {
    scope: TicketExample
    unbilled: TicketExample
    drift: { finding: SnapshotFinding; contracted: number; active: number; unitPrice: number }
    underpriced: { finding: SnapshotFinding; mrr: number; avgHours: number; margin: number }
  }
  // The product section: the out-of-scope findings table and one finding's evidence.
  outOfScope: { count: number; value: number; rows: SnapshotFinding[] }
  spotlight: TicketExample & { recommendedAction: string }
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
    leakage: number
    findings: SnapshotFinding[]
    recommended: number
    uplift: number
    driftMonthly: number
    mrrAfterDrift: number
    marginAfterDrift: number
  }
}
