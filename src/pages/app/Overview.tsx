import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Database, FileText, Play, Sparkles, Upload } from 'lucide-react'
import { useMetrics, useStore, openish } from '../../data/store'
import { Button, ButtonLink, Card, CardHeader, Disclaimer, EmptyState, HealthDot, PageHeader, SeverityBadge } from '../../components/ui'
import { TrendChart } from '../../components/charts'
import { useToast } from '../../components/toast'
import { money, plural, relative } from '../../lib/format'
import { CATEGORY_META, PRIMARY_CATEGORIES, ALL_CATEGORIES } from '../../lib/labels'

export function GetStarted() {
  const { loadDemoData, data } = useStore()
  const toast = useToast()
  const nav = useNavigate()
  const hasData = data.tickets.length + data.clients.length > 0
  return (
    <Card>
      <EmptyState
        icon={<Sparkles className="size-5" />}
        title={hasData ? 'Your data is ready to analyse' : 'Find out where your MSP is losing money'}
        body={
          hasData
            ? 'Run the analysis to check your tickets, time, agreements and billing for revenue leakage.'
            : 'Upload exports from your PSA and billing system, or load a realistic demo MSP to see a full analysis in seconds.'
        }
        action={
          hasData ? (
            <ButtonLink to="/app/data">
              <Play className="size-4" /> Go to data and run analysis
            </ButtonLink>
          ) : (
            <>
              <Button
                onClick={async () => {
                  try {
                    await loadDemoData()
                    toast('Demo MSP loaded and analysed.')
                    nav('/app')
                  } catch (e) {
                    toast(e instanceof Error ? e.message : 'Could not load demo data.', 'error')
                  }
                }}
              >
                <Database className="size-4" /> Load demo data
              </Button>
              <ButtonLink to="/app/data" variant="secondary">
                <Upload className="size-4" /> Upload your data
              </ButtonLink>
            </>
          )
        }
      />
    </Card>
  )
}

export default function Overview() {
  const { analysis, data, workspace } = useStore()
  const m = useMetrics()

  if (!analysis)
    return (
      <>
        <PageHeader title="Revenue Protection" subtitle={workspace?.name} />
        <GetStarted />
      </>
    )

  const s = analysis.summary
  const top = data.findings.filter((f) => f.status !== 'dismissed').sort((a, b) => b.estimated_value - a.estimated_value).slice(0, 5)
  const risky = s.client_metrics
    .map((c) => ({ ...c, leakage: m.leakageByClient.get(c.client_id) ?? 0 }))
    .filter((c) => c.health !== 'healthy' || c.leakage > 0)
    .sort((a, b) => (a.health === b.health ? b.leakage - a.leakage : a.health === 'at_risk' ? -1 : b.health === 'at_risk' ? 1 : a.health === 'watch' ? -1 : 1))
    .slice(0, 6)
  const others = ALL_CATEGORIES.filter((c) => !PRIMARY_CATEGORIES.includes(c) && m.byCategory[c])
  const activeActions = data.actions.filter((a) => a.status === 'open' || a.status === 'in_progress')

  return (
    <>
      <PageHeader
        title="Revenue Protection"
        subtitle={
          <>
            {s.period_label} · {plural(s.data_counts.tickets, 'ticket')} and {plural(s.data_counts.clients, 'client')} analysed {relative(analysis.created_at)}
          </>
        }
        actions={
          <>
            <ButtonLink to="/app/data" variant="secondary" size="sm">
              <Upload className="size-3.5" /> Data
            </ButtonLink>
            <ButtonLink to="/app/reports" size="sm">
              <FileText className="size-3.5" /> View report
            </ButtonLink>
          </>
        }
      />

      {/* hero */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
          <div className="p-6 sm:p-8">
            <p className="text-sm font-medium text-zinc-500">Potential revenue leakage identified</p>
            <p className="tnum mt-2 text-5xl font-semibold tracking-tight text-zinc-950 sm:text-6xl" data-testid="hero-total">
              {money(m.total)}
            </p>
            <p className="mt-3 text-sm text-zinc-500">
              Across {plural(m.count, 'finding')} in {s.period_label}.{' '}
              <Link to="/app/findings" className="font-medium text-zinc-900 underline-offset-2 hover:underline">
                Review findings
              </Link>
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-zinc-100 lg:grid-cols-1 lg:border-l lg:border-t-0">
            <div className="border-r border-zinc-100 p-6 lg:border-b lg:border-r-0">
              <p className="tnum text-2xl font-semibold tracking-tight">
                {money(m.monthly)}
                <span className="text-base font-medium text-zinc-500">/month</span>
              </p>
              <p className="mt-1 text-[13px] text-zinc-500">Recurring leakage, if left uncorrected</p>
            </div>
            <div className="p-6">
              <p className="tnum text-2xl font-semibold tracking-tight">{money(m.annual)}</p>
              <p className="mt-1 text-[13px] text-zinc-500">Annualised recurring opportunity</p>
            </div>
          </div>
        </div>
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-6 py-3 sm:px-8">
          <Disclaimer />
        </div>
      </Card>

      {/* categories */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PRIMARY_CATEGORIES.map((c) => {
          const v = m.byCategory[c]
          const isClients = c === 'UNDERPRICED_CLIENT'
          return (
            <Link key={c} to={`/app/findings?category=${c}`} className="group rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm sm:p-5">
              <div className="flex items-start justify-between">
                <p className="text-[13px] font-medium text-zinc-600">{CATEGORY_META[c].label}</p>
                <ArrowUpRight className="size-4 text-zinc-300 transition group-hover:text-zinc-600" />
              </div>
              <p className="tnum mt-3 text-2xl font-semibold tracking-tight">{money(v?.value ?? 0)}</p>
              <p className="mt-1 text-xs text-zinc-500">{isClients ? plural(v?.clients.size ?? 0, 'client') : plural(v?.count ?? 0, 'finding')}</p>
            </Link>
          )
        })}
      </div>
      {others.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {others.map((c) => (
            <Link key={c} to={`/app/findings?category=${c}`} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[13px] text-zinc-600 hover:border-zinc-300">
              {CATEGORY_META[c].label}
              <span className="tnum font-semibold text-zinc-900">{money(m.byCategory[c].value)}</span>
              <span className="text-zinc-400">· {m.byCategory[c].count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* opportunities strip */}
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <p className="text-sm">
            <span className="tnum text-lg font-semibold">{m.openCount}</span> <span className="text-zinc-600">open revenue opportunities</span>
          </p>
          <p className="text-sm">
            <span className="tnum text-lg font-semibold">{money(m.openValue)}</span> <span className="text-zinc-600">potential value</span>
          </p>
          {activeActions.length > 0 && (
            <p className="text-sm">
              <span className="tnum text-lg font-semibold">{activeActions.length}</span> <span className="text-zinc-600">actions in progress</span>
            </p>
          )}
          {m.resolvedValue > 0 && (
            <p className="text-sm">
              <span className="tnum text-lg font-semibold text-emerald-700">{money(m.resolvedValue)}</span> <span className="text-zinc-600">resolved</span>
            </p>
          )}
        </div>
        <ButtonLink to="/app/actions" variant="secondary" size="sm">
          Open actions <ArrowRight className="size-3.5" />
        </ButtonLink>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Revenue leakage trend" subtitle="Potential leakage attributed to each month" />
          <div className="px-3 pb-4 pt-4 sm:px-5">
            <TrendChart data={m.trend} />
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Top 5 leakage sources" right={<Link to="/app/findings" className="text-[13px] font-medium text-zinc-600 hover:text-zinc-900">All findings</Link>} />
          <ol className="divide-y divide-zinc-100">
            {top.map((f, i) => (
              <li key={f.id}>
                <Link to={`/app/findings/${f.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-zinc-50">
                  <span className="tnum mt-0.5 w-4 text-xs font-medium text-zinc-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">{f.title}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {m.clientName(f.client_id)} · {CATEGORY_META[f.category].short}
                    </p>
                  </div>
                  <span className="tnum text-sm font-semibold">{money(f.estimated_value)}</span>
                </Link>
              </li>
            ))}
            {!top.length && <li className="px-5 py-8 text-center text-sm text-zinc-500">No leakage found.</li>}
          </ol>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Highest risk clients" subtitle="Clients with the most potential leakage or weakest margins" right={<Link to="/app/clients" className="text-[13px] font-medium text-zinc-600 hover:text-zinc-900">All clients</Link>} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                <th className="px-5 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 text-right font-medium">Leakage</th>
                <th className="px-3 py-2.5 font-medium">Risk</th>
                <th className="px-5 py-2.5 font-medium">Main reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {risky.map((c) => (
                <tr key={c.client_id} className="hover:bg-zinc-50">
                  <td className="px-5 py-3 font-medium">
                    <Link to={`/app/clients/${c.client_id}`} className="hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="tnum px-3 py-3 text-right font-semibold">{money(c.leakage)}</td>
                  <td className="px-3 py-3">
                    <HealthDot health={c.health} />
                  </td>
                  <td className="max-w-[360px] truncate px-5 py-3 text-zinc-600">{c.reasons[0] ?? 'Potentially billable work found'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {data.findings.some((f) => openish(f) && f.severity === 'CRITICAL') && (
        <div className="mt-6 flex items-center gap-2 text-sm text-zinc-600">
          <SeverityBadge severity="CRITICAL" /> findings need attention first.
        </div>
      )}
    </>
  )
}
