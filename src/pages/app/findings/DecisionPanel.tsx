import { useState, type FormEvent } from 'react'
import { NOTE_MAX, OWNER_MAX, useStore } from '../../../data/store'
import { Button, TextLink, cx, inputCls } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { mapError } from '../../../lib/errors'
import { dateTime } from '../../../lib/format'
import { describeAuditEvent } from '../../../lib/audit'
import type { Finding } from '../../../engine/types'
import { StageControl } from './StageControl'

// Owner and note, saved together. The fields follow the finding as it
// changes elsewhere until the person starts typing.
function NoteAndOwner({ finding: f }: { finding: Finding }) {
  const { setFindingDecision } = useStore()
  const toast = useToast()
  const [owner, setOwner] = useState(f.owner ?? '')
  const [note, setNote] = useState(f.decision_note ?? '')
  const [base, setBase] = useState({ id: f.id, owner: f.owner ?? '', note: f.decision_note ?? '' })
  const [saving, setSaving] = useState(false)
  if (base.id !== f.id || base.owner !== (f.owner ?? '') || base.note !== (f.decision_note ?? '')) {
    const untouched = base.id === f.id && owner === base.owner && note === base.note
    setBase({ id: f.id, owner: f.owner ?? '', note: f.decision_note ?? '' })
    if (untouched || base.id !== f.id) {
      setOwner(f.owner ?? '')
      setNote(f.decision_note ?? '')
    }
  }
  const dirty = owner.trim() !== (f.owner ?? '') || note.trim() !== (f.decision_note ?? '')

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!dirty || saving) return
    setSaving(true)
    try {
      await setFindingDecision(f.id, { owner: owner.trim() || null, decision_note: note.trim() || null }, 'detail')
      toast('Saved.')
    } catch (err) {
      toast(mapError(err, 'finding'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-3.5">
      <label className="block">
        <span className="mb-1.5 block text-small font-medium text-ink-2">Owner</span>
        <input className={inputCls} value={owner} maxLength={OWNER_MAX} onChange={(e) => setOwner(e.target.value)} placeholder="Who is following this up" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-small font-medium text-ink-2">Decision note</span>
        <textarea
          className={cx(inputCls.replace('h-9', 'h-20'), 'resize-y py-2 leading-relaxed')}
          value={note}
          maxLength={NOTE_MAX}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What you checked and what was agreed"
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption text-ink-3">{f.decided_at ? `Last decision ${dateTime(f.decided_at)}` : 'No decision recorded yet'}</p>
        <Button type="submit" variant="secondary" size="sm" disabled={!dirty} loading={saving}>
          Save
        </Button>
      </div>
    </form>
  )
}

// What happened to this finding, from the workspace audit log.
function History({ finding: f }: { finding: Finding }) {
  const { data } = useStore()
  const [all, setAll] = useState(false)
  const events = data.audit_log.filter((e) => e.target_type === 'finding' && e.target_id === f.id)
  const shown = all ? events : events.slice(0, 5)
  return (
    <div>
      <h3 className="text-small font-medium text-ink">History</h3>
      <ol className="mt-2.5 space-y-2.5 border-l border-line-soft pl-3.5">
        {shown.map((e) => (
          <li key={e.id} className="text-caption">
            <p className="text-ink-2">{describeAuditEvent(e).replace(/\ban opportunity\b/, 'this opportunity')}</p>
            <p className="tnum mt-0.5 text-ink-3">
              {dateTime(e.created_at)}
              {e.actor_email ? ` · ${e.actor_email}` : ''}
            </p>
          </li>
        ))}
        {(all || events.length <= 5) && (
          <li className="text-caption">
            <p className="text-ink-2">Found by the analysis</p>
            <p className="tnum mt-0.5 text-ink-3">{dateTime(f.created_at)}</p>
          </li>
        )}
      </ol>
      {events.length > 5 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2.5 text-caption font-medium text-ink-2 underline decoration-ink-4 underline-offset-4 transition-colors hover:text-ink">
          {all ? 'Show less' : `Show all ${events.length + 1} entries`}
        </button>
      )}
    </div>
  )
}

// The MSP's decision on one finding: the stage and its next step, the owner
// and note, and the record of every change.
export function DecisionPanel({ finding: f }: { finding: Finding }) {
  return (
    <section aria-labelledby="status-heading">
      <div className="flex items-baseline justify-between gap-3 border-b border-line-soft px-5 py-4">
        <h2 id="status-heading" className="text-h3 text-ink">
          Status
        </h2>
        <TextLink to="/app/queue" className="shrink-0">
          Recovery queue
        </TextLink>
      </div>
      <div className="px-5 py-5">
        <StageControl finding={f} via="detail" />
        <p className="mt-4 text-caption text-ink-3">The software recommends. The MSP decides.</p>
      </div>
      <div className="border-t border-line-soft px-5 py-5">
        <NoteAndOwner finding={f} />
      </div>
      <div className="border-t border-line-soft px-5 py-5">
        <History finding={f} />
      </div>
    </section>
  )
}
