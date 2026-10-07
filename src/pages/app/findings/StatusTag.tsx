import { Check } from 'lucide-react'
import { cx } from '../../../components/ui'
import { ACTION_STATUS, FINDING_STATUS } from '../../../lib/labels'
import type { ActionStatus, FindingStatus } from '../../../engine/types'

// Opportunity stage, kept neutral: lists show a tag only once an opportunity
// has moved on from New, so the tags that do appear mean something. Each stage
// has its own mark, filling up as the work moves on: New is a hollow ring,
// Reviewing a ring with a dot inside, Approved a filled dot, Actioned a tick,
// and Dismissed fades back. Every mark sits beside its word, never alone.
export function StageMark({ status, className }: { status: FindingStatus; className?: string }) {
  if (status === 'resolved') return <Check className={cx('size-3 shrink-0', className)} strokeWidth={2.5} aria-hidden />
  return (
    <svg viewBox="0 0 10 10" className={cx('size-2.5 shrink-0', status === 'dismissed' && 'opacity-50', className)} aria-hidden>
      {status === 'open' || status === 'reviewing' ? (
        <circle cx="5" cy="5" r="3.75" fill="none" stroke="currentColor" strokeWidth="1.3" />
      ) : (
        <circle cx="5" cy="5" r={status === 'valid' ? 4 : 3.5} fill="currentColor" />
      )}
      {status === 'reviewing' && <circle cx="5" cy="5" r="1.6" fill="currentColor" />}
    </svg>
  )
}

const STYLE: Record<FindingStatus, string> = {
  open: 'text-ink-2 ring-line',
  reviewing: 'bg-raised text-ink-2 ring-line',
  valid: 'bg-raised text-ink-2 ring-line',
  resolved: 'bg-raised text-ink-2 ring-line',
  dismissed: 'text-ink-3 ring-line-soft',
}

export function FindingStatusTag({ status }: { status: FindingStatus }) {
  return (
    <span className={cx('inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-xs px-1.5 text-[11px] font-medium ring-1 ring-inset', STYLE[status])}>
      <StageMark status={status} />
      {FINDING_STATUS[status]}
    </span>
  )
}

// Task status dots: shape and colour together, so the state reads without
// colour. Open is a hollow ring, in progress is filled, resolved the success hue.
const TASK_DOT: Record<ActionStatus, string> = {
  open: 'border-[1.5px] border-ink-2',
  in_progress: 'bg-info',
  resolved: 'bg-success',
  dismissed: 'bg-ink-4',
}

export function TaskDot({ status, className }: { status: ActionStatus; className?: string }) {
  return <span className={cx('inline-block size-2 shrink-0 rounded-full', TASK_DOT[status], className)} aria-hidden />
}

export const TASK_STATUS_OPTIONS = Object.entries(ACTION_STATUS) as [ActionStatus, string][]
