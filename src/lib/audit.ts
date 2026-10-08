import type { AuditAction, AuditEvent, DismissReason, Finding, FindingStatus } from '../engine/types'
import { confidenceOf } from './confidence'
import { FINDING_STATUS } from './labels'

// The audit log, in words, and the trust metrics computed from findings and
// the log. Pure: no storage, no React.

// ---------------------------------------------------------------- dismiss reasons

export const DISMISS_REASONS: Record<DismissReason, { label: string; hint: string }> = {
  data_wrong: { label: 'The data is wrong', hint: 'A record in the upload is incorrect or out of date.' },
  contract_allows: { label: 'The agreement covers it', hint: 'The contract allows this, so there is nothing to bill.' },
  already_billed: { label: 'Already billed', hint: 'It was invoiced somewhere this data does not show.' },
  goodwill: { label: 'Goodwill', hint: 'Valid, but deliberately not charged.' },
  relationship: { label: 'Commercial decision', hint: 'Valid, but not pursued to protect the relationship.' },
  other: { label: 'Other', hint: 'None of the above. Add a note.' },
}
export const DISMISS_REASON_ORDER: DismissReason[] = ['data_wrong', 'contract_allows', 'already_billed', 'goodwill', 'relationship', 'other']

// Reasons that mean the finding itself was wrong (a false positive), as
// opposed to valid but not pursued.
export const FALSE_POSITIVE_REASONS: readonly DismissReason[] = ['data_wrong', 'contract_allows']

// ---------------------------------------------------------------- building events

export interface Actor {
  id: string | null
  email: string | null
}

type Detail = AuditEvent['detail']

// One audit event. `detail` must hold ids, counts, kinds and stage names
// only: anything else (strings longer than an id, names, text) is dropped
// so client data can't reach the log by accident.
export function auditEvent(
  workspaceId: string,
  actor: Actor,
  action: AuditAction,
  target: { type: string; id: string } | null,
  detail: Detail = {},
  at = new Date().toISOString(),
): AuditEvent {
  return {
    id: crypto.randomUUID(),
    workspace_id: workspaceId,
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
    detail: safeDetail(detail),
    created_at: at,
  }
}

const SAFE_STRING = /^[\w.:,-]{0,64}$/

export function safeDetail(detail: Detail): Detail {
  const out: Detail = {}
  for (const [k, v] of Object.entries(detail)) {
    if (v == null || typeof v === 'number' || typeof v === 'boolean') out[k] = v ?? null
    else if (typeof v === 'string' && SAFE_STRING.test(v)) out[k] = v
  }
  return out
}

// ---------------------------------------------------------------- describing events

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString('en-GB')} ${count === 1 ? one : many}`
const stage = (v: unknown) => (typeof v === 'string' && v in FINDING_STATUS ? FINDING_STATUS[v as FindingStatus] : 'an unknown stage')
const UPLOAD_KIND: Record<string, string> = {
  clients: 'clients',
  tickets: 'tickets',
  time_entries: 'time entries',
  assets: 'users and devices',
  billing: 'billing',
  contract: 'contract',
}
const kindOf = (v: unknown) => (typeof v === 'string' && UPLOAD_KIND[v]) || 'data'

// One plain-English line for an event, without who or when (the caller
// shows those alongside).
export function describeAuditEvent(e: Pick<AuditEvent, 'action' | 'detail'>): string {
  const d = e.detail ?? {}
  switch (e.action) {
    case 'upload.created':
      return d.kind === 'contract' ? `Added a contract${d.file_stored ? ' (original file stored)' : ''}` : `Imported a ${kindOf(d.kind)} file (${plural(n(d.rows), 'row')})`
    case 'upload.deleted': {
      const removed = n(d.tickets) + n(d.time_entries) + n(d.billing_items) + n(d.assets) + n(d.contracts) + n(d.clients)
      return `Deleted a ${kindOf(d.kind)} upload and ${plural(removed, 'record')} it produced`
    }
    case 'analysis.run': {
      const parts = [`${plural(n(d.findings), 'opportunity', 'opportunities')} found`]
      if (n(d.stale)) parts.push(`${n(d.stale)} no longer detected but kept because they had a decision`)
      if (n(d.removed)) parts.push(`${n(d.removed)} no longer detected and removed`)
      return `Ran an analysis: ${parts.join(', ')}`
    }
    case 'analysis.deleted':
      return `Deleted an analysis and its ${plural(n(d.findings), 'opportunity', 'opportunities')}`
    case 'finding.created':
      return `${plural(n(d.count), 'new opportunity', 'new opportunities')} recorded`
    case 'finding.viewed':
      return 'Opened an opportunity for the first time'
    case 'finding.stage_changed':
      return `Moved an opportunity from ${stage(d.from)} to ${stage(d.to)}${d.via === 'task' ? ' by adding a task' : ''}`
    case 'finding.dismissed': {
      const reason = typeof d.reason === 'string' && d.reason in DISMISS_REASONS ? DISMISS_REASONS[d.reason as DismissReason].label.toLowerCase() : 'no reason given'
      return `Dismissed an opportunity: ${reason}`
    }
    case 'finding.reopened':
      return `Reopened an opportunity (was ${stage(d.from)})`
    case 'finding.note':
      return d.cleared ? 'Removed the note on an opportunity' : 'Added or edited a note on an opportunity'
    case 'finding.owner':
      return d.assigned ? 'Assigned an owner to an opportunity' : 'Removed the owner of an opportunity'
    case 'ai.explained':
      return 'Requested an AI-assisted explanation of an opportunity'
    case 'export.pdf':
      return 'Downloaded the PDF report'
    case 'export.csv':
      return `Exported ${plural(n(d.rows), 'opportunity', 'opportunities')} as CSV`
    case 'settings.changed':
      return d.renamed && !n(d.fields) ? 'Renamed the workspace' : `Changed ${plural(n(d.fields), 'setting')}${d.renamed ? ' and renamed the workspace' : ''}`
    case 'data.cleared':
      return 'Cleared all workspace data'
    case 'workspace.deleted':
      return 'Deleted the workspace'
    case 'account.deleted':
      return 'Deleted the account'
  }
}

// ---------------------------------------------------------------- trust metrics

export interface TrustMetrics {
  // Current findings (live, not stale) the rates are measured over.
  total: number
  // Findings with a final decision: Approved, Actioned or Dismissed (stale included).
  decided: number
  // Percentages 0..100 of current findings. 0 when there are none.
  opened_pct: number
  reviewed_pct: number
  dismissed_pct: number
  actioned_pct: number
  // Confirmed valid: Approved or Actioned.
  approved_pct: number
  // Dismissed as wrong (data_wrong or contract_allows) over decided findings,
  // 0..100. null until something has been decided.
  false_positive_rate: number | null
  // Mean value of the findings still counted (not dismissed, not stale).
  avg_opportunity: number
  high_confidence_value: number
  // MEDIUM and LOW confidence: needs the MSP to check before acting.
  requires_review_value: number
  // Value of findings marked Actioned (stale included: the money was acted on).
  recovered_value: number
}

const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0)

// `findings` may include stale ones; they count towards decisions and
// recovered value, never towards current rates or open value. `audit` fills
// in first opens recorded before first_viewed_at existed.
export function trustMetrics(findings: Finding[], audit: Pick<AuditEvent, 'action' | 'target_id'>[]): TrustMetrics {
  const current = findings.filter((f) => !f.stale)
  const viewed = new Set(audit.filter((e) => e.action === 'finding.viewed' && e.target_id).map((e) => e.target_id!))
  const decided = findings.filter((f) => f.status === 'valid' || f.status === 'resolved' || f.status === 'dismissed')
  const wrong = decided.filter((f) => f.status === 'dismissed' && f.dismiss_reason != null && FALSE_POSITIVE_REASONS.includes(f.dismiss_reason))
  const counted = current.filter((f) => f.status !== 'dismissed')
  let high = 0
  let review = 0
  for (const f of counted) {
    if (confidenceOf(f).level === 'HIGH') high += f.estimated_value
    else review += f.estimated_value
  }
  const total = current.length
  const count = (p: (f: Finding) => boolean) => current.filter(p).length
  return {
    total,
    decided: decided.length,
    opened_pct: pct(count((f) => !!f.first_viewed_at || viewed.has(f.id)), total),
    reviewed_pct: pct(count((f) => f.status !== 'open'), total),
    dismissed_pct: pct(count((f) => f.status === 'dismissed'), total),
    actioned_pct: pct(count((f) => f.status === 'resolved'), total),
    approved_pct: pct(count((f) => f.status === 'valid' || f.status === 'resolved'), total),
    false_positive_rate: decided.length ? pct(wrong.length, decided.length) : null,
    avg_opportunity: counted.length ? (high + review) / counted.length : 0,
    high_confidence_value: high,
    requires_review_value: review,
    recovered_value: findings.filter((f) => f.status === 'resolved').reduce((a, f) => a + f.estimated_value, 0),
  }
}
