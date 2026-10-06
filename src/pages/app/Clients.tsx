import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, X } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Button, ButtonLink, Card, EmptyState, HealthDot, PageHeader, cx, inputCls } from '../../components/ui'
import { ICONS } from '../../brand/icons'
import { hours, money, plural } from '../../lib/format'
import type { Client, ClientMetrics } from '../../engine/types'
import { AddClientModal } from './clients/AddClientModal'
import { LeakageCell, MarginValue, SeatCount } from './clients/parts'

// Data.tsx imports the modal from here.
export { AddClientModal }

type View = 'overview' | 'profitability'
const VIEWS: { id: View; icon: (typeof ICONS)[keyof typeof ICONS] }[] = [
  { id: 'overview', icon: ICONS.leakage },
  { id: 'profitability', icon: ICONS.profitability },
]

interface Row {
  c: Client
  mt: ClientMetrics | undefined
  leakage: number
}

// Columns give way on narrow screens; the client, the money and the health
// always stay. Header and cells share these so they never drift apart.
const COL = {
  mrr: 'hidden sm:table-cell',
  users: 'hidden md:table-cell',
  devices: 'hidden md:table-cell',
  support: 'hidden xl:table-cell',
  margin: 'hidden sm:table-cell',
  health: 'hidden sm:table-cell',
  labour: 'hidden md:table-cell',
  software: 'hidden md:table-cell',
  perHour: 'hidden xl:table-cell',
}
const thBase = 'px-3 py-2.5 text-label font-semibold uppercase text-ink-3'
const th = cx(thBase, 'text-right')
const td = 'px-3 py-3 text-right tnum'
const dash = <span className="text-ink-3">—</span>

export default function Clients() {
  const { data, analysis, workspace } = useStore()
  const m = useMetrics()
  const nav = useNavigate()
  const [view, setView] = useState<View>('overview')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const metrics = useMemo(() => new Map((analysis?.summary.client_metrics ?? []).map((c) => [c.client_id, c])), [analysis])
  const target = workspace?.settings.target_margin ?? 0.3
  const months = analysis?.summary.months.length ?? 0

  const all: Row[] = data.clients.map((c) => ({ c, mt: metrics.get(c.id), leakage: m.leakageByClient.get(c.id) ?? 0 }))
  const rows = all
    .filter(({ c }) => !q || c.name.toLowerCase().includes(q.toLowerCase()))
    .sort(
      view === 'profitability'
        ? // Weakest margin first; clients without figures go last.
          (a, b) => (a.mt ? a.mt.margin : Infinity) - (b.mt ? b.mt.margin : Infinity) || a.c.name.localeCompare(b.c.name)
        : (a, b) => b.leakage - a.leakage || a.c.name.localeCompare(b.c.name),
    )
  const avg = analysis?.summary.average_monthly_hours
  const atRisk = all.filter((r) => r.mt?.health === 'at_risk').length
  const overContract = all.filter(({ c, mt }) => mt && ((c.contracted_users != null && mt.users > c.contracted_users) || (c.contracted_devices != null && mt.devices > c.contracted_devices))).length

  // Totals for the rows on screen, so a search still adds up.
  const withMt = rows.filter((r) => r.mt) as (Row & { mt: ClientMetrics })[]
  const sum = (f: (r: Row & { mt: ClientMetrics }) => number) => withMt.reduce((a, r) => a + f(r), 0)
  const totalMrr = rows.reduce((a, r) => a + r.c.monthly_recurring_revenue, 0)
  const totalContribution = sum((r) => r.mt.contribution)
  const totalMtMrr = sum((r) => r.mt.mrr)
  const totalLeakage = rows.reduce((a, r) => a + r.leakage, 0)
  // Bars rank against the largest leak across every client, so a search keeps the scale.
  const maxLeakage = Math.max(0, ...all.map((r) => r.leakage))

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
    e.preventDefault()
    const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + VIEWS.length) % VIEWS.length
    setView(VIEWS[next].id)
    tabs.current[next]?.focus()
  }

  const subtitle: ReactNode = analysis ? (
    <>
      {plural(data.clients.length, 'client')}
      {atRisk > 0 && <> · {atRisk} at risk</>}
      {overContract > 0 && <> · {overContract} above contract</>}
      <span className="text-ink-4"> · </span>
      Monthly averages for {analysis.summary.period_label}
    </>
  ) : (
    'Your managed service clients'
  )

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={subtitle}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add client
          </Button>
        }
      />
      {data.clients.length === 0 ? (
        <Card>
          <EmptyState
            title="No clients yet"
            body="Add a client by hand, upload a clients CSV, or load the demo MSP from the Data page."
            action={
              <>
                <Button onClick={() => setAdding(true)}>
                  <Plus className="size-4" /> Add client
                </Button>
                <Button variant="secondary" onClick={() => nav('/app/data')}>
                  Go to data
                </Button>
              </>
            }
          />
        </Card>
      ) : (
        <>
          {!analysis && (
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-small text-ink-2">Run the analysis to see leakage, margins and health for each client.</p>
              <ButtonLink to="/app/data" variant="secondary" size="sm" className="self-start sm:self-auto">
                Go to data
              </ButtonLink>
            </div>
          )}

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex self-start rounded-md border border-line bg-surface p-0.5" role="tablist" aria-label="Client view">
              {VIEWS.map(({ id: v, icon: Icon }, i) => (
                <button
                  key={v}
                  ref={(el) => {
                    tabs.current[i] = el
                  }}
                  id={`clients-tab-${v}`}
                  role="tab"
                  aria-selected={view === v}
                  aria-controls="clients-panel"
                  tabIndex={view === v ? 0 : -1}
                  onClick={() => setView(v)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={cx(
                    'inline-flex h-8 items-center gap-1.5 rounded-sm px-3 text-small font-medium capitalize transition-colors duration-150',
                    view === v ? 'bg-raised text-ink ring-1 ring-inset ring-line-strong [&>svg]:text-ink-2' : 'text-ink-3 hover:bg-hover hover:text-ink',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {v}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
              <input className={cx(inputCls, 'pl-9', q && 'pr-9')} placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
              {q && (
                <button onClick={() => setQ('')} className="absolute right-1.5 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-raised hover:text-ink" aria-label="Clear search">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto" id="clients-panel" role="tabpanel" aria-labelledby={`clients-tab-${view}`}>
              <table className="w-full text-small">
                <thead>
                  <tr className="border-b border-line-soft bg-sunken">
                    <th className={cx(thBase, 'pl-4 text-left sm:pl-5')}>Client</th>
                    <th className={cx(th, COL.mrr)}>MRR</th>
                    {view === 'overview' ? (
                      <>
                        <th className={cx(th, COL.users)} title="Supported / contracted">
                          Users
                        </th>
                        <th className={cx(th, COL.devices)} title="Supported / contracted">
                          Devices
                        </th>
                        <th className={cx(th, COL.support)}>Support / mo</th>
                        <th className={cx(th, COL.margin)}>Margin</th>
                        <th className={cx(th, 'pr-4 sm:pr-3')}>Potential leakage</th>
                      </>
                    ) : (
                      <>
                        <th className={cx(th, COL.labour)}>Labour</th>
                        <th className={cx(th, COL.software)}>Software</th>
                        <th className={th}>Contribution</th>
                        <th className={cx(th, COL.perHour)}>£ / tech hour</th>
                        <th className={cx(th, 'pr-4 sm:pr-3')}>Margin</th>
                      </>
                    )}
                    <th className={cx(thBase, COL.health, 'pr-5 text-left')}>Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {rows.map(({ c, mt, leakage }) => (
                    <tr key={c.id} className="cursor-pointer transition-colors duration-150 hover:bg-hover" onClick={() => nav(`/app/clients/${c.id}`)}>
                      <td className="py-3 pl-4 pr-3 sm:pl-5">
                        <Link to={`/app/clients/${c.id}`} onClick={(e) => e.stopPropagation()} className="text-body font-medium text-ink underline-offset-4 hover:underline">
                          {c.name}
                        </Link>
                        {c.package && <span className="block text-caption text-ink-3">{c.package}</span>}
                        <span className="mt-1 block sm:hidden">{mt ? <HealthDot health={mt.health} /> : <span className="text-caption text-ink-3">Not analysed</span>}</span>
                      </td>
                      <td className={cx(td, COL.mrr, 'text-ink')}>{money(c.monthly_recurring_revenue)}</td>
                      {view === 'overview' ? (
                        <>
                          <td className={cx(td, COL.users)}>{mt ? <SeatCount actual={mt.users} contracted={c.contracted_users} noun="users" /> : dash}</td>
                          <td className={cx(td, COL.devices)}>{mt ? <SeatCount actual={mt.devices} contracted={c.contracted_devices} noun="devices" /> : dash}</td>
                          <td className={cx(td, COL.support, 'text-ink-2')}>{mt ? hours(mt.avg_monthly_hours) : dash}</td>
                          <td className={cx(td, COL.margin)}>{mt ? <MarginValue margin={mt.margin} target={target} /> : dash}</td>
                          <td className={cx(td, 'pr-4 sm:pr-3')}>{mt ? <LeakageCell leakage={leakage} max={maxLeakage} /> : dash}</td>
                        </>
                      ) : (
                        <>
                          <td className={cx(td, COL.labour, 'text-ink-2')}>{mt ? money(mt.labour_cost) : dash}</td>
                          <td className={cx(td, COL.software, 'text-ink-2')}>{mt ? money(mt.software_cost) : dash}</td>
                          <td className={cx(td, mt && mt.contribution < 0 ? 'font-semibold text-danger' : 'text-ink')}>{mt ? money(mt.contribution) : dash}</td>
                          <td className={cx(td, COL.perHour, 'text-ink-2')}>{mt?.revenue_per_hour ? money(mt.revenue_per_hour) : dash}</td>
                          <td className={cx(td, 'pr-4 sm:pr-3')}>{mt ? <MarginValue margin={mt.margin} target={target} /> : dash}</td>
                        </>
                      )}
                      <td className={cx('py-3 pl-3 pr-5', COL.health)}>{mt ? <HealthDot health={mt.health} /> : <span className="text-caption text-ink-3">Not analysed</span>}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center">
                        <p className="text-body text-ink-2">No clients match “{q}”.</p>
                        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setQ('')}>
                          Clear search
                        </Button>
                      </td>
                    </tr>
                  )}
                </tbody>
                {analysis && withMt.length > 1 && (
                  <tfoot>
                    <tr className="border-t border-line bg-sunken font-semibold text-ink">
                      <td className="py-3 pl-4 pr-3 text-small sm:pl-5">
                        {rows.length === all.length ? 'All clients' : `${rows.length} of ${all.length} clients`}
                        {view === 'overview' && <span className="block text-caption font-normal text-ink-3 sm:hidden">{money(totalMrr)} MRR</span>}
                      </td>
                      <td className={cx(td, COL.mrr)}>{money(totalMrr)}</td>
                      {view === 'overview' ? (
                        <>
                          <td className={COL.users} />
                          <td className={COL.devices} />
                          <td className={cx(td, COL.support, 'font-normal text-ink-3')}>{avg ? `avg ${hours(avg)}` : ''}</td>
                          <td className={cx(td, COL.margin)}>{totalMtMrr > 0 && <MarginValue margin={totalContribution / totalMtMrr} target={target} />}</td>
                          <td className={cx(td, 'pr-4 sm:pr-3')}>
                            <LeakageCell leakage={totalLeakage} />
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={cx(td, COL.labour)}>{money(sum((r) => r.mt.labour_cost))}</td>
                          <td className={cx(td, COL.software)}>{money(sum((r) => r.mt.software_cost))}</td>
                          <td className={cx(td, totalContribution < 0 && 'text-danger')}>{money(totalContribution)}</td>
                          <td className={COL.perHour} />
                          <td className={cx(td, 'pr-4 sm:pr-3')}>{totalMtMrr > 0 && <MarginValue margin={totalContribution / totalMtMrr} target={target} />}</td>
                        </>
                      )}
                      <td className={COL.health} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
          <p className="mt-3 max-w-[90ch] text-caption text-ink-3">
            {view === 'overview'
              ? `Users and devices show supported / contracted; anything above contract carries an up arrow. The bar ranks each client's potential leakage over ${months ? plural(months, 'month') : 'the period'} against the largest. `
              : 'Contribution is MRR less estimated labour and software, before overheads. '}
            Margins below your {Math.round(target * 100)}% target carry a red dot.
          </p>
        </>
      )}
      <AddClientModal open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
