import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Category, ClientMetrics, ConfidenceLevel as Level, Finding, FindingStatus } from '../../../engine/types'
import { Card, HealthDot, TextLink, cx } from '../../../components/ui'
import { LeakBar } from '../../../components/bars'
import { TrendChart } from '../../../components/charts'
import { ConfidenceLevel } from '../../../components/ConfidenceLevel'
import { money, plural } from '../../../lib/format'
import { CATEGORY_META, FINDING_STATUS } from '../../../lib/labels'

// Full-width rows inside a card: the focus ring sits inside the row so the
// card's rounded clip never cuts it off.
const rowLink = 'block transition-colors duration-150 hover:bg-hover focus-visible:-outline-offset-2'

export function SectionHeading({ id, title, sub, right, quiet }: { id: string; title: string; sub?: ReactNode; right?: ReactNode; quiet?: boolean }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={id} className={cx('text-ink', quiet ? 'text-h3' : 'text-h2')}>
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-small text-ink-3">{sub}</p>}
      </div>
      {right && <div className="shrink-0 pb-0.5">{right}</div>}
    </div>
  )
}

function Quiet({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-5 py-8">
      <p className="text-body font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-[52ch] text-small text-ink-3">{body}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export type CategoryRow = { category: Category; value: number; sub: string; unchecked?: boolean }

// Where the money leaks, by category, straight under the total. Each row opens
// the opportunities in it. Out-of-scope work can't be found without contracts,
// so with none uploaded it reads "Not checked" rather than a reassuring £0.
export function CategoryBreakdown({ rows }: { rows: CategoryRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <section aria-labelledby="ov-categories" className="min-w-0">
      <SectionHeading id="ov-categories" title="Where it leaks" sub="Potential leakage by category" />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line-soft">
          {rows.map((r) => (
            <li key={r.category}>
              <Link to={r.unchecked ? '/app/analyses' : `/app/opportunities?category=${r.category}`} className={cx(rowLink, 'group px-4 py-3 sm:px-5')}>
                <span className="flex items-baseline justify-between gap-3 text-small">
                  <span className="inline-flex min-w-0 items-center gap-1 text-ink-2 transition-colors group-hover:text-ink">
                    <span className="truncate">{CATEGORY_META[r.category].label}</span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </span>
                  <span className="tnum shrink-0">
                    {r.unchecked ? (
                      <span className="text-ink-3">Not checked</span>
                    ) : (
                      <span className={r.value > 0 ? 'font-semibold text-ink' : 'text-ink-3'}>{money(r.value)}</span>
                    )}
                    <span className="ml-2 text-caption text-ink-3">{r.sub}</span>
                  </span>
                </span>
                {!r.unchecked && (
                  <span className="mt-2 block h-1.5 rounded-full bg-line-soft">
                    <span className="block h-full rounded-full bg-viz-series-strong transition-colors group-hover:bg-ink-3" style={{ width: `${(r.value / max) * 100}%` }} />
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}

// A client with its health as it stands now, with dismissed opportunities left out.
export type RiskClient = ClientMetrics & { leakage: number; billed: number }

// Clients with the most leakage or the weakest margins. Each bar ranks the
// client's leakage against the largest across all clients. A client with no
// MRR has no margin to judge, so it says so instead of showing a health mark.
export function ClientRisk({ clients, maxLeakage }: { clients: RiskClient[]; maxLeakage: number }) {
  return (
    <section aria-labelledby="ov-clients" className="min-w-0">
      <SectionHeading id="ov-clients" title="Clients at risk" sub="Weakest health first, then leakage" right={<TextLink to="/app/clients">All clients</TextLink>} />
      <Card className="overflow-hidden">
        {clients.length > 0 ? (
          <ul className="divide-y divide-line-soft">
            {clients.map((c) => {
              const unknown = c.margin_known === false
              // The first reason for a client without MRR repeats "Needs MRR".
              const reason = (unknown ? (c.reasons[1] ?? c.reasons[0]) : c.reasons[0]) ?? 'Potentially billable work found'
              return (
                <li key={c.client_id}>
                  <Link to={`/app/clients/${c.client_id}`} className={cx(rowLink, 'flex items-center gap-4 px-4 py-3.5 sm:px-5')}>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2.5">
                        <span className="truncate text-body font-medium text-ink">{c.name}</span>
                        <span className="shrink-0">
                          {unknown ? (
                            <span className="inline-flex items-center gap-1.5 text-caption font-medium text-ink-3" title="Add this client's monthly recurring revenue to measure margin">
                              <span className="size-1.5 shrink-0" aria-hidden />
                              Needs MRR
                            </span>
                          ) : (
                            <HealthDot health={c.health} />
                          )}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-caption text-ink-3">{reason}</span>
                    </span>
                    <span className="w-24 shrink-0 sm:w-28">
                      <span className={cx('tnum block text-right text-body', c.leakage > 0 ? 'font-semibold text-ink' : 'text-ink-3')}>{money(c.leakage)}</span>
                      <LeakBar value={c.leakage} max={maxLeakage} className="mt-2" />
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <Quiet title="No clients at risk" body="Every client is healthy and has no open leakage in this period." />
        )}
      </Card>
    </section>
  )
}

export type PriorityRow = { finding: Finding; level: Level }

// The opportunities to act on first: the surest, then the largest. Stage shows
// once an opportunity has moved past New.
export function PriorityFindings({ rows, clientName }: { rows: PriorityRow[]; clientName: (id: string | null) => string }) {
  return (
    <section aria-labelledby="ov-priority" className="min-w-0">
      <SectionHeading id="ov-priority" title="Act on these first" sub="Highest confidence first, then value" right={<TextLink to="/app/opportunities">All opportunities</TextLink>} />
      <Card className="overflow-hidden">
        {rows.length > 0 ? (
          <ol className="divide-y divide-line-soft">
            {rows.map(({ finding: f, level }) => (
              <li key={f.id}>
                <Link to={`/app/opportunities/${f.id}`} className={cx(rowLink, 'flex items-start gap-4 px-4 py-3.5 sm:px-5')}>
                  <span className="hidden w-20 shrink-0 pt-0.5 sm:block">
                    <ConfidenceLevel level={level} short />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1.5 block sm:hidden">
                      <ConfidenceLevel level={level} short />
                    </span>
                    <span className="block text-body font-medium text-ink sm:truncate">{f.title}</span>
                    <span className="mt-0.5 block truncate text-caption text-ink-3">
                      {clientName(f.client_id)} · {CATEGORY_META[f.category].short}
                      {f.status !== 'open' && <span className="text-ink-2"> · {FINDING_STATUS[f.status]}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-body font-semibold text-ink">{money(f.estimated_value)}</span>
                    {f.monthly_value > 0 && <span className="tnum mt-0.5 block text-caption text-ink-3">{money(f.monthly_value)} a month</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <Quiet title="Nothing open" body="Every opportunity in this analysis has been actioned or dismissed. Run a new analysis when fresh exports arrive." />
        )}
      </Card>
    </section>
  )
}

const RECOVERY_STAGES: FindingStatus[] = ['open', 'reviewing', 'valid', 'resolved']

// Where recovery stands: every opportunity by stage, from New to Actioned, each
// opening its tab in the recovery queue. Stage totals are ink; lime is for the
// money found, not for where it sits in the workflow.
export function RecoveryPanel({
  byStage,
  topFindingId,
}: {
  byStage: Record<FindingStatus, { count: number; value: number }>
  topFindingId?: string
}) {
  const moving = byStage.reviewing.count + byStage.valid.count + byStage.resolved.count > 0
  const dismissed = byStage.dismissed.count
  return (
    <section aria-labelledby="ov-recovery">
      <SectionHeading
        id="ov-recovery"
        title="Recovery"
        sub="Each opportunity by stage, from New to Actioned"
        right={<TextLink to="/app/queue">Open the recovery queue</TextLink>}
      />
      <Card className="overflow-hidden">
        <ol className="grid grid-cols-2 gap-px bg-line-soft sm:grid-cols-4">
          {RECOVERY_STAGES.map((s) => (
            <li key={s} className="min-w-0 bg-surface">
              <Link to={`/app/queue?stage=${s}`} className={cx(rowLink, 'group h-full px-4 py-4 sm:px-5')}>
                <span className="flex items-center justify-between gap-2 text-small text-ink-2 transition-colors group-hover:text-ink">
                  {FINDING_STATUS[s]}
                  <ArrowUpRight className="size-3.5 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </span>
                <span className="tnum mt-1.5 block text-data-md text-ink">{byStage[s].count}</span>
                <span className="tnum mt-0.5 block text-caption text-ink-3">{money(byStage[s].value)}</span>
              </Link>
            </li>
          ))}
        </ol>
        {(!moving || dismissed > 0) && (
          <div className="flex flex-col gap-2 border-t border-line-soft px-4 py-3 text-small text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            {!moving ? (
              <>
                <span>Nothing in review yet. Start with the top opportunity.</span>
                {topFindingId && (
                  <TextLink to={`/app/opportunities/${topFindingId}`} className="inline-flex items-center gap-1.5">
                    Open the top opportunity <ArrowRight className="size-3.5" aria-hidden />
                  </TextLink>
                )}
              </>
            ) : (
              <span className="tnum">
                {plural(dismissed, 'opportunity', 'opportunities')} dismissed and left out of the totals ({money(byStage.dismissed.value)}).
              </span>
            )}
          </div>
        )}
      </Card>
    </section>
  )
}

// When it leaked: potential leakage attributed to each month.
export function LeakageTrend({ data }: { data: { label: string; value: number }[] }) {
  return (
    <section aria-labelledby="ov-trend" className="flex h-full min-w-0 flex-col">
      <SectionHeading id="ov-trend" title="Leakage by month" sub="Potential leakage attributed to each month" />
      <Card className="flex flex-1 flex-col justify-end px-3 pb-4 pt-5 sm:px-5">
        <TrendChart data={data} height={260} />
      </Card>
    </section>
  )
}
