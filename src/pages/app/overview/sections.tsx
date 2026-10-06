import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import type { Action, Category, ClientMetrics, Finding } from '../../../engine/types'
import { Card, HealthDot, SeverityBadge, TextLink, cx } from '../../../components/ui'
import { GapBar, TrendChart } from '../../../components/charts'
import { money, plural, relative } from '../../../lib/format'
import { ACTION_STATUS, CATEGORY_META } from '../../../lib/labels'

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

// 2. The open findings to act on first: severity, then value.
export function PriorityFindings({ findings, clientName, criticalCount }: { findings: Finding[]; clientName: (id: string | null) => string; criticalCount: number }) {
  return (
    <section aria-labelledby="ov-priority" className="min-w-0">
      <SectionHeading
        id="ov-priority"
        title="Act on these first"
        sub={criticalCount > 0 ? `${plural(criticalCount, 'critical finding')} need attention first` : 'Open findings by severity, then value'}
        right={<TextLink to="/app/findings">All findings</TextLink>}
      />
      <Card className="overflow-hidden">
        {findings.length > 0 ? (
          <ol className="divide-y divide-line-soft">
            {findings.map((f) => (
              <li key={f.id}>
                <Link to={`/app/findings/${f.id}`} className={cx(rowLink, 'flex items-start gap-4 px-4 py-3.5 sm:px-5')}>
                  <span className="hidden w-[68px] shrink-0 pt-0.5 sm:block">
                    <SeverityBadge severity={f.severity} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="mb-1.5 block sm:hidden">
                      <SeverityBadge severity={f.severity} />
                    </span>
                    <span className="block text-body font-medium text-ink sm:truncate">{f.title}</span>
                    <span className="mt-0.5 block truncate text-caption text-ink-3">
                      {clientName(f.client_id)} · {CATEGORY_META[f.category].short} · <span className="tnum">{f.confidence}%</span> confidence
                      {f.status === 'valid' && <span className="text-ink-2"> · Confirmed</span>}
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
          <Quiet title="Nothing open" body="Every finding in this analysis has been resolved or dismissed. Run a new analysis when fresh exports arrive." />
        )}
      </Card>
    </section>
  )
}

export type RiskClient = ClientMetrics & { leakage: number; billed: number }

// 3. Clients with the most leakage or the weakest margins, each with its own gap.
export function ClientRisk({ clients }: { clients: RiskClient[] }) {
  return (
    <section aria-labelledby="ov-clients" className="min-w-0">
      <SectionHeading id="ov-clients" title="Clients at risk" sub="Weakest health first, then leakage" right={<TextLink to="/app/clients">All clients</TextLink>} />
      <Card className="overflow-hidden">
        {clients.length > 0 ? (
          <ul className="divide-y divide-line-soft">
            {clients.map((c) => (
              <li key={c.client_id}>
                <Link to={`/app/clients/${c.client_id}`} className={cx(rowLink, 'flex items-center gap-4 px-4 py-3.5 sm:px-5')}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2.5">
                      <span className="truncate text-body font-medium text-ink">{c.name}</span>
                      <span className="shrink-0">
                        <HealthDot health={c.health} />
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-caption text-ink-3">{c.reasons[0] ?? 'Potentially billable work found'}</span>
                  </span>
                  <span className="w-24 shrink-0 sm:w-28">
                    <span className="tnum block text-right text-body font-semibold text-ink">{money(c.leakage)}</span>
                    {c.billed > 0 ? (
                      <GapBar billed={c.billed} gap={c.leakage} height={4} label={false} className="mt-2" />
                    ) : (
                      <span className="mt-1 block text-right text-caption text-ink-3">No MRR on file</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Quiet title="No clients at risk" body="Every client is healthy and has no open leakage in this period." />
        )}
      </Card>
    </section>
  )
}

const ACTION_DOT: Record<Action['status'], string> = { open: 'bg-ink-3', in_progress: 'bg-info', resolved: 'bg-success', dismissed: 'bg-ink-4' }

// 4. Where recovery stands, and the actions still moving.
export function ActionsPanel({
  openCount,
  openValue,
  active,
  resolvedValue,
  clientName,
  topFindingId,
}: {
  openCount: number
  openValue: number
  active: Action[]
  resolvedValue: number
  clientName: (id: string | null) => string
  topFindingId?: string
}) {
  const activeValue = active.reduce((s, a) => s + a.value, 0)
  const shown = [...active].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1)).slice(0, 4)
  const ledger = [
    { label: 'Open opportunities', sub: plural(openCount, 'finding') + ' to review', value: openValue },
    { label: 'Actions in progress', sub: plural(active.length, 'action'), value: activeValue },
    { label: 'Resolved', sub: 'Potential value marked resolved', value: resolvedValue },
  ]
  return (
    <section aria-labelledby="ov-actions">
      <SectionHeading id="ov-actions" title="Actions" sub="Turn findings into recovered revenue" right={<TextLink to="/app/actions">Open actions</TextLink>} />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
          <dl className="divide-y divide-line-soft border-b border-line-soft md:border-b-0 md:border-r">
            {ledger.map((r) => (
              <div key={r.label} className="flex items-start justify-between gap-4 px-4 py-3 sm:px-5">
                <dt className="min-w-0">
                  <span className="block text-small text-ink-2">{r.label}</span>
                  <span className="tnum mt-0.5 block text-caption text-ink-3">{r.sub}</span>
                </dt>
                <dd className="tnum shrink-0 text-right text-body font-semibold text-ink">{money(r.value)}</dd>
              </div>
            ))}
          </dl>
          {shown.length > 0 ? (
            <ul className="divide-y divide-line-soft">
              {shown.map((a) => (
                <li key={a.id}>
                  <Link to={a.finding_id ? `/app/findings/${a.finding_id}` : '/app/actions'} className={cx(rowLink, 'flex items-start gap-4 px-4 py-3.5 sm:px-5')}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-medium text-ink">{a.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 truncate text-caption text-ink-3">
                        <span className={cx('size-1.5 shrink-0 rounded-full', ACTION_DOT[a.status])} aria-hidden />
                        <span className="text-ink-2">{ACTION_STATUS[a.status]}</span>
                        <span>·</span>
                        <span className="truncate">
                          {clientName(a.client_id)} · updated {relative(a.updated_at)}
                        </span>
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-body font-semibold text-ink">{money(a.value)}</span>
                  </Link>
                </li>
              ))}
              {active.length > shown.length && (
                <li className="px-4 py-3 text-caption text-ink-3 sm:px-5">
                  And {plural(active.length - shown.length, 'more action')} on the actions page
                </li>
              )}
            </ul>
          ) : (
            <Quiet
              title="Nothing in progress yet"
              body="Open a finding and choose Create action to track it through to recovery."
              action={
                topFindingId && (
                  <TextLink to={`/app/findings/${topFindingId}`} className="inline-flex items-center gap-1.5">
                    Start with the top finding <ArrowRight className="size-3.5" />
                  </TextLink>
                )
              }
            />
          )}
        </div>
      </Card>
    </section>
  )
}

// 5a. Where the money leaks, by category. Each row filters the findings list.
export function CategoryBreakdown({ rows }: { rows: { category: Category; value: number; sub: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <section aria-labelledby="ov-categories" className="min-w-0">
      <SectionHeading id="ov-categories" title="Where it leaks" sub="Potential leakage by category" quiet />
      <Card className="overflow-hidden">
        <ul className="divide-y divide-line-soft">
          {rows.map((r) => (
            <li key={r.category}>
              <Link to={`/app/findings?category=${r.category}`} className={cx(rowLink, 'group px-4 py-3 sm:px-5')}>
                <span className="flex items-baseline justify-between gap-3 text-small">
                  <span className="inline-flex min-w-0 items-center gap-1 text-ink-2 transition-colors group-hover:text-ink">
                    <span className="truncate">{CATEGORY_META[r.category].label}</span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-ink-4 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                  </span>
                  <span className="tnum shrink-0">
                    <span className={r.value > 0 ? 'font-semibold text-ink' : 'text-ink-3'}>{money(r.value)}</span>
                    <span className="ml-2 text-caption text-ink-3">{r.sub}</span>
                  </span>
                </span>
                <span className="mt-2 block h-1.5 rounded-full bg-line-soft">
                  <span className="block h-full rounded-full bg-viz-series-strong transition-colors group-hover:bg-ink-3" style={{ width: `${(r.value / max) * 100}%` }} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}

// 5b. When it leaked: potential leakage attributed to each month.
export function LeakageTrend({ data }: { data: { label: string; value: number }[] }) {
  return (
    <section aria-labelledby="ov-trend" className="flex h-full min-w-0 flex-col">
      <SectionHeading id="ov-trend" title="Leakage by month" sub="Potential leakage attributed to each month" quiet />
      <Card className="flex flex-1 flex-col justify-end px-3 pb-4 pt-5 sm:px-5">
        <TrendChart data={data} height={280} />
      </Card>
    </section>
  )
}
