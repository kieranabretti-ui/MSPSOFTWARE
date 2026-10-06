import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ChevronRight } from 'lucide-react'
import type { BillingItem, Client, ClientMetrics, Contract, Finding, Health } from '../../../engine/types'
import { Badge, Card, CardHeader, Figure, HealthDot, SeverityBadge, TextLink, cx } from '../../../components/ui'
import { GapBar, TrendChart } from '../../../components/charts'
import { ICONS } from '../../../brand/icons'
import { hours, money, num, pct, plural } from '../../../lib/format'
import { CATEGORY_META } from '../../../lib/labels'
import { CLAUSE_LABELS, extractClauses } from '../../../engine/contractTerms'
import { StatusBadge } from '../Findings'
import { MarginValue, isBelowTarget } from './parts'

// The sections of a client's profile page, top to bottom: what is leaking,
// the findings behind it, what the client earns you against what the
// agreement covers, then the supporting data.

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
            {findingCount > 0 ? `Across ${plural(findingCount, 'finding')} in ${periodLabel}` : `None found in ${periodLabel}`}
            {billed > 0 ? `, against ${plural(months, 'month')} of MRR.` : '.'}
          </p>
          <div className="mt-5 max-w-[640px]">
            {billed > 0 ? <GapBar billed={billed} gap={leakage} height={10} /> : <p className="text-caption text-ink-3">Add this client's monthly recurring revenue to see leakage against what you bill.</p>}
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
                <span className="tnum">{money(recurring * 12)}</span> a year if the agreement and billing stay as they are
              </>
            ) : findingCount > 0 ? (
              'Nothing recurring. These findings are one-off work.'
            ) : (
              'Nothing recurring to recover.'
            )}
          </dd>
        </dl>
      </div>
      <div className="flex flex-col gap-3 border-t border-line-soft bg-sunken px-5 py-4 sm:flex-row sm:gap-6 sm:px-7">
        <div className="shrink-0 sm:w-20 sm:pt-px">
          <HealthDot health={health} />
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

// 2. Every finding for the client, biggest first. Dismissed findings stay
//    listed but drop out of the total.
export function ClientFindings({ findings, total, periodLabel }: { findings: Finding[]; total: number; periodLabel: string }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Findings"
        subtitle={findings.length ? `${plural(findings.length, 'finding')} for this client · ${money(total)} potential` : undefined}
        right={findings.length > 0 ? <TextLink to="/app/findings" className="shrink-0 pt-0.5">All findings</TextLink> : undefined}
      />
      {findings.length ? (
        <ul className="divide-y divide-line-soft">
          {findings.map((f) => {
            const dismissed = f.status === 'dismissed'
            return (
              <li key={f.id}>
                <Link to={`/app/findings/${f.id}`} className={cx(rowLink, 'group flex items-start gap-4 px-4 py-3.5 sm:items-center sm:px-5')}>
                  <span className="hidden w-[68px] shrink-0 sm:block">
                    <SeverityBadge severity={f.severity} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx('block text-body font-medium sm:truncate', dismissed ? 'text-ink-3' : 'text-ink')}>{f.title}</span>
                    <span className="mt-0.5 block text-caption text-ink-3">
                      {CATEGORY_META[f.category].label}
                      <span aria-hidden> · </span>
                      <span className="tnum whitespace-nowrap">{f.confidence}% confidence</span>
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5 sm:hidden">
                      <SeverityBadge severity={f.severity} />
                      <StatusBadge status={f.status} />
                    </span>
                  </span>
                  <span className="hidden shrink-0 sm:block">
                    <StatusBadge status={f.status} />
                  </span>
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
          <p className="text-body font-medium text-ink">No potential leakage found</p>
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

// Where each pound of MRR goes: labour, software, and what is left. The tick
// marks where contribution has to start for the target margin.
function MrrSplit({ mrr, labour, software, target }: { mrr: number; labour: number; software: number; target: number }) {
  const costs = labour + software
  const scale = Math.max(mrr, costs, 1)
  const w = (n: number) => `${(Math.max(n, 0) / scale) * 100}%`
  const tick = Math.min(Math.max((1 - target) * (mrr / scale) * 100, 0), 100)
  return (
    <div className="pb-6" role="img" aria-label={`Of ${money(mrr)} MRR: labour ${money(labour)}, software ${money(software)}, contribution ${money(mrr - costs)}. Target margin ${pct(target)}.`}>
      <div className="relative">
        <div className="flex h-2.5 w-full gap-[2px] overflow-hidden rounded-[3px] bg-line-soft">
          <div className="h-full bg-viz-series-strong" style={{ width: w(labour) }} />
          <div className="h-full bg-viz-series" style={{ width: w(software) }} />
          {mrr - costs > 0 && <div className="h-full bg-ink-2" style={{ width: w(mrr - costs) }} />}
        </div>
        {mrr > 0 && (
          <div className="absolute -bottom-1.5 -top-1.5 w-px bg-ink" style={{ left: `${tick}%` }}>
            <span className="tnum absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-caption text-ink-3">{pct(target)} target</span>
          </div>
        )}
      </div>
    </div>
  )
}

// 3a. What the client earns you each month, and the price that would restore
//     the target margin when they fall short of it.
export function ProfitabilityCard({ mt, target, periodLabel, avgHours, labourRate, clientName }: { mt: ClientMetrics; target: number; periodLabel: string; avgHours: number; labourRate: number; clientName: string }) {
  const below = isBelowTarget(mt.margin, target)
  // The price at which this period's average labour and software come to
  // (1 - target) of revenue. Only the page's own figures go in.
  const needed = target < 1 ? Math.ceil((mt.labour_cost + mt.software_cost) / (1 - target)) : null
  const uplift = needed != null ? needed - mt.mrr : 0
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader title="Profitability" subtitle={`Monthly average, ${periodLabel}`} />
      <div className="flex-1 px-5 pt-5">
        <MrrSplit mrr={mt.mrr} labour={mt.labour_cost} software={mt.software_cost} target={target} />
        <dl className="divide-y divide-line-soft">
          <LedgerRow label="MRR" value={money(mt.mrr)} />
          <LedgerRow label="Estimated labour" sub={`${hours(mt.avg_monthly_hours)} at ${money(labourRate)}/h`} swatch="bg-viz-series-strong" value={`− ${money(mt.labour_cost)}`} />
          <LedgerRow label="Software" swatch="bg-viz-series" value={`− ${money(mt.software_cost)}`} />
          <LedgerRow label="Gross contribution" swatch={mt.contribution > 0 ? 'bg-ink-2' : 'bg-transparent'} value={<span className={mt.contribution < 0 ? 'text-danger' : undefined}>{money(mt.contribution)}</span>} strong />
          <LedgerRow label="Gross margin" sub={`target ${pct(target)}`} value={<MarginValue margin={mt.margin} target={target} className="font-semibold" />} strong />
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
            <span className="tnum text-small font-semibold text-accent">+{money(uplift)} MRR</span>
          </p>
          <p className="mt-1.5 max-w-[60ch] text-caption text-ink-3">At this period's average support hours and costs. Review it with {clientName} before changing the agreement.</p>
        </div>
      ) : (
        <p className="mt-3 border-t border-line-soft px-5 py-3.5 text-caption text-ink-3">
          {mt.mrr <= 0
            ? 'Add MRR for this client to measure margin.'
            : below
              ? `Margin is just below your ${pct(target)} target at current pricing.`
              : `At current pricing, margin is ${plural(Math.round((mt.margin - target) * 100), 'point')} above your ${pct(target)} target.`}
        </p>
      )}
    </Card>
  )
}

function CompareRow({ label, contracted, actual, unit = '' }: { label: string; contracted: number | null; actual: number; unit?: string }) {
  const over = contracted != null && actual > contracted ? actual - contracted : 0
  const fmt = (n: number) => `${num(n, unit ? 1 : 0)}${unit}`
  return (
    <tr>
      <th scope="row" className="py-2.5 pr-3 text-left text-body font-normal text-ink-2">
        {label}
      </th>
      <td className="tnum px-3 py-2.5 text-right text-body text-ink-2">{contracted != null ? fmt(contracted) : <span className="text-ink-3">Not set</span>}</td>
      <td className="tnum py-2.5 pl-3 text-right text-body">
        {actual ? (
          <span className={cx('inline-flex items-center gap-1', over ? 'font-semibold text-warning' : 'text-ink')}>
            {over > 0 && <ArrowUp className="size-3.5" aria-hidden />}
            {fmt(actual)}
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        )}
        {over > 0 && <span className="block text-caption font-normal text-warning">{fmt(over)} above contract</span>}
      </td>
    </tr>
  )
}

// 3b. What the agreement covers against what is actually supported, and the
//     recurring lines billed for it.
export function AgreementCard({ client, mt, billing }: { client: Client; mt: ClientMetrics; billing: BillingItem[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Agreement vs actual" subtitle="What the agreement covers against what you support" />
      <div className="px-5 pb-2 pt-3">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line-soft">
              <th className="pb-2 pr-3 text-left text-label font-semibold uppercase text-ink-3">
                <span className="sr-only">Measure</span>
              </th>
              <th className="px-3 pb-2 text-right text-label font-semibold uppercase text-ink-3">Contracted</th>
              <th className="pb-2 pl-3 text-right text-label font-semibold uppercase text-ink-3">Actual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            <CompareRow label="Users" contracted={client.contracted_users} actual={mt.users} />
            <CompareRow label="Devices" contracted={client.contracted_devices} actual={mt.devices} />
            {client.included_hours != null && <CompareRow label="Support hours / month" contracted={client.included_hours} actual={mt.avg_monthly_hours} unit="h" />}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line-soft px-5 py-4">
        <h4 className="text-small font-medium text-ink-2">Billed each month</h4>
        {billing.length ? (
          <ul className="mt-2 divide-y divide-line-soft">
            {billing.map((b) => (
              <li key={b.id} className="flex items-baseline justify-between gap-4 py-2">
                <span className="min-w-0 text-small text-ink-2">
                  {b.service}
                  <span className="tnum block text-caption text-ink-3 sm:ml-2 sm:inline">
                    {num(b.quantity)} × {money(b.unit_price, { decimals: true })}
                  </span>
                </span>
                <span className="tnum shrink-0 text-small text-ink">{money(b.monthly_value)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-small text-ink-3">
            No billing lines uploaded.{' '}
            <Link to="/app/data" className="font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              Upload billing
            </Link>{' '}
            to check charges against the agreement.
          </p>
        )}
      </div>
    </Card>
  )
}

// 4a. Support hours by month, against the allowance when there is one.
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

// 4b. The client's agreements and the scope clauses found in them.
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
            <Link to="/app/data" className="font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline">
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
