import { Check } from 'lucide-react'
import { cx } from '../../../components/ui'
import { FINDING_STATUS } from '../../../lib/labels'
import type { FindingStatus } from '../../../engine/types'

// Finding status, kept neutral: lists show a tag only once a finding has
// moved on from Open, so the tags that do appear mean something. Confirmed
// takes a filled dot, resolved a tick, dismissed fades back. Every state
// carries its word, never colour alone.
const STYLE: Record<FindingStatus, { cls: string; mark: 'ring' | 'dot' | 'tick' }> = {
  open: { cls: 'text-ink-2 ring-line', mark: 'ring' },
  reviewing: { cls: 'bg-raised text-ink-2 ring-line', mark: 'ring' },
  valid: { cls: 'bg-raised text-ink-2 ring-line', mark: 'dot' },
  resolved: { cls: 'bg-raised text-ink-2 ring-line', mark: 'tick' },
  dismissed: { cls: 'text-ink-3 ring-line-soft', mark: 'dot' },
}

export function FindingStatusTag({ status }: { status: FindingStatus }) {
  const s = STYLE[status]
  return (
    <span className={cx('inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-xs px-1.5 text-[11px] font-medium ring-1 ring-inset', s.cls)}>
      {s.mark === 'tick' ? (
        <Check className="size-3" aria-hidden />
      ) : (
        <span className={cx('size-1.5 rounded-full', s.mark === 'ring' ? 'border border-ink-3' : 'bg-current')} aria-hidden />
      )}
      {FINDING_STATUS[status]}
    </span>
  )
}
