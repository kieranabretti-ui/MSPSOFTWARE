// Domain types. Field names are snake_case so they map 1:1 onto the Postgres
// tables in supabase/migrations.

export type Category =
  | 'OUT_OF_SCOPE'
  | 'UNBILLED_TIME'
  | 'AGREEMENT_DRIFT'
  | 'MISSING_LICENSE'
  | 'UNDERPRICED_CLIENT'
  | 'EXCESSIVE_USAGE'
  | 'RECURRING_CHARGE_MISMATCH'
  | 'OTHER'

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
// Opportunity stages. The stored values predate the stage names, so they map
// to labels in lib/labels: open = New, reviewing = Reviewing, valid =
// Approved, resolved = Actioned, dismissed = Dismissed.
export type FindingStatus = 'open' | 'reviewing' | 'valid' | 'dismissed' | 'resolved'
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type ActionStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'

export interface WorkspaceSettings {
  currency: 'GBP'
  labour_cost_per_hour: number
  billable_rate_per_hour: number
  after_hours_multiplier: number
  default_user_price: number
  default_device_price: number
  default_software_cost_per_user: number
  target_margin: number // 0..1
  excessive_usage_threshold: number // 0..1 tolerance above included hours
  business_hours_start: string // "08:30"
  business_hours_end: string // "17:30"
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  currency: 'GBP',
  labour_cost_per_hour: 35,
  billable_rate_per_hour: 60,
  after_hours_multiplier: 1.5,
  default_user_price: 18,
  default_device_price: 8,
  default_software_cost_per_user: 9,
  target_margin: 0.3,
  excessive_usage_threshold: 0.1,
  business_hours_start: '08:30',
  business_hours_end: '17:30',
}

export interface Workspace {
  id: string
  name: string
  settings: WorkspaceSettings
  is_demo: boolean
  created_at: string
}

// Where an imported row came from: the upload (file) it was read from and
// its row in that file (the header is row 1). Null for rows typed in by hand
// or saved before provenance existed.
export interface Provenance {
  upload_id: string | null
  file_name: string | null
  row: number | null
}

export interface Client {
  id: string
  workspace_id: string
  name: string
  monthly_recurring_revenue: number
  contracted_users: number | null
  contracted_devices: number | null
  package: string | null
  contract_start: string | null
  contract_end: string | null
  included_hours: number | null
  monthly_software_cost: number | null
  created_at: string
  source?: Provenance | null
}

export interface Contract {
  id: string
  workspace_id: string
  client_id: string
  title: string
  text: string
  upload_id: string | null
  created_at: string
}

export interface Ticket {
  id: string
  workspace_id: string
  client_id: string
  external_id: string
  date: string // ISO, local time without zone e.g. 2026-09-14T21:30:00
  technician: string | null
  subject: string
  description: string | null
  status: string | null
  time_spent_minutes: number
  billable: boolean
  source?: Provenance | null
}

export interface TimeEntry {
  id: string
  workspace_id: string
  client_id: string
  ticket_external_id: string | null
  date: string
  technician: string | null
  minutes: number
  billable: boolean
  source?: Provenance | null
}

export interface BillingItem {
  id: string
  workspace_id: string
  client_id: string
  service: string
  quantity: number
  unit_price: number
  monthly_value: number
  source?: Provenance | null
}

export interface Asset {
  id: string
  workspace_id: string
  client_id: string
  asset_type: 'user' | 'device'
  name: string
  ownership: 'company' | 'personal' | null
  license: string | null
  status: 'active' | 'inactive'
  first_seen: string | null
  source?: Provenance | null
}

export type UploadKind = 'clients' | 'tickets' | 'time_entries' | 'assets' | 'billing' | 'contract'

export interface Upload {
  id: string
  workspace_id: string
  kind: UploadKind
  file_name: string
  row_count: number
  status: 'imported' | 'failed'
  storage_path: string | null
  mapping: Record<string, string> | null
  warnings: string[]
  created_at: string
}

// Which system an evidence line comes from, so the UI can group it
// (Agreement / PSA / Billing ...). 'client_record' is the MSP's own clients
// file, which is not the signed agreement; 'derived' is a computed figure.
export type EvidenceSource = 'agreement' | 'psa' | 'billing' | 'asset_register' | 'client_record' | 'settings' | 'derived'

export interface Evidence {
  kind: 'ticket' | 'contract' | 'time_entry' | 'billing' | 'asset' | 'metric' | 'client'
  label: string
  text: string
  highlights?: string[]
  source?: EvidenceSource
  // The records this line was read from.
  refs?: SourceRef[]
  // For source 'settings': the WorkspaceSettings keys the line reports.
  setting_keys?: (keyof WorkspaceSettings)[]
}

export interface SourceRef {
  table: 'tickets' | 'time_entries' | 'contracts' | 'billing_items' | 'assets' | 'clients'
  id: string
  label: string
  // Traceability back to the file: CSV upload and row, or contract section and page.
  upload_id?: string | null
  file_name?: string | null
  row?: number | null
  section?: string | null
  page?: number | null
}

// A finding's statements, kept apart so a fact is never blended with an
// interpretation. fact: read straight from a record. observation: a
// deterministic comparison of facts. interpretation: what it may mean
// (ai: true when AI-assisted). recommendation: what the MSP could do.
export type ClaimType = 'fact' | 'observation' | 'interpretation' | 'recommendation'
export interface Claim {
  type: ClaimType
  text: string
  ai?: boolean
}

// How firmly a finding is stated. confirmed: a deterministic discrepancy
// between records. potential: likely, needs the MSP to verify. investigate:
// the evidence is incomplete or the value is modelled.
export type FindingClass = 'confirmed' | 'potential' | 'investigate'


// The inputs behind a finding's value, so the UI can show the sum and the
// confidence basis without re-running the engine. One shape per rule family.
export type FindingCalc =
  | {
      kind: 'time'
      minutes: number
      rate: number
      base_rate: number
      multiplier: number
      after_hours: boolean
      // Where the support window came from; null unless the work was after hours.
      hours_source: 'contract' | 'settings' | null
      contract_checked: boolean
      // Where the hourly rate (and out-of-hours multiplier) came from: stated in
      // the client's agreement, or the Settings default. Optional for old rows.
      rate_source?: 'contract' | 'settings'
      // How closely the ticket wording matched the kind of work.
      match?: 'strong' | 'loose'
    }
  | {
      kind: 'seats'
      unit: 'user' | 'device'
      baseline: number
      // contract: stated in an uploaded agreement. client_record: only the
      // contracted column of the clients file. billing: no contracted figure,
      // so the billed quantity.
      baseline_source: 'contract' | 'client_record' | 'billing'
      // The clients file states a different contracted figure from the agreement.
      baseline_conflict?: number | null
      actual: number
      unit_price: number
      price_source: 'billing_line' | 'default'
      price_label: string | null
      // More than one billing line could be the per-unit charge; the lowest was used.
      price_ambiguous?: boolean
      price_candidates?: string[]
      // Active assets with no first-seen date (counted as present all period).
      undated?: number
    }
  | {
      kind: 'mismatch'
      unit: 'user' | 'device'
      contracted: number
      contracted_source?: 'contract' | 'client_record'
      billed: number
      unit_price: number
      price_label: string
      price_ambiguous?: boolean
    }
  | {
      kind: 'missing'
      unit: 'user' | 'device'
      contracted: number
      contracted_source: 'contract' | 'client_record'
      unit_price: number
      price_source: 'default'
    }
  | {
      kind: 'licence'
      licence: string
      assigned: number
      billed: number
      unit_price: number
      price_label: string
      // exact: the licence name and billing line name are the same once
      // normalised. partial: one contains the other.
      match?: 'exact' | 'partial'
    }
  | {
      kind: 'usage'
      included: number
      included_source: 'client' | 'contract'
      // The agreement states the same allowance as the clients file.
      included_confirmed?: boolean
      rate: number
      rate_source?: 'contract' | 'settings'
      // true when only non-billable time is counted against the allowance.
      non_billable_only?: boolean
      // used and over are rounded to 2dp; value matches period_values
      months: { month: string; used: number; over: number; value: number }[]
    }
  | {
      kind: 'margin'
      mrr: number
      labour_rate: number
      software: number
      // where the software cost came from: the client record, or the per-user default in Settings
      software_source?: 'client' | 'default'
      target_margin: number
      avg_hours: number
      avg_contribution: number
      target_contribution: number
      shortfall: { month: string; value: number }[]
      months: number
      target_price: number
    }

export interface FindingMeta {
  ticket_ref?: string
  technician?: string | null
  minutes?: number
  work_date?: string
  rule: string
  // value attributed to each month (YYYY-MM) of the analysis window
  period_values: Record<string, number>
  // Optional so findings saved before these existed still load.
  calc?: FindingCalc
  // finding_keys of other findings this one overlaps with (not netted)
  overlaps?: string[]
}

export interface FindingDraft {
  finding_key: string
  client_id: string
  category: Category
  severity: Severity
  confidence: number // 0..100
  title: string
  description: string
  evidence: Evidence[]
  estimated_value: number
  monthly_value: number
  annual_value: number
  recommended_action: string
  source_data: SourceRef[]
  meta: FindingMeta
  claims?: Claim[]
  classification?: FindingClass
}

export interface Finding extends FindingDraft {
  id: string
  workspace_id: string
  analysis_id: string
  status: FindingStatus
  ai_explanation: string | null
  // Written by the ai-review function only: which model, when, and a hash of
  // the evidence it saw (so a changed finding shows the explanation as stale).
  ai_meta?: { model: string; generated_at: string; evidence_hash: string } | null
  // The MSP's decision. "The software recommends. The MSP decides."
  dismiss_reason?: DismissReason | null
  decision_note?: string | null
  owner?: string | null
  decided_at?: string | null
  first_viewed_at?: string | null
  // No longer reproduced by the latest analysis; kept because a person decided on it.
  stale?: boolean
  created_at: string
  updated_at: string
}

export type DismissReason = 'goodwill' | 'already_billed' | 'data_wrong' | 'contract_allows' | 'relationship' | 'other'

export type AuditAction =
  | 'upload.created'
  | 'upload.deleted'
  | 'analysis.run'
  | 'analysis.deleted'
  | 'finding.created'
  | 'finding.viewed'
  | 'finding.stage_changed'
  | 'finding.dismissed'
  | 'finding.reopened'
  | 'finding.note'
  | 'finding.owner'
  | 'ai.explained'
  | 'export.pdf'
  | 'export.csv'
  | 'settings.changed'
  | 'data.cleared'
  | 'workspace.deleted'
  | 'account.deleted'

// Append-only record of who did what. Never holds client data values (no
// names, ticket text or pounds); only ids, counts and stage names.
export interface AuditEvent {
  id: string
  workspace_id: string
  actor_id: string | null
  actor_email: string | null
  action: AuditAction
  target_type: string | null
  target_id: string | null
  detail: Record<string, string | number | boolean | null>
  created_at: string
}

export interface Action {
  id: string
  workspace_id: string
  finding_id: string | null
  client_id: string | null
  title: string
  notes: string | null
  status: ActionStatus
  value: number
  created_at: string
  updated_at: string
}

export type Health = 'healthy' | 'watch' | 'at_risk'

export interface ClientMetrics {
  client_id: string
  name: string
  package: string | null
  mrr: number
  software_cost: number
  avg_monthly_hours: number
  latest_month_hours: number
  labour_cost: number // avg monthly
  contribution: number // avg monthly
  margin: number // 0..1
  revenue_per_hour: number | null
  users: number
  devices: number
  contracted_users: number | null
  contracted_devices: number | null
  leakage: number
  finding_count: number
  health: Health
  reasons: string[]
  recommendation: string
  // false when the client has no MRR, so margin can't be measured
  margin_known?: boolean
  // monthly price that restores the target margin at average cost
  target_price?: number | null
}

export interface AnalysisCoverage {
  clients: number
  clients_with_contract: number
  clients_with_mrr: number
  clients_with_assets: number
  // time entries with a ticket number that matches no ticket for that client
  time_entries_unmatched: number
}

export interface MonthPoint {
  month: string // YYYY-MM
  label: string
  value: number
}

export interface AnalysisSummary {
  period_start: string
  period_end: string
  period_label: string
  months: string[]
  total_identified: number
  monthly_recurring: number
  annualised: number
  finding_count: number
  by_category: Record<string, { value: number; count: number; clients: number }>
  trend: MonthPoint[]
  client_metrics: ClientMetrics[]
  average_monthly_hours: number
  data_counts: { clients: number; tickets: number; time_entries: number; assets: number; billing_items: number; contracts: number }
  // Optional so analyses saved before these existed still render.
  finding_keys?: string[]
  coverage?: AnalysisCoverage
  settings?: WorkspaceSettings
}

export interface Analysis {
  id: string
  workspace_id: string
  period_start: string
  period_end: string
  summary: AnalysisSummary
  created_at: string
}

export interface Report {
  id: string
  workspace_id: string
  analysis_id: string
  title: string
  period_label: string
  created_at: string
}

export interface Dataset {
  settings: WorkspaceSettings
  clients: Client[]
  contracts: Contract[]
  tickets: Ticket[]
  time_entries: TimeEntry[]
  billing_items: BillingItem[]
  assets: Asset[]
}
