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

// Drift is users or devices above the agreement; a billing gap is any other
// recurring gap (a charge below the agreement, licences not billed). Ended
// agreements and missing contract PDFs are notes beside the status, so a
// client without a PDF can still show the drift its records reveal.
type Status = 'drift' | 'gap' | 'clear' | 'pending'
const STATUS: Record<Status, string> = { drift: 'Drift', gap: 'Billing gap', clear: 'No recurring gap', pending: 'Not analysed yet' }
const STATUS_ORDER: Status[] = ['drift', 'gap', 'clear', 'pending']

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

// Columns give way on narrower screens, users and devices last of all so the
// contract and reality stay side by side. Below md each client is a stacked
// card instead. Header, cells and totals share these.
const COL = {
  term: 'hidden xl:table-cell',
  billed: 'hidden min-[1400px]:table-cell',
  clauses: 'hidden min-[1400px]:table-cell',
}
const thBase = 'whitespace-nowrap px-3 py-2.5 align-bottom text-label font-semibold uppercase text-ink-3'
const th = cx(thBase, 'text-right')
const td = 'px-3 py-3 text-right tnum'
const dash = <span className="text-ink-3">—</span>

// The agreement's tier ("Business Pro") rather than its full title; the title
// stays on hover.
function agreementLabel(r: Row): { label: string; full?: string } {
  const title = r.contracts[0]?.title
  if (!title) return { label: [r.c.package, 'No contract PDF'].filter(Boolean).join(' · ') }
  const tier = r.c.package && title.includes(r.c.package) ? r.c.package : (title.split(/\s[–-]\s/).pop() ?? title)
  return { label: `${tier}${r.contracts.length > 1 ? ` · +${r.contracts.length - 1} more` : ''}`, full: r.contracts.map((k) => k.title).join('; ') }
}

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

function StatusText({ r }: { r: Row }) {
  const status = r.status
  return (
    <span className="flex flex-col gap-0.5">
      <span className={cx('inline-flex items-center gap-1 whitespace-nowrap text-caption font-medium', status === 'drift' || status === 'gap' ? 'text-ink' : 'text-ink-3')}>
        {status === 'drift' && <ArrowUp className="size-3 shrink-0 text-ink-3" aria-hidden />}
        {STATUS[status]}
      </span>
      {r.term.ended && <span className="whitespace-nowrap text-caption text-ink-2">Agreement ended</span>}
      {!r.contracts.length && <span className="whitespace-nowrap text-caption text-ink-3">No contract PDF</span>}
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
      const fs = findings.get(c.id) ?? []
      const gap = analysis ? recurringGap(fs) : null
      const term = termOf(c, today)
      const drift = fs.some((f) => f.category === 'AGREEMENT_DRIFT' && f.status !== 'dismissed')
      const status: Status = gap == null ? 'pending' : drift ? 'drift' : gap > 0 ? 'gap' : 'clear'
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
    return out.sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0) || STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || Number(b.term.ended) - Number(a.term.ended) || a.c.name.localeCompare(b.c.name))
  }, [data.clients, data.contracts, data.billing_items, data.assets, data.findings, analysis])

  const missing = rows.filter((r) => !r.contracts.length).length
  const drifting = rows.filter((r) => r.status === 'drift').length
  const gapOnly = rows.filter((r) => r.status === 'gap').length
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
        {missing > 0 ? `${rows.length - missing} of ${plural(rows.length, 'contract')} uploaded` : plural(rows.length, 'agreement')}
        {analysis && drifting > 0 && (
          <>
            {sep}
            {drifting} with agreement drift
          </>
        )}
        {analysis && gapOnly > 0 && (
          <>
            {sep}
            {gapOnly} with a billing gap
          </>
        )}
        {ended > 0 && (
          <>
            {sep}
            {plural(ended, 'agreement')} ended
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

          {/* Phones: one card per client, contract beside reality in a line. */}
          <Card className="overflow-hidden md:hidden">
            <ul className="divide-y divide-line-soft" aria-label="Clients, largest recurring gap first">
              {rows.map((r) => {
                const a = agreementLabel(r)
                return (
                  <li key={r.c.id}>
                    <Link to={`/app/clients/${r.c.id}#contract`} className="block px-4 py-3.5 transition-colors duration-150 hover:bg-hover">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 text-body font-medium text-ink">{r.c.name}</span>
                        {r.gap == null ? dash : <span className={cx('tnum shrink-0 whitespace-nowrap text-small', r.gap > 0 ? 'font-semibold text-ink' : 'text-ink-3')}>{money(r.gap)}/mo</span>}
                      </span>
                      <span className="mt-0.5 block text-caption text-ink-3" title={a.full}>
                        {a.label} · <span className="tnum">{r.term.main}</span>
                      </span>
                      <span className="tnum mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-small">
                        <span className="inline-flex items-baseline gap-1.5">
                          <span className="text-caption text-ink-3">Users</span>
                          <SeatCount actual={r.users} contracted={r.c.contracted_users} noun="users" />
                        </span>
                        <span className="inline-flex items-baseline gap-1.5">
                          <span className="text-caption text-ink-3">Devices</span>
                          <SeatCount actual={r.devices} contracted={r.c.contracted_devices} noun="devices" />
                        </span>
                      </span>
                      <span className="mt-2 block">
                        <StatusText r={r} />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
            {rows.length > 1 && analysis && (
              <p className="flex items-baseline justify-between gap-3 border-t border-line bg-sunken px-4 py-3 text-small font-semibold text-ink">
                All clients <span className="tnum">{money(totalGap)}/mo</span>
              </p>
            )}
          </Card>

          <Card className="hidden overflow-hidden md:block">
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
                    <th scope="col" className={th} title="Agreement MRR">
                      MRR
                    </th>
                    <th scope="col" className={cx(th, COL.billed)} title="Recurring billing lines a month">
                      Billed
                    </th>
                    <th scope="col" className={th} title="Actual / contracted">
                      Users
                    </th>
                    <th scope="col" className={th} title="Actual / contracted">
                      Devices
                    </th>
                    <th scope="col" className={cx(th, COL.clauses)} title="Scope clauses found in the contract">
                      Clauses
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
                    const a = agreementLabel(r)
                    return (
                      <tr key={r.c.id} className="cursor-pointer align-top transition-colors duration-150 hover:bg-hover" onClick={() => nav(to)}>
                        <th scope="row" className="min-w-[10rem] py-3 pl-4 pr-3 text-left font-normal sm:pl-5">
                          <Link to={to} onClick={(e) => e.stopPropagation()} className="text-body font-medium text-ink underline-offset-4 hover:underline">
                            {r.c.name}
                          </Link>
                          <span className="block text-caption text-ink-2" title={a.full}>
                            {a.label}
                          </span>
                          <span className="tnum block text-caption text-ink-3 xl:hidden">{r.term.main}</span>
                        </th>
                        <td className={cx('tnum px-3 py-3', COL.term)}>
                          <span className={cx('block whitespace-nowrap', r.term.ended ? 'text-ink' : 'text-ink-2')}>{r.term.main}</span>
                          {r.term.sub && <span className="block whitespace-nowrap text-caption text-ink-3">{r.term.sub}</span>}
                        </td>
                        <td className={cx(td, 'text-ink')}>{r.c.monthly_recurring_revenue > 0 ? money(r.c.monthly_recurring_revenue) : <span className="text-ink-3">Not set</span>}</td>
                        <td className={cx(td, COL.billed)}>
                          {billed == null ? (
                            <span className="text-ink-3">Not uploaded</span>
                          ) : (
                            <>
                              <span className="block text-ink">{money(billed)}</span>
                              {diff ? (
                                <span className="block whitespace-nowrap text-caption font-semibold text-ink-2">
                                  {money(Math.abs(diff))} {diff > 0 ? 'above' : 'below'} MRR
                                </span>
                              ) : null}
                            </>
                          )}
                        </td>
                        <td className={cx(td, 'whitespace-nowrap')}>
                          <SeatCount actual={r.users} contracted={r.c.contracted_users} noun="users" />
                        </td>
                        <td className={cx(td, 'whitespace-nowrap')}>
                          <SeatCount actual={r.devices} contracted={r.c.contracted_devices} noun="devices" />
                        </td>
                        <td className={cx(td, COL.clauses, 'text-ink-2')}>
                          {r.contracts.length ? <span title={r.clauses.map((t) => CLAUSE_LABELS[t]).join(', ') || 'No scope clauses detected'}>{r.clauses.length}</span> : dash}
                        </td>
                        <td className={td}>{r.gap == null ? dash : <GapCell gap={r.gap} max={maxGap} />}</td>
                        <td className="py-3 pl-3 pr-4 sm:pr-5">
                          <StatusText r={r} />
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
                      <td className={td}>{money(totalMrr)}</td>
                      <td className={cx(td, COL.billed)}>{withBilling.length ? money(totalBilled) : ''}</td>
                      <td />
                      <td />
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
            Users and devices show actual / contracted; anything above contract carries an up arrow. The recurring gap is the monthly value of agreement drift, billing mismatches and unbilled licences, leaving out any you have dismissed. Drift means more users or devices than the agreement covers; a billing gap is a charge or licence below it. Open a client to see its contract against reality term by term.
          </p>
        </>
      )}
    </>
  )
}
