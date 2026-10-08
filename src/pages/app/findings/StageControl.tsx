import { useState } from 'react'
import { Check, CircleX, RotateCcw } from 'lucide-react'
import { useStore } from '../../../data/store'
import { Button, cx } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { mapError } from '../../../lib/errors'
import { FINDING_STATUS, NEXT_STAGE } from '../../../lib/labels'
import { DISMISS_REASONS } from '../../../lib/audit'
import type { Finding, FindingStatus } from '../../../engine/types'
import { StageMark } from './StatusTag'
import DismissDialog from './DismissDialog'

// The working stages in order. Dismissed sits outside the line.
const STEPS: FindingStatus[] = ['open', 'reviewing', 'valid', 'resolved']

export { DISMISSED_TOAST } from './DismissDialog'
export const REOPENED_TOAST = 'Reopened as New.'

// Where an opportunity is, and the one step that moves it on. The stepper is
// a list with a word on every step; done steps carry a tick, the current one
// is marked for screen readers. It runs across when there's room for every
// word and down when there isn't, so no stage name is ever cut short. The next step is the page's one lime action;
// Dismiss (which always asks for a reason) and Reopen stay quiet beside it.
export function StageControl({ finding: f, via }: { finding: Finding; via: 'detail' | 'queue' }) {
  const { setFindingDecision } = useStore()
  const toast = useToast()
  const [pending, setPending] = useState<FindingStatus | null>(null)
  const [dismissing, setDismissing] = useState(false)
  const next = NEXT_STAGE[f.status]
  const at = STEPS.indexOf(f.status)
  const dismissed = f.status === 'dismissed'

  const move = async (to: FindingStatus, message: string) => {
    setPending(to)
    try {
      await setFindingDecision(f.id, { status: to }, via)
      toast(message)
    } catch (e) {
      toast(mapError(e, 'finding'), 'error')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="@container">
      <ol className="grid gap-1 @2xs:grid-cols-4 @2xs:gap-1.5" aria-label="Stages">
        {STEPS.map((s, i) => {
          const done = !dismissed && i < at
          const current = i === at
          return (
            <li key={s} aria-current={current ? 'step' : undefined} className="flex min-w-0 items-center gap-3 @2xs:block">
              <span className={cx('block h-5 w-1 shrink-0 rounded-full @2xs:h-1 @2xs:w-auto', current ? 'bg-ink' : done ? 'bg-ink-3' : 'bg-line-strong')} aria-hidden />
              <span className={cx('flex min-w-0 items-center gap-1 text-caption @2xs:mt-2', current ? 'font-semibold text-ink' : done ? 'text-ink-2' : 'text-ink-3')}>
                {done && <Check className="size-3 shrink-0" strokeWidth={2.5} aria-hidden />}
                <span className="truncate">{FINDING_STATUS[s]}</span>
                {done && <span className="sr-only">, done</span>}
              </span>
            </li>
          )
        })}
      </ol>

      {dismissed && (
        <p className="mt-4 flex items-start gap-2 text-small text-ink-2">
          <StageMark status="dismissed" className="mt-1.5 text-ink-3" />
          <span>
            <span className="font-medium text-ink">Dismissed: {f.dismiss_reason ? DISMISS_REASONS[f.dismiss_reason].label.toLowerCase() : 'no reason recorded'}.</span> It no longer counts towards the potential total.{' '}
            <button type="button" onClick={() => setDismissing(true)} className="font-medium text-ink-2 underline decoration-ink-4 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink">
              Change reason
            </button>
          </span>
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {next && (
          <Button variant="accent" className="w-full sm:w-auto lg:w-full" loading={pending === next.to} disabled={!!pending} onClick={() => move(next.to, next.toast)}>
            {next.label}
          </Button>
        )}
        {!dismissed && (
          <Button variant="ghost" size="sm" disabled={!!pending} onClick={() => setDismissing(true)}>
            <CircleX className="size-4" aria-hidden /> Dismiss
          </Button>
        )}
        {f.status !== 'open' && (
          <Button variant="ghost" size="sm" loading={pending === 'open'} disabled={!!pending} onClick={() => move('open', REOPENED_TOAST)}>
            {pending !== 'open' && <RotateCcw className="size-4" aria-hidden />} Reopen
          </Button>
        )}
      </div>
      <DismissDialog finding={f} open={dismissing} onClose={() => setDismissing(false)} via={via} />
    </div>
  )
}
