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
}

export interface BillingItem {
  id: string
  workspace_id: string
  client_id: string
  service: string
  quantity: number
  unit_price: number
  monthly_value: number
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

export interface Evidence {
  kind: 'ticket' | 'contract' | 'time_entry' | 'billing' | 'asset' | 'metric' | 'client'
  label: string
  text: string
  highlights?: string[]
}

export interface SourceRef {
  table: 'tickets' | 'time_entries' | 'contracts' | 'billing_items' | 'assets' | 'clients'
  id: string
  label: string
}

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
    }
  | {
      kind: 'seats'
      unit: 'user' | 'device'
      baseline: number
      baseline_source: 'contract' | 'billing'
      actual: number
      unit_price: number
      price_source: 'billing_line' | 'default'
      price_label: string | null
    }
  | { kind: 'mismatch'; unit: 'user' | 'device'; contracted: number; billed: number; unit_price: number; price_label: string }
  | { kind: 'licence'; licence: string; assigned: number; billed: number; unit_price: number; price_label: string }
  | {
      kind: 'usage'
      included: number
      included_source: 'client' | 'contract'
      rate: number
      // used and over are rounded to 2dp; value matches period_values
      months: { month: string; used: number; over: number; value: number }[]
    }
  | {
      kind: 'margin'
      mrr: number
      labour_rate: number
      software: number
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
}

export interface Finding extends FindingDraft {
  id: string
  workspace_id: string
  analysis_id: string
  status: FindingStatus
  ai_explanation: string | null
  created_at: string
  updated_at: string
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
