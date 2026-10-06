import { useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Button, Card, EmptyState, Field, HealthDot, Modal, PageHeader, cx, inputCls } from '../../components/ui'
import { useToast } from '../../components/toast'
import { hours, money, pct } from '../../lib/format'
import { parseNumber } from '../../data/importers'

export function AddClientModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { createClient, data } = useStore()
  const toast = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', mrr: '', users: '', devices: '', pkg: '', included: '', software: '' })
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  const submit = async () => {
    setError(null)
    if (!form.name.trim()) return setError('Enter the client name.')
    if (data.clients.some((c) => c.name.toLowerCase() === form.name.trim().toLowerCase())) return setError('A client with this name already exists.')
    const mrr = parseNumber(form.mrr)
    if (mrr == null || mrr < 0) return setError('Enter the monthly recurring revenue as a number.')
    for (const [k, label] of [['users', 'Contracted users'], ['devices', 'Contracted devices'], ['included', 'Included hours'], ['software', 'Software cost']] as const)
      if (form[k] && parseNumber(form[k]) == null) return setError(`${label} must be a number.`)
    const c = await createClient({
      name: form.name,
      monthly_recurring_revenue: mrr,
      contracted_users: parseNumber(form.users),
      contracted_devices: parseNumber(form.devices),
      package: form.pkg.trim() || null,
      included_hours: parseNumber(form.included),
      monthly_software_cost: parseNumber(form.software),
    })
    setForm({ name: '', mrr: '', users: '', devices: '', pkg: '', included: '', software: '' })
    onClose()
    if (onCreated) return onCreated(c.id)
    toast(`${c.name} added. Upload their tickets and contract, then re-run the analysis.`)
    nav(`/app/clients/${c.id}`)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add client"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add client</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Client name">
            <input className={inputCls} value={form.name} onChange={set('name')} autoFocus />
          </Field>
        </div>
        <Field label="Monthly recurring revenue (£)">
          <input className={inputCls} inputMode="decimal" value={form.mrr} onChange={set('mrr')} placeholder="1500" />
        </Field>
        <Field label="Package">
          <input className={inputCls} value={form.pkg} onChange={set('pkg')} placeholder="Business Pro" />
        </Field>
        <Field label="Contracted users">
          <input className={inputCls} inputMode="numeric" value={form.users} onChange={set('users')} />
        </Field>
        <Field label="Contracted devices">
          <input className={inputCls} inputMode="numeric" value={form.devices} onChange={set('devices')} />
        </Field>
        <Field label="Included hours / month" hint="Only for block-hours agreements">
          <input className={inputCls} inputMode="decimal" value={form.included} onChange={set('included')} />
        </Field>
        <Field label="Software cost / month (£)" hint="Your cost for tools and licences">
          <input className={inputCls} inputMode="decimal" value={form.software} onChange={set('software')} />
        </Field>
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </Modal>
  )
}

export default function Clients() {
  const { data, analysis } = useStore()
  const m = useMetrics()
  const nav = useNavigate()
  const [view, setView] = useState<'overview' | 'profitability'>('overview')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const metrics = useMemo(() => new Map((analysis?.summary.client_metrics ?? []).map((c) => [c.client_id, c])), [analysis])

  const rows = data.clients
    .filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()))
    .map((c) => ({ c, mt: metrics.get(c.id), leakage: m.leakageByClient.get(c.id) ?? 0 }))
    .sort((a, b) => b.leakage - a.leakage || a.c.name.localeCompare(b.c.name))
  const avg = analysis?.summary.average_monthly_hours

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={analysis ? `Support hours and margins are monthly averages for ${analysis.summary.period_label}${avg ? ` · client average ${hours(avg)}/month` : ''}` : 'Your managed service clients'}
        actions={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Add client
          </Button>
        }
      />
      {data.clients.length === 0 ? (
        <Card>
          <EmptyState title="No clients yet" body="Add a client manually, upload a Clients CSV, or load the demo MSP from the Data page." action={<><Button onClick={() => setAdding(true)}>Add client</Button><Button variant="secondary" onClick={() => nav('/app/data')}>Go to data</Button></>} />
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 text-sm" role="tablist">
              {(['overview', 'profitability'] as const).map((v) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cx('rounded-md px-3 py-1.5 font-medium capitalize', view === v ? 'bg-zinc-900 text-white' : 'text-zinc-600 hover:text-zinc-900')}>
                  {v}
                </button>
              ))}
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input className={cx(inputCls, 'pl-9')} placeholder="Search clients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search clients" />
            </div>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs text-zinc-500">
                    <th className="px-5 py-2.5 font-medium">Client</th>
                    <th className="px-3 py-2.5 text-right font-medium">MRR</th>
                    {view === 'overview' ? (
                      <>
                        <th className="px-3 py-2.5 text-right font-medium">Users</th>
                        <th className="px-3 py-2.5 text-right font-medium">Devices</th>
                        <th className="px-3 py-2.5 text-right font-medium">Support</th>
                        <th className="px-3 py-2.5 text-right font-medium">Leakage</th>
                      </>
                    ) : (
                      <>
                        <th className="px-3 py-2.5 text-right font-medium">Software</th>
                        <th className="px-3 py-2.5 text-right font-medium">Labour</th>
                        <th className="px-3 py-2.5 text-right font-medium">Contribution</th>
                        <th className="px-3 py-2.5 text-right font-medium">£ / tech hour</th>
                      </>
                    )}
                    <th className="px-3 py-2.5 text-right font-medium">Margin</th>
                    <th className="px-5 py-2.5 font-medium">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map(({ c, mt, leakage }) => {
                    const over = (n: number, of: number | null) => (of != null && n > of ? 'text-orange-700 font-semibold' : '')
                    return (
                      <tr key={c.id} className="cursor-pointer hover:bg-zinc-50" onClick={() => nav(`/app/clients/${c.id}`)}>
                        <td className="px-5 py-3">
                          <Link to={`/app/clients/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">
                            {c.name}
                          </Link>
                          {c.package && <span className="block text-xs text-zinc-500">{c.package}</span>}
                        </td>
                        <td className="tnum px-3 py-3 text-right">{money(c.monthly_recurring_revenue)}</td>
                        {view === 'overview' ? (
                          <>
                            <td className={cx('tnum px-3 py-3 text-right', mt && over(mt.users, c.contracted_users))} title={c.contracted_users != null ? `${c.contracted_users} contracted` : undefined}>
                              {mt ? mt.users || '—' : '—'}
                            </td>
                            <td className={cx('tnum px-3 py-3 text-right', mt && over(mt.devices, c.contracted_devices))} title={c.contracted_devices != null ? `${c.contracted_devices} contracted` : undefined}>
                              {mt ? mt.devices || '—' : '—'}
                            </td>
                            <td className="tnum px-3 py-3 text-right">{mt ? hours(mt.avg_monthly_hours) : '—'}</td>
                            <td className="tnum px-3 py-3 text-right font-semibold">{leakage ? money(leakage) : <span className="font-normal text-zinc-400">£0</span>}</td>
                          </>
                        ) : (
                          <>
                            <td className="tnum px-3 py-3 text-right">{mt ? money(mt.software_cost) : '—'}</td>
                            <td className="tnum px-3 py-3 text-right">{mt ? money(mt.labour_cost) : '—'}</td>
                            <td className="tnum px-3 py-3 text-right">{mt ? money(mt.contribution) : '—'}</td>
                            <td className="tnum px-3 py-3 text-right">{mt?.revenue_per_hour ? money(mt.revenue_per_hour) : '—'}</td>
                          </>
                        )}
                        <td className="tnum px-3 py-3 text-right">{mt ? pct(mt.margin) : '—'}</td>
                        <td className="px-5 py-3">{mt ? <HealthDot health={mt.health} /> : <span className="text-xs text-zinc-400">Not analysed</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-xs text-zinc-500">Users and devices above the contracted number are shown in orange. Margin is after estimated labour and software costs, before overheads.</p>
        </>
      )}
      <AddClientModal open={adding} onClose={() => setAdding(false)} />
    </>
  )
}
