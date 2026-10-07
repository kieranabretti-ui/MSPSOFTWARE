import { useEffect, useRef } from 'react'
import { ArrowRight, Check, FileText } from 'lucide-react'
import type { AnalysisSummary } from '../../../engine/types'
import { useMetrics, useStore } from '../../../data/store'
import { Button, ButtonLink, Disclaimer, cx } from '../../../components/ui'
import { money, num, plural } from '../../../lib/format'
import { Callout } from '../data/kit'

// What the analysis found and where to go next, from the opportunities as they
// now stand (dismissed ones carried over from a previous run don't count).
// It stays until the reader moves on; nothing navigates on its own.
export function AnalysisResult({
  summary,
  onClose,
  onViewOverview,
  onUploadContracts,
}: {
  summary: AnalysisSummary
  onClose?: () => void
  onViewOverview?: () => void
  onUploadContracts?: () => void
}) {
  const { data } = useStore()
  const m = useMetrics()
  const cov = summary.coverage
  const missing = cov ? cov.clients - cov.clients_with_contract : 0
  const unmatched = cov?.time_entries_unmatched ?? 0

  // New since the run before this one, when both runs recorded their keys.
  const prev = data.analyses[1]?.summary.finding_keys
  const keys = summary.finding_keys
  const fresh = prev && keys ? keys.filter((k) => !prev.includes(k)).length : null

  // The run's button is gone, so focus lands on the result for keyboard and
  // screen reader users.
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => heading.current?.focus({ preventScroll: true }), [])

  const figures = [
    { value: num(m.count), label: m.count === 1 ? 'opportunity' : 'opportunities' },
    { value: money(m.total), label: 'potential leakage' },
    { value: money(m.monthly), label: 'a month recurring', accent: m.monthly > 0 },
    { value: num(m.clientsAffected), label: m.clientsAffected === 1 ? 'client affected' : 'clients affected' },
  ]

  return (
    <section aria-labelledby="result-title" className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-raised text-ink-2 ring-1 ring-inset ring-line-strong" aria-hidden>
            <Check className="size-3.5" />
          </span>
          <div className="min-w-0">
            <h2 ref={heading} id="result-title" className="text-h3 text-ink focus:outline-none" tabIndex={-1}>
              Analysis complete
            </h2>
            <p className="tnum mt-0.5 text-small text-ink-3">
              {summary.period_label} · {plural(summary.data_counts.clients, 'client')} · {plural(summary.data_counts.tickets, 'ticket')}
              {fresh != null && ` · ${fresh === 0 ? 'nothing new' : `${num(fresh)} new`} since the last analysis`}
            </p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" className="-mr-2 -mt-1 shrink-0" onClick={onClose}>
            Close
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-px border-y border-line-soft bg-line-soft sm:grid-cols-4">
        {figures.map((f) => (
          <div key={f.label} className="flex flex-col-reverse justify-end bg-surface px-5 py-4 sm:px-6">
            <dt className="mt-1 text-small text-ink-3">{f.label}</dt>
            <dd className={cx('tnum text-data-md', f.accent ? 'text-accent' : 'text-ink')}>{f.value}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-4 px-5 py-5 sm:px-6">
        {missing > 0 && cov && (
          <Callout tone="info">
            <p>
              {missing === cov.clients
                ? "No contracts were uploaded, so out-of-scope work wasn't checked."
                : `${missing} of ${plural(cov.clients, 'client')} have no contract uploaded, so out-of-scope work wasn't checked for them.`}
            </p>
            <div className="mt-2">
              {onUploadContracts ? (
                <Button size="sm" variant="secondary" onClick={onUploadContracts}>
                  <FileText className="size-4 shrink-0" aria-hidden /> Upload contracts
                </Button>
              ) : (
                <ButtonLink to="/app/analyses" size="sm" variant="secondary">
                  <FileText className="size-4 shrink-0" aria-hidden /> Upload contracts
                </ButtonLink>
              )}
            </div>
          </Callout>
        )}
        {unmatched > 0 && (
          <Callout tone="warning">
            We couldn't match {plural(unmatched, 'time entry', 'time entries')} to a ticket. They're left out of the unbilled-work checks. Check the ticket numbers in your time export, then run the analysis again.
          </Callout>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink to="/app/opportunities" variant="accent">
            Review opportunities <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
          <ButtonLink to="/app" variant="secondary" onClick={onViewOverview}>
            View overview
          </ButtonLink>
        </div>
        <Disclaimer />
      </div>
    </section>
  )
}
