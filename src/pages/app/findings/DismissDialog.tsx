import { useId, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { NOTE_MAX, useStore } from '../../../data/store'
import { Button, Modal, cx, inputCls } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { mapError } from '../../../lib/errors'
import { money } from '../../../lib/format'
import { DISMISS_REASONS, DISMISS_REASON_ORDER, FALSE_POSITIVE_REASONS } from '../../../lib/audit'
import type { DismissReason, Finding } from '../../../engine/types'

export const DISMISSED_TOAST = 'Dismissed. It no longer counts towards the potential total.'

// Dismissing always asks why, so a finding that was wrong can be told apart
// from one that was valid but not pursued. The note is optional; the reason is not.
export default function DismissDialog({ finding: f, open, onClose, via }: { finding: Finding; open: boolean; onClose: () => void; via?: 'detail' | 'queue' }) {
  const { setFindingDecision } = useStore()
  const toast = useToast()
  const { pathname } = useLocation()
  const formId = useId()
  const nameId = useId()
  const [reason, setReason] = useState<DismissReason | null>(null)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [saving, setSaving] = useState(false)

  // Fresh each time it opens; a dismissed finding starts on its current reason.
  const [shown, setShown] = useState(false)
  if (open !== shown) {
    setShown(open)
    if (open) {
      setReason(f.status === 'dismissed' ? (f.dismiss_reason ?? null) : null)
      setNote('')
      setTried(false)
    }
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (!reason || saving) return
    setSaving(true)
    try {
      await setFindingDecision(
        f.id,
        { status: 'dismissed', dismiss_reason: reason, ...(note.trim() ? { decision_note: note.trim() } : {}) },
        via ?? (pathname.startsWith('/app/queue') ? 'queue' : 'detail'),
      )
      toast(f.status === 'dismissed' ? 'Reason updated.' : DISMISSED_TOAST)
      onClose()
    } catch (err) {
      toast(mapError(err, 'finding'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const missing = tried && !reason
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={f.status === 'dismissed' ? 'Change the dismiss reason' : 'Dismiss this opportunity'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="secondary" form={formId} loading={saving}>
            {f.status === 'dismissed' ? 'Save reason' : 'Dismiss opportunity'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-5">
        <div className="flex items-start justify-between gap-4 rounded-md border border-line-soft bg-sunken px-4 py-3">
          <p className="line-clamp-2 min-w-0 text-small font-medium text-ink">{f.title}</p>
          <p className="tnum shrink-0 text-small font-semibold text-ink">{money(f.estimated_value)}</p>
        </div>

        <fieldset aria-describedby={missing ? `${nameId}-err` : undefined}>
          <legend id={nameId} className="mb-2 text-small font-medium text-ink-2">
            Why are you dismissing it?
          </legend>
          <div className="divide-y divide-line-soft rounded-md border border-line">
            {DISMISS_REASON_ORDER.map((r) => (
              <label key={r} className={cx('flex cursor-pointer items-start gap-3 px-3.5 py-3 transition-colors duration-150 hover:bg-hover', reason === r && 'bg-raised')}>
                <input type="radio" name={`${formId}-reason`} value={r} checked={reason === r} onChange={() => setReason(r)} className="mt-0.5 size-4 shrink-0 accent-accent" />
                <span className="min-w-0">
                  <span className="block text-small font-medium text-ink">{DISMISS_REASONS[r].label}</span>
                  <span className="mt-0.5 block text-caption text-ink-3">{r === 'goodwill' ? 'Valid, but done without charge on purpose.' : DISMISS_REASONS[r].hint}</span>
                </span>
              </label>
            ))}
          </div>
          {missing && (
            <p id={`${nameId}-err`} className="mt-1.5 text-caption text-danger">
              Choose a reason.
            </p>
          )}
          {reason && (
            <p className="mt-2 text-caption text-ink-3">
              {FALSE_POSITIVE_REASONS.includes(reason)
                ? 'Recorded as a finding that was wrong. This counts towards the false-positive rate.'
                : 'Recorded as valid but not pursued. This does not count as a false positive.'}
            </p>
          )}
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-small font-medium text-ink-2">Note</span>
          <textarea
            className={cx(inputCls.replace('h-9', 'h-20'), 'resize-y py-2 leading-relaxed')}
            value={note}
            maxLength={NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder={f.decision_note ? 'Leave blank to keep the current note' : undefined}
          />
          <span className="mt-1.5 block text-caption text-ink-3">Optional. What you checked, or who agreed it.</span>
        </label>

        <p className="text-caption leading-relaxed text-ink-3">
          The opportunity and its evidence are kept. It stops counting towards the potential total, and you can reopen it at any time.
        </p>
      </form>
    </Modal>
  )
}
