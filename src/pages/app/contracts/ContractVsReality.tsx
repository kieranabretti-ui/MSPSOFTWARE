import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp, ChevronRight } from 'lucide-react'
import type { BillingItem, Category, Client, ClientMetrics, Contract, Finding, WorkspaceSettings } from '../../../engine/types'
import { Card, CardHeader, cx } from '../../../components/ui'
import { extractClauses } from '../../../engine/contractTerms'
import { hours, money, num, plural } from '../../../lib/format'

// Contract vs reality: what a client's agreement says, what you bill for it,
// and what you actually deliver, one term to a row, with the opportunity each
// difference raised. Dismissed opportunities stay in view, struck through, and
// drop out of the totals. The billing-line patterns match the engine's.

export const USER_LINE = /\b(user|seat|per user)\b/i
export const DEVICE_LINE = /\b(device|endpoint|workstation|per device)\b/i

// Agreement gaps that recur every month until billing or the agreement changes.
const RECURRING: Category[] = ['AGREEMENT_DRIFT', 'RECURRING_CHARGE_MISMATCH', 'MISSING_LICENSE']
export const isRecurringGap = (f: Finding) => RECURRING.includes(f.category) && f.status !== 'dismissed'
export const recurringGap = (fs: Finding[]) => fs.filter(isRecurringGap).reduce((a, f) => a + f.monthly_value, 0)
export const billedTotal = (billing: BillingItem[]) => billing.reduce((a, b) => a + b.monthly_value, 0)

const live = (f: Finding) => f.status !== 'dismissed'
const s = (n: number) => (n === 1 ? '' : 's')
const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1, 3).toLowerCase()
const dash = <span className="text-ink-3">—</span>

// "08:30–17:30, Mon–Fri" from a support-hours sentence, when it states both
// times. The full sentence is quoted under the table.
export function supportWindow(sentence: string): string | null {
  const time = String.raw`\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?`
  const t = sentence.match(new RegExp(`(${time})\\s*(?:and|to|until|-|–)\\s*(${time})`, 'i'))
  if (!t || !/[:.]|am|pm/i.test(t[1] + t[2])) return null
  const d = sentence.match(/\b(mon(?:day)?)\s*(?:to|-|–)\s*(fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b/i)
  const clock = (x: string) => x.trim().replace('.', ':')
  return [`${clock(t[1])}–${clock(t[2])}`, d ? `${cap(d[1])}–${cap(d[2])}` : null].filter(Boolean).join(', ')
}

// A difference worth reading: semibold ink with a neutral up-tick, never red.
function Over({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-0.5 whitespace-nowrap font-semibold text-ink">
      <ArrowUp className="size-3 shrink-0 text-ink-3" aria-hidden />
      {children}
      {label && <span className="sr-only"> {label}</span>}
    </span>
  )
}

function Quiet({ children }: { children: ReactNode }) {
  return <span className="text-ink-3">{children}</span>
}

// The opportunity behind a row's difference, linked. Several opportunities on
// one term either stack or, with `list`, add up to one link to the filtered list.
function OppValue({ findings, per, list }: { findings: Finding[]; per: 'month' | 'period'; list?: string }) {
  if (!findings.length) return dash
  const value = (f: Finding) => (per === 'month' ? f.monthly_value : f.estimated_value)
  const unit = per === 'month' ? 'a month' : 'in period'
  const link = 'whitespace-nowrap underline-offset-4 transition-colors hover:underline'
  if (list && findings.length > 1) {
    const counting = findings.filter(live)
    if (!counting.length) return <Quiet>Dismissed</Quiet>
    return (
      <Link to={list} className={cx(link, 'font-semibold text-ink')}>
        {money(counting.reduce((a, f) => a + value(f), 0))} {unit}
        <span className="sr-only">, {plural(counting.length, 'opportunity', 'opportunities')}</span>
      </Link>
    )
  }
  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      {findings.map((f) =>
        live(f) ? (
          <Link key={f.id} to={`/app/opportunities/${f.id}`} className={cx(link, 'font-semibold text-ink')}>
            {money(value(f))} {unit}
          </Link>
        ) : (
          <Link key={f.id} to={`/app/opportunities/${f.id}`} className={cx(link, 'text-ink-3')}>
            <span className="line-through">{money(value(f))}</span> Dismissed
          </Link>
        ),
      )}
    </span>
  )
}

interface Line {
  key: string
  term: ReactNode
  contracted: ReactNode
  billed: ReactNode
  actual: ReactNode
  diff: ReactNode
  // true when diff is a real difference, so phones show it under Actual
  differs: boolean
  opp: ReactNode
  // Billed and the opportunity, for the phone's second line. Null when empty.
  phone: ReactNode[]
}

const TH = 'pb-2.5 pt-3 align-bottom text-label uppercase text-ink-3'
const WIDE = 'hidden sm:table-cell'

export function ContractVsReality({
  client,
  mt,
  billing,
  contracts,
  findings,
  settings,
}: {
  client: Client
  mt: ClientMetrics
  billing: BillingItem[]
  contracts: Contract[]
  // every opportunity for this client; dismissed ones show struck through
  findings: Finding[]
  settings: Pick<WorkspaceSettings, 'business_hours_start' | 'business_hours_end'>
}) {
  const clauses = contracts.flatMap((c) => extractClauses(c.text))
  const byRule = (rule: string) => findings.filter((f) => f.meta.rule === rule)

  // Users and devices: contracted, the quantity on the per-unit billing line,
  // and active records in the users and devices export.
  const seats = (unit: 'user' | 'device'): Line => {
    const contracted = unit === 'user' ? client.contracted_users : client.contracted_devices
    const line = billing.find((b) => (unit === 'user' ? USER_LINE : DEVICE_LINE).test(b.service))
    const actual = unit === 'user' ? mt.users : mt.devices
    const baseline = contracted ?? line?.quantity ?? null
    const over = baseline != null && actual > baseline ? actual - baseline : 0
    const under = line && contracted != null && line.quantity < contracted ? contracted - line.quantity : 0
    const opps = [...byRule(`drift.${unit}`), ...byRule(`mismatch.${unit}`)]
    const billed = line ? (
      <span className="tnum" title={line.service}>
        {num(line.quantity)}
        {under > 0 && <span className="block text-caption text-ink-3">{num(under)} below contract</span>}
      </span>
    ) : (
      <Quiet>No line</Quiet>
    )
    return {
      key: unit,
      term: unit === 'user' ? 'Users' : 'Devices',
      contracted: contracted != null ? num(contracted) : <Quiet>Not set</Quiet>,
      billed,
      actual: actual ? num(actual) : <Quiet>Not uploaded</Quiet>,
      diff: over ? <Over label={`${unit}${s(over)} above ${contracted != null ? 'contract' : 'billing'}`}>+{num(over)}</Over> : actual ? <Quiet>None</Quiet> : dash,
      differs: over > 0,
      opp: <OppValue findings={opps} per="month" />,
      phone: [line ? `Billed ${num(line.quantity)}` : null, opps.length ? <OppValue findings={opps} per="month" /> : null],
    }
  }

  // One row per unbilled-licence opportunity, from its calculation.
  const licences: Line[] = findings
    .filter((f) => f.category === 'MISSING_LICENSE' && f.meta.calc?.kind === 'licence')
    .map((f) => {
      const c = f.meta.calc as Extract<NonNullable<Finding['meta']['calc']>, { kind: 'licence' }>
      const gap = c.assigned - c.billed
      return {
        key: f.id,
        term: (
          <>
            {c.licence}
            <span className="block text-caption font-normal text-ink-3">Licences</span>
          </>
        ),
        contracted: dash,
        billed: num(c.billed),
        actual: num(c.assigned),
        diff: gap > 0 ? <Over label={`licence${s(gap)} not billed`}>+{num(gap)}</Over> : <Quiet>None</Quiet>,
        differs: gap > 0,
        opp: <OppValue findings={[f]} per="month" />,
        phone: [`Billed ${num(c.billed)}`, <OppValue findings={[f]} per="month" />],
      }
    })

  // Support hours: the allowance on the client record or in the contract
  // against the average logged each month, and any overage found.
  const included = client.included_hours ?? clauses.find((c) => c.type === 'included_hours')?.value ?? null
  const overHours = included != null ? Math.round((mt.avg_monthly_hours - included) * 10) / 10 : 0
  const usage = findings.filter((f) => f.category === 'EXCESSIVE_USAGE')
  const hoursLine: Line = {
    key: 'hours',
    term: 'Support hours a month',
    contracted: included != null ? hours(included) : <Quiet>Not set</Quiet>,
    billed: dash,
    actual: mt.avg_monthly_hours ? `${hours(mt.avg_monthly_hours)} avg` : <Quiet>None logged</Quiet>,
    diff: overHours > 0 ? <Over label="above the allowance">+{hours(overHours)}</Over> : included != null ? <Quiet>None</Quiet> : dash,
    differs: overHours > 0,
    opp: <OppValue findings={usage} per="period" />,
    phone: [usage.length ? <OppValue findings={usage} per="period" /> : null],
  }

  // Support window: the clause that sets support hours, against out-of-hours
  // work logged as non-billable.
  const windowClause = clauses.filter((c) => c.type === 'business_hours').find((c) => supportWindow(c.sentence)) ?? clauses.find((c) => c.type === 'business_hours')
  const afterHours = findings.filter((f) => f.meta.rule === 'out_of_scope.after_hours' || f.meta.rule === 'unbilled.after_hours')
  const uncharged = afterHours.filter(live).length
  const windowList = `/app/opportunities?client=${encodeURIComponent(client.id)}&category=OUT_OF_SCOPE`
  const windowLine: Line = {
    key: 'window',
    term: 'Support window',
    contracted: windowClause ? (
      <span title={windowClause.sentence}>{supportWindow(windowClause.sentence) ?? 'In contract'}</span>
    ) : (
      <Quiet>{contracts.length ? 'Not in contract' : 'No contract uploaded'}</Quiet>
    ),
    billed: dash,
    actual: uncharged ? `${plural(uncharged, 'out-of-hours ticket')} logged as non-billable` : <Quiet>None logged as non-billable</Quiet>,
    diff: dash,
    differs: false,
    opp: <OppValue findings={afterHours} per="period" list={windowList} />,
    phone: [afterHours.length ? <OppValue findings={afterHours} per="period" list={windowList} /> : null],
  }

  // The monthly charge: agreement MRR against the sum of the billing lines.
  const billed = billedTotal(billing)
  const chargeDiff = billing.length ? billed - client.monthly_recurring_revenue : null
  const chargeLine: Line = {
    key: 'charge',
    term: 'Monthly charge',
    contracted: client.monthly_recurring_revenue > 0 ? money(client.monthly_recurring_revenue) : <Quiet>Not set</Quiet>,
    billed: billing.length ? money(billed) : <Quiet>Not uploaded</Quiet>,
    actual: dash,
    diff: chargeDiff == null ? dash : chargeDiff === 0 ? <Quiet>None</Quiet> : <span className="whitespace-nowrap font-semibold text-ink">{`${chargeDiff > 0 ? '+' : '−'}${money(Math.abs(chargeDiff))}`}</span>,
    differs: !!chargeDiff,
    opp: dash,
    phone: [billing.length ? `Billed ${money(billed)}` : null],
  }

  const lines = [seats('user'), seats('device'), ...licences, hoursLine, windowLine, chargeLine]
  const recurring = recurringGap(findings)
  const oneOff = [...usage, ...afterHours].filter(live).reduce((a, f) => a + f.estimated_value, 0)

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Contract vs reality" subtitle="What the agreement says against what you actually deliver and bill." />
      <div className="overflow-x-auto px-4 sm:px-5">
        <table className="w-full caption-bottom text-small">
          <caption className="border-t border-line-soft py-3 text-left text-caption text-ink-3">
            Contracted: your clients export and contract PDFs · Billed: your billing export · Actual: your users and devices export and time entries.
          </caption>
          <thead>
            <tr className="border-b border-line-strong">
              <th scope="col" className={cx(TH, 'pr-3 text-left')}>
                Term
              </th>
              <th scope="col" className={cx(TH, 'px-3 text-right')}>
                Contracted
              </th>
              <th scope="col" className={cx(TH, WIDE, 'px-3 text-right')}>
                Billed
              </th>
              <th scope="col" className={cx(TH, 'pl-3 text-right sm:pr-3')}>
                Actual
              </th>
              <th scope="col" className={cx(TH, WIDE, 'px-3 text-right')}>
                Difference
              </th>
              <th scope="col" className={cx(TH, WIDE, 'pl-3 text-right')}>
                Opportunity
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-soft">
            {lines.map((l) => {
              const phone = l.phone.filter(Boolean)
              return (
                <tr key={l.key} className="align-top">
                  <th scope="row" className="py-3 pr-3 text-left font-medium text-ink">
                    {l.term}
                    {phone.length > 0 && (
                      <span className="tnum mt-1 flex flex-wrap items-baseline gap-x-2 text-caption font-normal text-ink-3 sm:hidden">
                        {phone.map((p, i) => (
                          <span key={i}>{p}</span>
                        ))}
                      </span>
                    )}
                  </th>
                  <td className="tnum px-3 py-3 text-right text-ink-2">{l.contracted}</td>
                  <td className={cx('tnum px-3 py-3 text-right text-ink-2', WIDE)}>{l.billed}</td>
                  <td className="tnum py-3 pl-3 text-right text-ink sm:pr-3">
                    {l.actual}
                    {l.differs && <span className="mt-1 flex justify-end sm:hidden">{l.diff}</span>}
                  </td>
                  <td className={cx('tnum px-3 py-3 text-right', WIDE)}>{l.diff}</td>
                  <td className={cx('tnum py-3 pl-3 text-right', WIDE)}>{l.opp}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong">
              <td colSpan={6} className="tnum py-3 text-right text-small text-ink-2">
                <span className="inline-block whitespace-nowrap">
                  Recurring difference <span className="font-semibold text-ink">{money(recurring)} a month</span>
                </span>
                <span aria-hidden className="text-ink-3">
                  {' · '}
                </span>
                <span className="inline-block whitespace-nowrap">
                  One-off in period <span className="font-semibold text-ink">{money(oneOff)}</span>
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {(windowClause || billing.length > 0) && (
        <div className="space-y-3 border-t border-line-soft bg-sunken px-4 py-4 sm:px-5">
          {windowClause && (
            <p className="max-w-[80ch] text-caption text-ink-3">
              Support window in the contract: <q className="text-ink-2">{windowClause.sentence}</q>
            </p>
          )}
          {!windowClause && afterHours.length > 0 && (
            <p className="max-w-[80ch] text-caption text-ink-3">
              Out-of-hours work is judged against your support hours in Settings, {settings.business_hours_start}–{settings.business_hours_end}.
            </p>
          )}
          {billing.length > 0 && (
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-sm text-caption font-medium text-ink-3 transition-colors hover:text-ink [&::-webkit-details-marker]:hidden">
                <ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" aria-hidden />
                Billing lines ({billing.length})
              </summary>
              <ul className="mt-2 max-w-[640px] divide-y divide-line-soft">
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
            </details>
          )}
        </div>
      )}
    </Card>
  )
}
