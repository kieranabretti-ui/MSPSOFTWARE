import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks, Plus } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Button, Card, EmptyState, Field, Modal, PageHeader, cx, inputCls } from '../../components/ui'
import { useToast } from '../../components/toast'
import { money, plural, relative } from '../../lib/format'
import { ACTION_STATUS } from '../../lib/labels'
import { parseNumber } from '../../data/importers'
import type { ActionStatus } from '../../engine/types'

const TABS: (ActionStatus | 'all')[] = ['open', 'in_progress', 'resolved', 'dismissed', 'all']
const DOT: Record<ActionStatus, string> = { open: 'bg-ink-3', in_progress: 'bg-info', resolved: 'bg-success', dismissed: 'bg-ink-4' }

export default function Actions() {
  const { data, setActionStatus, createAction } = useStore()
  const m = useMetrics()
  const toast = useToast()
  const [tab, setTab] = useState<ActionStatus | 'all'>('open')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', client: '', value: '', notes: '' })
  const [error, setError] = useState<string | null>(null)

  const rows = data.actions.filter((a) => tab === 'all' || a.status === tab).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const active = data.actions.filter((a) => a.status === 'open' || a.status === 'in_progress')
  const recovered = data.actions.filter((a) => a.status === 'resolved').reduce((s, a) => s + a.value, 0)

  const submit = async () => {
    setError(null)
    if (!form.title.trim()) return setError('Describe the action.')
    const value = form.value ? parseNumber(form.value) : 0
    if (value == null) return setError('Potential value must be a number.')
    await createAction({ title: form.title.trim(), notes: form.notes, value, client_id: form.client || null })
    setForm({ title: '', client: '', value: '', notes: '' })
    setCreating(false)
    setTab('open')
    toast('Action created.')
  }

  return (
    <>
      <PageHeader
        title="Actions"
        subtitle="Turn findings into recovered revenue."
        actions={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" /> New action
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Open revenue opportunities', value: String(m.openCount), sub: 'Findings not yet resolved or dismissed' },
          { label: 'Potential value', value: money(m.openValue), sub: 'Of open opportunities' },
          { label: 'Actions in progress', value: String(active.length), sub: money(active.reduce((s, a) => s + a.value, 0)) + ' potential' },
          { label: 'Resolved actions', value: money(recovered), sub: 'Potential value actioned' },
        ].map((s) => (
          <Card key={s.label} className="p-4 sm:p-5">
            <p className="text-small text-ink-3">{s.label}</p>
            <p className="tnum mt-2 text-2xl font-semibold tracking-tight">{s.value}</p>
            <p className="mt-1 text-caption text-ink-3">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="mb-3 flex gap-1 overflow-x-auto" role="tablist">
        {TABS.map((t) => {
          const n = t === 'all' ? data.actions.length : data.actions.filter((a) => a.status === t).length
          return (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('whitespace-nowrap rounded-md px-3 py-1.5 text-body font-medium', tab === t ? 'bg-raised text-ink ring-1 ring-inset ring-line-strong' : 'text-ink-2 hover:bg-raised')}>
              {t === 'all' ? 'All' : ACTION_STATUS[t]} <span className={cx('tnum ml-1 text-caption', tab === t ? 'text-ink-4' : 'text-ink-3')}>{n}</span>
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        {rows.length ? (
          <ul className="divide-y divide-line-soft">
            {rows.map((a) => {
              const finding = data.findings.find((f) => f.id === a.finding_id)
              return (
                <li key={a.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <span className={cx('hidden size-2 shrink-0 rounded-full sm:block', DOT[a.status])} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium">{a.title}</p>
                    <p className="mt-0.5 truncate text-caption text-ink-3">
                      {a.client_id ? m.clientName(a.client_id) : 'No client'}
                      {finding && (
                        <>
                          {' · '}
                          <Link to={`/app/findings/${finding.id}`} className="hover:text-ink hover:underline">
                            {finding.title}
                          </Link>
                        </>
                      )}
                      {' · '}created {relative(a.created_at)}
                    </p>
                    {a.notes && <p className="mt-1 text-caption text-ink-2">{a.notes}</p>}
                  </div>
                  <span className="tnum text-body font-semibold sm:w-20 sm:text-right">{money(a.value)}</span>
                  <select
                    className={cx(inputCls, 'h-8 w-full text-small sm:w-36')}
                    value={a.status}
                    onChange={async (e) => {
                      const s = e.target.value as ActionStatus
                      await setActionStatus(a.id, s)
                      toast(s === 'resolved' && a.finding_id ? 'Action resolved. The finding is marked as resolved too.' : `Moved to ${ACTION_STATUS[s].toLowerCase()}.`)
                    }}
                    aria-label="Action status"
                  >
                    {Object.entries(ACTION_STATUS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<ListChecks className="size-5" />}
            title={data.actions.length ? `No ${tab === 'all' ? '' : ACTION_STATUS[tab as ActionStatus].toLowerCase()} actions` : 'No actions yet'}
            body={data.actions.length ? 'Actions in other states are in the other tabs.' : `Open a finding and choose “Create action” to start recovering revenue. You have ${plural(m.openCount, 'open opportunity', 'open opportunities')}.`}
            action={!data.actions.length && m.openCount > 0 ? <Link to="/app/findings" className="text-body font-medium underline">Review findings</Link> : undefined}
          />
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New action"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Create action</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Action">
            <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Review contract and update recurring charge" autoFocus />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client">
              <select className={inputCls} value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
                <option value="">No client</option>
                {data.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Potential value (£)">
              <input className={inputCls} inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={cx(inputCls, 'h-20 py-2')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">{error}</p>}
        </div>
      </Modal>
    </>
  )
}
