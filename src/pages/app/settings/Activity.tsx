import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../../data/store'
import { Button, cx } from '../../../components/ui'
import { describeAuditEvent, trustMetrics, trustRates } from '../../../lib/audit'
import { SPLIT_LABEL } from '../../../lib/labels'
import { dateTime, money, num, plural } from '../../../lib/format'
import { Section } from './Section'

const PAGE = 25

// How the findings have been used: what was opened, reviewed, dismissed and
// actioned, and how often a dismissal said the finding itself was wrong. From
// the workspace's own findings and activity log; nothing leaves the browser.
export function TrustPanel() {
  const { data } = useStore()
  const t = useMemo(() => trustMetrics([...data.findings, ...data.stale_findings], data.audit_log), [data.findings, data.stale_findings, data.audit_log])
  const none = t.total === 0 && t.decided === 0
  const rates = trustRates(t).map((r) => ({ label: r.label, value: r.value, detail: r.detail, hint: r.hint }))
  const values = [
    { label: 'Average opportunity', value: money(t.avg_opportunity) },
    { label: SPLIT_LABEL.high, value: money(t.high_confidence_value) },
    { label: SPLIT_LABEL.review, value: money(t.requires_review_value) },
    { label: 'Recovered (actioned)', value: money(t.recovered_value), detail: plural(t.counts.actioned, 'opportunity', 'opportunities'), hint: 'Value of opportunities marked Actioned' },
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

function Grid({ items }: { items: { label: string; value: string; detail?: string; hint?: string }[] }) {
  return (
    <dl className={cx('grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line-soft', items.length === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4')}>
      {items.map((it) => (
        <div key={it.label} className="flex flex-col-reverse justify-end bg-surface px-4 py-3">
          <dt className="mt-0.5 text-caption text-ink-3" title={it.hint}>
            {it.label}
          </dt>
          <dd className="tnum text-data-md text-ink">{it.value}</dd>
          {it.detail && <dd className="tnum order-first text-caption text-ink-3">{it.detail}</dd>}
        </div>
      ))}
    </dl>
  )
}

// Which record an entry is about: a short reference to the target's ID,
// linked to the record while it still exists. IDs only, never client data.
function TargetRef({ type, id, live }: { type: string | null; id: string | null; live: Set<string> }) {
  if (!type || !id) return null
  const short = id.slice(0, 8)
  const label = type === 'finding' ? 'opportunity' : type
  const to = type === 'finding' && live.has(id) ? `/app/opportunities/${id}` : type === 'analysis' || type === 'upload' ? '/app/analyses' : null
  return (
    <span className="ml-1.5 text-caption text-ink-3">
      {to ? (
        <Link to={to} className="underline decoration-line underline-offset-2 hover:text-ink" title={`${label} ${id}`}>
          {label} {short}
        </Link>
      ) : (
        <span title={`${label} ${id}`}>
          {label} {short}
        </span>
      )}
    </span>
  )
}

// The activity log, newest first, in words. Ids, counts and stage names only.
export function ActivityLog() {
  const { data, backend } = useStore()
  const [shown, setShown] = useState(PAGE)
  const events = data.audit_log
  const live = useMemo(() => new Set([...data.findings, ...data.stale_findings].map((f) => f.id)), [data.findings, data.stale_findings])
  return (
    <Section id="activity" title="Activity" body="Uploads, analyses, decisions, exports and deletions in this workspace. The log can't be edited." last>
      {events.length ? (
        <>
          <ol className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line">
            {events.slice(0, shown).map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <span className="min-w-0 text-small text-ink-2">
                  {describeAuditEvent(e)}
                  <TargetRef type={e.target_type} id={e.target_id} live={live} />
                </span>
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
