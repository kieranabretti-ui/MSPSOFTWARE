import { useMemo, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'
import { useStore } from '../../data/store'
import { ButtonLink, Card, EmptyState, PageHeader, cx } from '../../components/ui'
import { CLAUSE_LABELS, extractClauses, type ClauseType } from '../../engine/contractTerms'
import type { Asset, BillingItem, Client, Contract, Finding } from '../../engine/types'
import { money, plural } from '../../lib/format'
import { LeakBar } from '../../components/bars'
import { SeatCount } from './clients/parts'
import { billedTotal, recurringGap } from './contracts/ContractVsReality'

// Every client's agreement on one page: what it covers and costs, what you
// bill, what you actually support, and the recurring gap between them. Each
// client links to the contract section of its own page for the detail.

type Status = 'drift' | 'ended' | 'none' | 'inline'
const STATUS: Record<Status, string> = { drift: 'Drift', ended: 'Ended', none: 'No contract uploaded', inline: 'In line' }
// Drift first, then contracts that need renewing, then gaps in the data.
const STATUS_ORDER: Status[] = ['drift', 'ended', 'none', 'inline']

interface Row {
  c: Client
  contracts: Contract[]
  billing: BillingItem[]
  users: number
  devices: number
  clauses: ClauseType[]
  // null until an analysis has run
  gap: number | null
  term: Term
  status: Status
}

interface Term {
  main: string
  sub?: string
  ended: boolean
}

// Columns give way on narrow screens; the client with its agreement, the
// recurring gap and the status always stay. Header, cells and totals share these.
const COL = {
  term: 'hidden lg:table-cell',
  mrr: 'hidden md:table-cell',
  billed: 'hidden xl:table-cell',
  users: 'hidden md:table-cell',
  devices: 'hidden xl:table-cell',
  clauses: 'hidden min-[1400px]:table-cell',
}
const thBase = 'px-3 py-2.5 align-bottom text-label font-semibold uppercase text-ink-3'
const th = cx(thBase, 'text-right')
const td = 'px-3 py-3 text-right tnum'
const dash = <span className="text-ink-3">—</span>

const DAY = 86_400_000
const monthYear = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const parseDay = (iso: string | null) => {
  if (!iso) return null
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

// The agreement's term in the words an owner uses: the dates, how soon it
// ends when that is close, or when it ended.
function termOf(c: Client, today: number): Term {
  const start = parseDay(c.contract_start)
  const end = parseDay(c.contract_end)
  const range = start && end ? `${monthYear(start)} – ${monthYear(end)}` : start ? `From ${monthYear(start)}` : end ? `Until ${monthYear(end)}` : null
  if (!end) return { main: range ?? 'Not set', ended: false }
  const days = Math.round((end.getTime() - today) / DAY)
  if (days < 0) return { main: `Ended ${monthYear(end)}`, sub: range ?? undefined, ended: true }
  if (days <= 90) return { main: days === 0 ? 'Ends today' : `Ends in ${plural(days, 'day')}`, sub: range ?? undefined, ended: false }
  return { main: range!, ended: false }
}

function group<T extends { client_id: string }>(xs: T[]) {
  const m = new Map<string, T[]>()
  for (const x of xs) {
    if (!m.has(x.client_id)) m.set(x.client_id, [])
    m.get(x.client_id)!.push(x)
  }
  return m
}

function StatusText({ status }: { status: Status }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap text-caption font-medium', status === 'drift' ? 'text-ink' : status === 'ended' ? 'text-ink-2' : 'text-ink-3')}>
      {status === 'drift' && <ArrowUp className="size-3 shrink-0 text-ink-3" aria-hidden />}
      {STATUS[status]}
    </span>
  )
}

// The recurring gap, with the signature's lime bar ranking it against the
// largest where there is room. A total passes no `max` and shows the figure alone.
function GapCell({ gap, max }: { gap: number; max?: number }) {
  return (
    <span className="flex items-center justify-end gap-3">
      {max != null && (
        <span className="hidden w-14 min-[1100px]:block" aria-hidden>
          <LeakBar value={gap} max={max} />
        </span>
      )}
      <span className={cx('tnum whitespace-nowrap', gap > 0 ? 'font-semibold text-ink' : 'text-ink-3')}>{money(gap)}/mo</span>
    </span>
  )
}

function Notice({ children, action }: { children: ReactNode; action: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="max-w-[72ch] text-small text-ink-2">{children}</p>
      <div className="shrink-0 self-start sm:self-auto">{action}</div>
    </div>
  )
}

export default function Contracts() {
  const { data, analysis } = useStore()
  const nav = useNavigate()

  const rows = useMemo(() => {
    const now = new Date()
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    const contracts = group(data.contracts)
    const billing = group(data.billing_items)
    const assets = group(data.assets.filter((a: Asset) => a.status === 'active'))
    const findings = group<Finding>(data.findings)
    const out: Row[] = data.clients.map((c) => {
      const ks = contracts.get(c.id) ?? []
      const as = assets.get(c.id) ?? []
      const gap = analysis ? recurringGap(findings.get(c.id) ?? []) : null
      const term = termOf(c, today)
      const status: Status = !ks.length ? 'none' : gap ? 'drift' : term.ended ? 'ended' : 'inline'
      return {
        c,
        contracts: ks,
        billing: billing.get(c.id) ?? [],
        users: as.filter((a) => a.asset_type === 'user').length,
        devices: as.filter((a) => a.asset_type === 'device').length,
        clauses: [...new Set(ks.flatMap((k) => extractClauses(k.text).map((cl) => cl.type)))],
        gap,
        term,
        status,
      }
    })
    return out.sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0) || STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.c.name.localeCompare(b.c.name))
  }, [data.clients, data.contracts, data.billing_items, data.assets, data.findings, analysis])

  const missing = rows.filter((r) => !r.contracts.length).length
  const drifting = rows.filter((r) => r.status === 'drift').length
  const ended = rows.filter((r) => r.term.ended).length
  const maxGap = Math.max(0, ...rows.map((r) => r.gap ?? 0))
  const totalGap = rows.reduce((a, r) => a + (r.gap ?? 0), 0)
  const totalMrr = rows.reduce((a, r) => a + r.c.monthly_recurring_revenue, 0)
  const withBilling = rows.filter((r) => r.billing.length)
  const totalBilled = withBilling.reduce((a, r) => a + billedTotal(r.billing), 0)

  const sep = (
    <span aria-hidden className="text-ink-3">
      {' · '}
    </span>
  )
  const subtitle: ReactNode = rows.length ? (
    <>
      Each client's agreement against what you actually deliver and bill.
      <span className="mt-0.5 block text-small">
        {plural(rows.length - missing, 'agreement')}
        {analysis && drifting > 0 && (
          <>
            {sep}
            {drifting} with recurring drift
          </>
        )}
        {ended > 0 && (
          <>
            {sep}
            {ended} ended
          </>
        )}
      </span>
    </>
  ) : (
    "Each client's agreement against what you actually deliver and bill."
  )

  return (
    <>
      <PageHeader title="Contracts" subtitle={subtitle} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="No clients yet"
            body="Upload your client list to compare each agreement with what you deliver."
            action={<ButtonLink to="/app/analyses">Go to Analyses</ButtonLink>}
          />
        </Card>
      ) : (
        <>
          {missing > 0 && (
            <Notice
              action={
                <ButtonLink to="/app/analyses" variant="secondary" size="sm">
                  Upload contracts
                </ButtonLink>
              }
            >
              {missing} of {plural(rows.length, 'client')} {missing === 1 ? 'has' : 'have'} no contract uploaded. Without one, scope and support-hours checks can't run for {missing === 1 ? 'that client' : 'those clients'}.
            </Notice>
          )}
          {!analysis && (
            <Notice
              action={
                <ButtonLink to="/app/analyses" variant="secondary" size="sm">
                  Go to Analyses
                </ButtonLink>
              }
            >
              Run the analysis to see the recurring gap between each agreement and what you deliver.
            </Notice>
          )}

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-small">
                <caption className="sr-only">Each client's agreement against what is billed and supported, largest recurring gap first</caption>
                <thead>
                  <tr className="border-b border-line-soft bg-sunken">
                    <th scope="col" className={cx(thBase, 'pl-4 text-left sm:pl-5')}>
                      Client and agreement
                    </th>
                    <th scope="col" className={cx(thBase, COL.term, 'text-left')}>
                      Term
                    </th>
                    <th scope="col" className={cx(th, COL.mrr)}>
                      Agreement MRR
                    </th>
                    <th scope="col" className={cx(th, COL.billed)}>
                      Billed a month
                    </th>
                    <th scope="col" className={cx(th, COL.users)} title="Actual / contracted">
                      Users
                    </th>
                    <th scope="col" className={cx(th, COL.devices)} title="Actual / contracted">
                      Devices
                    </th>
                    <th scope="col" className={cx(th, COL.clauses)}>
                      Scope clauses
                    </th>
                    <th scope="col" className={th}>
                      Recurring gap
                    </th>
                    <th scope="col" className={cx(thBase, 'pr-4 text-left sm:pr-5')}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map((r) => {
                    const to = `/app/clients/${r.c.id}#contract`
                    const billed = r.billing.length ? billedTotal(r.billing) : null
                    const diff = billed == null ? null : billed - r.c.monthly_recurring_revenue
                    const title = r.contracts[0]?.title
                    return (
                      <tr key={r.c.id} className="cursor-pointer align-top transition-colors duration-150 hover:bg-hover" onClick={() => nav(to)}>
                        <th scope="row" className="min-w-[11rem] py-3 pl-4 pr-3 text-left font-normal sm:pl-5">
                          <Link to={to} onClick={(e) => e.stopPropagation()} className="text-body font-medium text-ink underline-offset-4 hover:underline">
                            {r.c.name}
                          </Link>
                          <span className="block max-w-[34ch] text-caption text-ink-3">
                            {title ? (
                              <>
                                <span className="text-ink-2">{title}</span>
                                {r.c.package && !title.includes(r.c.package) && ` · ${r.c.package}`}
                                {r.contracts.length > 1 && ` · +${r.contracts.length - 1} more`}
                              </>
                            ) : (
                              [r.c.package, 'No contract uploaded'].filter(Boolean).join(' · ')
                            )}
                          </span>
                          <span className="tnum block text-caption text-ink-3 lg:hidden">{r.term.main}</span>
                        </th>
                        <td className={cx('tnum px-3 py-3', COL.term)}>
                          <span className={cx('block whitespace-nowrap', r.term.ended ? 'text-ink' : 'text-ink-2')}>{r.term.main}</span>
                          {r.term.sub && <span className="block whitespace-nowrap text-caption text-ink-3">{r.term.sub}</span>}
                        </td>
                        <td className={cx(td, COL.mrr, 'text-ink')}>{r.c.monthly_recurring_revenue > 0 ? money(r.c.monthly_recurring_revenue) : <span className="text-ink-3">Not set</span>}</td>
                        <td className={cx(td, COL.billed)}>
                          {billed == null ? (
                            <span className="text-ink-3">Not uploaded</span>
                          ) : (
                            <>
                              <span className="block text-ink">{money(billed)}</span>
                              <span className={cx('block whitespace-nowrap text-caption', diff ? 'font-semibold text-ink-2' : 'text-ink-3')}>
                                {diff ? `${money(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'} MRR` : 'Matches MRR'}
                              </span>
                            </>
                          )}
                        </td>
                        <td className={cx(td, COL.users, 'whitespace-nowrap')}>
                          <SeatCount actual={r.users} contracted={r.c.contracted_users} noun="users" />
                        </td>
                        <td className={cx(td, COL.devices, 'whitespace-nowrap')}>
                          <SeatCount actual={r.devices} contracted={r.c.contracted_devices} noun="devices" />
                        </td>
                        <td className={cx(td, COL.clauses, 'text-ink-2')}>
                          {r.contracts.length ? <span title={r.clauses.map((t) => CLAUSE_LABELS[t]).join(', ') || 'No scope clauses detected'}>{r.clauses.length}</span> : dash}
                        </td>
                        <td className={td}>{r.gap == null ? dash : <GapCell gap={r.gap} max={maxGap} />}</td>
                        <td className="py-3 pl-3 pr-4 sm:pr-5">
                          <StatusText status={r.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {rows.length > 1 && (
                  <tfoot>
                    <tr className="border-t border-line bg-sunken font-semibold text-ink">
                      <td className="py-3 pl-4 pr-3 text-small sm:pl-5">All clients</td>
                      <td className={COL.term} />
                      <td className={cx(td, COL.mrr)}>{money(totalMrr)}</td>
                      <td className={cx(td, COL.billed)}>{withBilling.length ? money(totalBilled) : ''}</td>
                      <td className={COL.users} />
                      <td className={COL.devices} />
                      <td className={COL.clauses} />
                      <td className={td}>{analysis ? <GapCell gap={totalGap} /> : ''}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
          <p className="mt-3 max-w-[90ch] text-caption text-ink-3">
            Users and devices show actual / contracted; anything above contract carries an up arrow. The recurring gap is the monthly value of agreement drift, billing mismatches and unbilled licences, leaving out any you have dismissed. Open a client to see its contract against reality term by term.
          </p>
        </>
      )}
    </>
  )
}
