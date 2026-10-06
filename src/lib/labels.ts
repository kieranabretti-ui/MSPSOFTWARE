import type { ActionStatus, Category, FindingStatus, Health, Severity } from '../engine/types'

export const CATEGORY_META: Record<Category, { label: string; short: string; blurb: string }> = {
  OUT_OF_SCOPE: { label: 'Out-of-scope work', short: 'Out of scope', blurb: 'Work the agreement excludes, done for free' },
  UNBILLED_TIME: { label: 'Unbilled work', short: 'Unbilled', blurb: 'Potentially billable time logged as non-billable' },
  AGREEMENT_DRIFT: { label: 'Agreement drift', short: 'Drift', blurb: 'More users or devices than the agreement covers' },
  UNDERPRICED_CLIENT: { label: 'Underpriced clients', short: 'Underpriced', blurb: 'Clients below your target margin' },
  EXCESSIVE_USAGE: { label: 'Excessive usage', short: 'Over allowance', blurb: 'Support beyond included hours' },
  MISSING_LICENSE: { label: 'Unbilled licences', short: 'Licences', blurb: 'Licences assigned but not billed' },
  RECURRING_CHARGE_MISMATCH: { label: 'Billing mismatch', short: 'Mismatch', blurb: 'Recurring charges below the agreement' },
  OTHER: { label: 'Other', short: 'Other', blurb: 'Other commercial anomalies' },
}

export const PRIMARY_CATEGORIES: Category[] = ['OUT_OF_SCOPE', 'UNBILLED_TIME', 'AGREEMENT_DRIFT', 'UNDERPRICED_CLIENT']
export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as Category[]

export const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export const FINDING_STATUS: Record<FindingStatus, string> = { open: 'Open', valid: 'Confirmed', dismissed: 'Dismissed', resolved: 'Resolved' }
export const ACTION_STATUS: Record<ActionStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', dismissed: 'Dismissed' }
export const HEALTH: Record<Health, { label: string; dot: string; text: string }> = {
  healthy: { label: 'Healthy', dot: 'bg-success', text: 'text-success' },
  watch: { label: 'Watch', dot: 'bg-warning', text: 'text-warning' },
  at_risk: { label: 'At risk', dot: 'bg-danger', text: 'text-danger' },
}
