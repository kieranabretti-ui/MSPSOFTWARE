import type { ActionStatus, Category, ConfidenceLevel, FindingStatus, Health, Severity } from '../engine/types'

export const CATEGORY_META: Record<Category, { label: string; short: string; blurb: string }> = {
  OUT_OF_SCOPE: { label: 'Out-of-scope work', short: 'Out of scope', blurb: 'Work the agreement excludes, done for free' },
  UNBILLED_TIME: { label: 'Unbilled work', short: 'Unbilled', blurb: 'Potentially billable time logged as non-billable' },
  AGREEMENT_DRIFT: { label: 'Agreement drift', short: 'Drift', blurb: 'More users or devices than the agreement covers' },
  UNDERPRICED_CLIENT: { label: 'Underpriced clients', short: 'Underpriced', blurb: 'Clients below your target margin' },
  EXCESSIVE_USAGE: { label: 'Usage over allowance', short: 'Over allowance', blurb: 'Support beyond included hours' },
  MISSING_LICENSE: { label: 'Unbilled licences', short: 'Licences', blurb: 'Licences assigned but not billed' },
  RECURRING_CHARGE_MISMATCH: { label: 'Billing mismatch', short: 'Mismatch', blurb: 'Recurring charges below the agreement' },
  OTHER: { label: 'Other', short: 'Other', blurb: 'Other commercial anomalies' },
}

export const PRIMARY_CATEGORIES: Category[] = ['OUT_OF_SCOPE', 'UNBILLED_TIME', 'AGREEMENT_DRIFT', 'UNDERPRICED_CLIENT']
export const ALL_CATEGORIES = Object.keys(CATEGORY_META) as Category[]

export const SEVERITY_ORDER: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

// Opportunity stages. Stored values predate the stage names (see engine/types).
export const FINDING_STATUS: Record<FindingStatus, string> = { open: 'New', reviewing: 'Reviewing', valid: 'Approved', resolved: 'Actioned', dismissed: 'Dismissed' }
export const STAGE_ORDER: FindingStatus[] = ['open', 'reviewing', 'valid', 'resolved', 'dismissed']
// The one forward step from each working stage. Actioned and Dismissed have none.
export const NEXT_STAGE: Partial<Record<FindingStatus, { to: FindingStatus; label: string; toast: string }>> = {
  open: { to: 'reviewing', label: 'Start review', toast: 'Moved to Reviewing.' },
  reviewing: { to: 'valid', label: 'Approve', toast: 'Approved.' },
  valid: { to: 'resolved', label: 'Mark actioned', toast: 'Marked as actioned.' },
}

// Confidence is shown as a level with its basis, never as a percentage.
export const CONFIDENCE: Record<ConfidenceLevel, { label: string; short: string; definition: string; marks: number }> = {
  HIGH: { label: 'High confidence', short: 'High', definition: 'Your agreement and your records both support this.', marks: 3 },
  MEDIUM: { label: 'Medium confidence', short: 'Medium', definition: 'Supported by your records, but check it before you act.', marks: 2 },
  LOW: { label: 'Low confidence', short: 'Low', definition: 'A possible opportunity. Verify it by hand before billing.', marks: 1 },
}
export const LEVEL_ORDER: ConfidenceLevel[] = ['HIGH', 'MEDIUM', 'LOW']

// Severity is shown as Priority, on the opportunity page only.
export const PRIORITY_LABEL = 'Priority'

// Recurring money splits into agreement and billing gaps, and pricing.
export const recurringKind = (c: Category): 'agreement' | 'pricing' => (c === 'UNDERPRICED_CLIENT' ? 'pricing' : 'agreement')

export const ACTION_STATUS: Record<ActionStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', dismissed: 'Dismissed' }
// Health stays calm: only At risk takes colour, as one small danger dot beside
// a neutral label. Watch is a hollow ring, Healthy carries no mark at all.
export const HEALTH: Record<Health, { label: string; dot: string; text: string }> = {
  healthy: { label: 'Healthy', dot: 'bg-transparent', text: 'text-ink-3' },
  watch: { label: 'Watch', dot: 'border border-ink-3', text: 'text-ink-3' },
  at_risk: { label: 'At risk', dot: 'bg-danger', text: 'text-ink-2' },
}
