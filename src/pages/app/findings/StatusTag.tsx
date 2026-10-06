import { Check } from 'lucide-react'
import { cx } from '../../../components/ui'
import { FINDING_STATUS } from '../../../lib/labels'
import type { FindingStatus } from '../../../engine/types'

// Finding status, kept calm: most findings are open, so open is the quietest
// state. Confirmed takes info, resolved takes success with a tick, dismissed
// fades back. Every state carries its word, never colour alone.
const STYLE: Record<FindingStatus, { cls: string; mark: 'ring' | 'dot' | 'tick' }> = {
  open: { cls: 'text-ink-2 ring-line', mark: 'ring' },
  valid: { cls: 'bg-info-soft text-info ring-info-line', mark: 'dot' },
  resolved: { cls: 'bg-success-soft text-success ring-success-line', mark: 'tick' },
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
