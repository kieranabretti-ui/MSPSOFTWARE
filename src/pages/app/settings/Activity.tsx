import { useMemo, useState } from 'react'
import { useStore } from '../../../data/store'
import { Button, cx } from '../../../components/ui'
import { describeAuditEvent, trustMetrics } from '../../../lib/audit'
import { SPLIT_LABEL } from '../../../lib/labels'
import { dateTime, money, num, plural } from '../../../lib/format'
import { Section } from './Section'

const PAGE = 25

const pctText = (n: number) => `${num(Math.round(n))}%`

// How the findings have been used: what was opened, reviewed, dismissed and
// actioned, and how often a dismissal said the finding itself was wrong. From
// the workspace's own findings and activity log; nothing leaves the browser.
export function TrustPanel() {
  const { data } = useStore()
  const t = useMemo(() => trustMetrics([...data.findings, ...data.stale_findings], data.audit_log), [data.findings, data.stale_findings, data.audit_log])
  const none = t.total === 0 && t.decided === 0
  const rates = [
    { label: 'Opened', value: pctText(t.opened_pct) },
    { label: 'Reviewed', value: pctText(t.reviewed_pct), hint: 'Moved off New' },
    { label: 'Dismissed', value: pctText(t.dismissed_pct) },
    { label: 'Actioned', value: pctText(t.actioned_pct) },
    { label: 'False-positive rate', value: t.false_positive_rate == null ? 'None yet' : pctText(t.false_positive_rate), hint: 'Dismissed as wrong data or covered by the agreement, of all decided' },
  ]
  const values = [
    { label: 'Average opportunity', value: money(t.avg_opportunity) },
    { label: SPLIT_LABEL.high, value: money(t.high_confidence_value) },
    { label: SPLIT_LABEL.review, value: money(t.requires_review_value) },
    { label: 'Actioned value', value: money(t.recovered_value), hint: 'Marked as actioned by you' },
  ]
  return (
    <Section title="How findings are used" body="Measured from your own decisions, so you can judge how often the evidence holds up.">
      {none ? (
        <p className="text-small text-ink-3">Nothing to measure until you run an analysis and review opportunities.</p>
      ) : (
        <div className="space-y-4">
          <Grid items={rates} />
          <Grid items={values} />
          <p className="tnum text-caption text-ink-3">
            Rates are of the {plural(t.total, 'current opportunity', 'current opportunities')}. {plural(t.decided, 'opportunity', 'opportunities')} decided (Approved, Actioned or Dismissed). Values exclude dismissed opportunities. The software recommends. The MSP decides.
          </p>
        </div>
      )}
    </Section>
  )
}

function Grid({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <dl className={cx('grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line-soft', items.length === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4')}>
      {items.map((it) => (
        <div key={it.label} className="flex flex-col-reverse justify-end bg-surface px-4 py-3">
          <dt className="mt-0.5 text-caption text-ink-3" title={it.hint}>
            {it.label}
          </dt>
          <dd className="tnum text-data-md text-ink">{it.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// The activity log, newest first, in words. Ids, counts and stage names only.
export function ActivityLog() {
  const { data, backend } = useStore()
  const [shown, setShown] = useState(PAGE)
  const events = data.audit_log
  return (
    <Section id="activity" title="Activity" body="Uploads, analyses, decisions, exports and deletions in this workspace. The log can't be edited." last>
      {events.length ? (
        <>
          <ol className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line">
            {events.slice(0, shown).map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="min-w-0 text-small text-ink-2">{describeAuditEvent(e)}</span>
                <span className="tnum shrink-0 text-caption text-ink-3">
                  {dateTime(e.created_at)}
                  {e.actor_email ? ` · ${e.actor_email}` : ''}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="tnum text-caption text-ink-3">
              Showing {num(Math.min(shown, events.length))} of {plural(events.length, 'event')}
              {backend.mode === 'supabase' && events.length >= 1000 ? ' (the newest 1,000)' : ''}.
            </p>
            {shown < events.length && (
              <Button variant="ghost" size="sm" onClick={() => setShown((n) => n + PAGE * 2)}>
                Show more
              </Button>
            )}
          </div>
        </>
      ) : (
        <p className="text-small text-ink-3">No activity yet. Uploads, analyses and decisions appear here as they happen.</p>
      )}
    </Section>
  )
}
