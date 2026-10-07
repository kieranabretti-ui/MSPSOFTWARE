import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import type { Client, ClientMetrics, Contract, Finding, Health } from '../../../engine/types'
import { Badge, Card, CardHeader, Figure, TextLink, cx } from '../../../components/ui'
import { GapBar, TrendChart } from '../../../components/charts'
import { ConfidenceLevel } from '../../../components/ConfidenceLevel'
import { ICONS } from '../../../brand/icons'
import { hours, money, num, pct, plural } from '../../../lib/format'
import { signed } from '../../../engine/format'
import { CATEGORY_META } from '../../../lib/labels'
import { confidenceOf } from '../../../lib/confidence'
import { CLAUSE_LABELS, extractClauses } from '../../../engine/contractTerms'
import { FindingStatusTag } from '../findings/StatusTag'
import { ClientHealth, MarginValue, isBelowTarget, marginKnown } from './parts'

// The sections of a client's profile page, top to bottom: what is leaking,
// the opportunities behind it, the agreement against what you deliver (in
// contracts/ContractVsReality), what the client earns you, then the
// supporting data.

const rowLink = 'block transition-colors duration-150 hover:bg-hover focus-visible:-outline-offset-2'

// 1. Potential leakage for this client against what they were billed, the
//    part that recurs, and why the client has the health it has.
export function LeakagePanel({
  leakage,
  recurring,
  billed,
  months,
  periodLabel,
  findingCount,
  health,
  known,
  overlap = false,
  reasons,
  recommendation,
}: {
  leakage: number
  recurring: number
  billed: number
  months: number
  periodLabel: string
  findingCount: number
  health: Health
  // false when there is no MRR, so margin and health can't be measured
  known: boolean
  // true when two counted opportunities overlap (see the engine's meta.overlaps)
  overlap?: boolean
  reasons: string[]
  recommendation: string
}) {
  return (
    <section aria-labelledby="cd-leakage" className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="px-5 py-6 sm:px-7">
          <h2 id="cd-leakage" className="text-body font-medium text-ink-2">
            Potential leakage
          </h2>
          <div className="mt-2">
            <Figure>{money(leakage)}</Figure>
          </div>
          <p className="mt-1.5 text-small text-ink-3">
            {findingCount > 0 ? `Across ${plural(findingCount, 'opportunity', 'opportunities')} in ${periodLabel}.` : `None found in ${periodLabel}.`}
          </p>
          <div className="mt-5 max-w-[640px]">
            {billed > 0 ? <GapBar billed={billed} gap={leakage} height={14} billedLabel={`MRR over ${plural(months, 'month')}`} /> : <p className="text-caption text-ink-3">Add this client's monthly recurring revenue to see leakage against what you bill.</p>}
          </div>
        </div>
        <dl className="flex flex-col justify-center border-t border-line-soft px-5 py-6 sm:px-7 md:border-l md:border-t-0">
          <dt className="text-small font-medium text-ink-2">Recurring leakage</dt>
          <dd className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
            <Figure tone={recurring > 0 ? 'accent' : 'muted'}>{money(recurring)}</Figure>
            <span className="text-small text-ink-3">a month</span>
          </dd>
          <dd className="mt-1.5 text-caption text-ink-3">
            {recurring > 0 ? (
              <>
                <span className="tnum">{money(recurring * 12)}</span> a year if nothing changes.
                {overlap && ' Part of this overlaps: billing the agreement gaps would restore the target margin on its own.'}
              </>
            ) : findingCount > 0 ? (
              'Nothing recurring. These opportunities are one-off work.'
            ) : (
              'Nothing recurring to recover.'
            )}
          </dd>
        </dl>
      </div>
      <div className="flex flex-col gap-3 border-t border-line-soft bg-sunken px-5 py-4 sm:flex-row sm:gap-6 sm:px-7">
        <div className="shrink-0 sm:w-20 sm:pt-px">
          <ClientHealth health={health} known={known} />
        </div>
        <div className="min-w-0 flex-1 text-small">
          {reasons.length > 0 ? (
            <ul className="space-y-1 text-ink-2">
              {reasons.map((r) => (
                <li key={r} className="flex gap-2.5">
                  <span className="mt-[0.6em] size-1 shrink-0 rounded-full bg-ink-4" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-2">Margin, support use and scope all look in line for this period.</p>
          )}
          <p className="mt-2 text-ink">
            <span className="font-semibold">Next step:</span> <span className="text-ink-2">{recommendation}</span>
          </p>
        </div>
      </div>
    </section>
  )
}

// 2. Every opportunity for the client, biggest first, with its confidence and
//    its stage once it has moved on from New. Dismissed ones stay listed but
//    drop out of the total.
export function ClientFindings({ findings, total, periodLabel, clientId }: { findings: Finding[]; total: number; periodLabel: string; clientId: string }) {
  const dismissedCount = findings.filter((f) => f.status === 'dismissed').length
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Opportunities"
        subtitle={findings.length ? `${plural(findings.length, 'opportunity', 'opportunities')} for this client${dismissedCount ? `, ${dismissedCount} dismissed` : ''} · ${money(total)} potential` : undefined}
        right={
          findings.length > 0 ? (
            <TextLink to={`/app/opportunities?client=${encodeURIComponent(clientId)}`} className="shrink-0 pt-0.5">
              View in list
            </TextLink>
          ) : undefined
        }
      />
      {findings.length ? (
        <ul className="divide-y divide-line-soft">
          {findings.map((f) => {
            const dismissed = f.status === 'dismissed'
            return (
              <li key={f.id}>
                <Link to={`/app/opportunities/${f.id}`} className={cx(rowLink, 'group flex items-start gap-4 px-4 py-3.5 sm:items-center sm:px-5')}>
                  <span className="hidden w-[84px] shrink-0 sm:block">
                    <ConfidenceLevel level={confidenceOf(f).level} short />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx('block text-body font-medium sm:truncate', dismissed ? 'text-ink-3' : 'text-ink')}>{f.title}</span>
                    <span className="mt-0.5 block text-caption text-ink-3">{CATEGORY_META[f.category].label}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:hidden">
                      <ConfidenceLevel level={confidenceOf(f).level} short />
                      {f.status !== 'open' && <FindingStatusTag status={f.status} />}
                    </span>
                  </span>
                  {f.status !== 'open' && (
                    <span className="hidden shrink-0 sm:block">
                      <FindingStatusTag status={f.status} />
                    </span>
                  )}
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={cx('tnum min-w-[4.5rem] text-right text-body font-semibold', dismissed ? 'font-normal text-ink-3 line-through' : 'text-ink')}>{money(f.estimated_value)}</span>
                    <ChevronRight className="hidden size-4 text-ink-4 transition-colors group-hover:text-ink-2 sm:block" aria-hidden />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="px-5 py-8">
          <p className="text-body font-medium text-ink">No opportunities for this client</p>
          <p className="mt-1 max-w-[56ch] text-small text-ink-3">Nothing in {periodLabel} points to unbilled, out-of-scope or underpriced work for this client.</p>
        </div>
      )}
    </Card>
  )
}

function LedgerRow({ label, sub, value, swatch, strong }: { label: ReactNode; sub?: ReactNode; value: ReactNode; swatch?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="flex min-w-0 items-baseline gap-2.5">
        {swatch !== undefined && <span className={cx('size-2 shrink-0 translate-y-[-1px] self-center rounded-[2px]', swatch)} aria-hidden />}
        <span className={cx('text-body', strong ? 'font-semibold text-ink' : 'text-ink-2')}>{label}</span>
        {sub && <span className="hidden truncate text-caption text-ink-3 sm:inline">{sub}</span>}
      </dt>
      <dd className={cx('tnum shrink-0 text-right text-body', strong ? 'font-semibold text-ink' : 'text-ink')}>{value}</dd>
    </div>
  )
}

// Where each pound of MRR goes: labour, software, and what is left, stepped
// by lightness so the legend below can name each part. The tick marks where
// contribution has to start for the target margin; when costs run past it,
// the overrun is a hatched danger notch labelled with the shortfall.
function MrrSplit({ mrr, labour, software, target, margin }: { mrr: number; labour: number; software: number; target: number; margin: number }) {
  const costs = labour + software
  const scale = Math.max(mrr, costs, 1)
  const at = (n: number) => (Math.max(n, 0) / scale) * 100
  const tick = Math.min(Math.max((1 - target) * (mrr / scale) * 100, 0), 100)
  const costEnd = Math.min(at(costs), 100)
  const short = mrr > 0 && costEnd > tick
  return (
    <div className="pb-7" role="img" aria-label={`Of ${money(mrr)} MRR: labour ${money(labour)}, software ${money(software)}, contribution ${money(mrr - costs)}. Margin ${pct(margin)} against a ${pct(target)} target.`}>
      <div className="relative">
        <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[3px] bg-line-soft">
          <div className="h-full bg-ink-4" style={{ width: `${at(labour)}%` }} />
          <div className="h-full bg-ink-3" style={{ width: `${at(software)}%` }} />
          {mrr - costs > 0 && <div className="h-full bg-ink" style={{ width: `${at(mrr - costs)}%` }} />}
        </div>
        {short && (
          <div
            className="absolute inset-y-0 rounded-[2px] ring-1 ring-inset ring-danger"
            style={{ left: `${tick}%`, width: `${costEnd - tick}%`, backgroundImage: 'repeating-linear-gradient(135deg, var(--brand-danger) 0 1.5px, transparent 1.5px 4px)' }}
            aria-hidden
          />
        )}
        {mrr > 0 && (
          <div className="absolute -bottom-1.5 -top-1.5 w-px bg-ink-2" style={{ left: `${tick}%` }}>
            <span className={cx('tnum absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-caption', short ? 'font-medium text-ink-2' : 'text-ink-3')}>
              {short ? `${pct(margin)} vs ${pct(target)} target` : `${pct(target)} target`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// 4a. What the client earns you each month, and the price that would restore
//     the target margin when they fall short of it.
export function ProfitabilityCard({ mt, target, periodLabel, avgHours, labourRate, clientName }: { mt: ClientMetrics; target: number; periodLabel: string; avgHours: number; labourRate: number; clientName: string }) {
  const known = marginKnown(mt)
  const below = known && isBelowTarget(mt.margin, target)
  // The price at which this period's average labour and software come to
  // (1 - target) of revenue: the engine's own figure, so it matches the
  // underpricing opportunity. Older analyses fall back to the same formula.
  const needed = mt.target_price ?? (target < 1 ? Math.round((mt.labour_cost + mt.software_cost) / (1 - target)) : null)
  const uplift = needed != null ? needed - mt.mrr : 0
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader title="Profitability" subtitle={`Monthly average, ${periodLabel}`} />
      <div className="flex-1 px-5 pt-5">
        {known && <MrrSplit mrr={mt.mrr} labour={mt.labour_cost} software={mt.software_cost} target={target} margin={mt.margin} />}
        <dl className="divide-y divide-line-soft">
          <LedgerRow label="Recurring revenue (agreement)" value={money(mt.mrr)} />
          <LedgerRow label="Estimated labour" sub={`${hours(mt.avg_monthly_hours)} at ${money(labourRate)}/h`} swatch="bg-ink-4" value={`− ${money(mt.labour_cost)}`} />
          <LedgerRow label="Software" swatch="bg-ink-3" value={`− ${money(mt.software_cost)}`} />
          <LedgerRow label="Gross contribution" swatch={mt.contribution > 0 ? 'bg-ink' : 'bg-transparent'} value={<span className={known && mt.contribution < 0 ? 'text-danger' : undefined}>{money(mt.contribution)}</span>} strong />
          <LedgerRow label="Gross margin" sub={`target ${pct(target)}`} value={<MarginValue margin={mt.margin} target={target} known={known} mark={false} className="font-semibold" />} strong />
          <LedgerRow label="Support hours" sub={avgHours > 0 ? `client average ${hours(avgHours)}` : undefined} value={`${hours(mt.avg_monthly_hours)} / month`} />
          <LedgerRow label="Revenue per technician hour" value={mt.revenue_per_hour ? money(mt.revenue_per_hour) : '—'} />
        </dl>
      </div>
      {below && needed != null && uplift > 0 ? (
        <div className="mt-3 border-t border-line-soft bg-sunken px-5 py-4">
          <p className="text-small font-medium text-ink-2">Price for a {pct(target)} margin</p>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <Figure size="md">{money(needed)}</Figure>
            <span className="text-small text-ink-3">a month,</span>
            <span className="tnum text-small font-semibold text-accent">{signed(money(uplift))} MRR</span>
          </p>
          <p className="mt-1.5 max-w-[60ch] text-caption text-ink-3">At this period's average support hours and costs. Review it with {clientName} before changing the agreement.</p>
        </div>
      ) : (
        <p className="mt-3 border-t border-line-soft px-5 py-3.5 text-caption text-ink-3">
          {!known
            ? 'Add MRR for this client to measure margin.'
            : below
              ? `Margin is just below your ${pct(target)} target at current pricing.`
              : `At current pricing, margin is ${plural(Math.round((mt.margin - target) * 100), 'point')} above your ${pct(target)} target.`}
        </p>
      )}
    </Card>
  )
}

// 4b. Support hours by month, against the allowance when there is one.
export function HoursCard({ data, includedHours, labourRate }: { data: { label: string; value: number }[]; includedHours: number | null; labourRate: number }) {
  return (
    <Card>
      <CardHeader title="Support hours by month" subtitle={includedHours ? `${hours(includedHours)} included each month` : `Labour costed at ${money(labourRate)}/h`} />
      <div className="px-3 pb-4 pt-4 sm:px-5">
        <TrendChart data={data} height={180} unit="hours" />
      </div>
    </Card>
  )
}

// 5. The client's agreements and the scope clauses found in them.
export function ContractsCard({ contracts }: { contracts: Contract[] }) {
  const Doc = ICONS.contracts
  return (
    <Card>
      <CardHeader title="Contracts" subtitle={contracts.length ? plural(contracts.length, 'agreement') : undefined} />
      <div className="divide-y divide-line-soft">
        {contracts.length ? (
          contracts.map((c) => {
            const clauses = extractClauses(c.text)
            const types = [...new Set(clauses.map((cl) => cl.type))]
            return (
              <div key={c.id} className="px-5 py-4">
                <p className="flex items-start gap-2 text-body font-medium text-ink">
                  <Doc className="mt-[3px] size-4 shrink-0 text-ink-3" aria-hidden /> <span className="min-w-0">{c.title}</span>
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {types.map((t) => (
                    <Badge key={t}>{CLAUSE_LABELS[t]}</Badge>
                  ))}
                  {!types.length && <span className="text-caption text-ink-3">No scope clauses detected.</span>}
                </div>
                <details className="group mt-3">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-caption font-medium text-ink-3 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" aria-hidden />
                    Contract text
                  </summary>
                  <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-line rounded-md border border-line-soft bg-sunken p-3 text-caption leading-relaxed text-ink-2">{c.text}</p>
                </details>
              </div>
            )
          })
        ) : (
          <p className="px-5 py-5 text-small text-ink-3">
            No contract uploaded.{' '}
            <Link to="/app/analyses" className="font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              Upload a PDF
            </Link>{' '}
            to check tickets against its scope.
          </p>
        )}
      </div>
    </Card>
  )
}

// Before an analysis: what the agreement says, so the page is never blank.
export function AgreementFacts({ client }: { client: Client }) {
  const facts: [string, string][] = [
    ['MRR', money(client.monthly_recurring_revenue)],
    ['Contracted users', client.contracted_users != null ? num(client.contracted_users) : '—'],
    ['Contracted devices', client.contracted_devices != null ? num(client.contracted_devices) : '—'],
    ['Included hours', client.included_hours != null ? `${hours(client.included_hours)} / month` : '—'],
  ]
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-surface lg:grid-cols-4">
      {facts.map(([k, v], i) => (
        <div key={k} className={cx('px-5 py-4', i % 2 === 0 && 'border-r border-line-soft', i < 2 && 'border-b border-line-soft lg:border-b-0', i === 1 && 'lg:border-r')}>
          <dt className="text-small text-ink-3">{k}</dt>
          <dd className="tnum mt-1 text-data-md text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
