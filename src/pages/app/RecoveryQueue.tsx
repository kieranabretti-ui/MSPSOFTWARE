import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import { openish, useMetrics, useStore } from '../../data/store'
import { Button, ButtonLink, Card, EmptyState, Field, Modal, PageHeader, TextLink, cx, inputCls } from '../../components/ui'
import { useToast } from '../../components/toast'
import { money, plural, relative } from '../../lib/format'
import { ACTION_STATUS, CATEGORY_META } from '../../lib/labels'
import { parseNumber } from '../../data/importers'
import type { ActionStatus, Finding } from '../../engine/types'
import { Callout, Select } from './data/kit'

const TABS: (ActionStatus | 'all')[] = ['open', 'in_progress', 'resolved', 'dismissed', 'all']

// Status dots: shape and colour together, so the stage reads without colour.
// Open is a hollow ring, work in progress is filled, resolved is the success hue.
const DOT: Record<ActionStatus, string> = {
  open: 'border-[1.5px] border-ink-2',
  in_progress: 'bg-info',
  resolved: 'bg-success',
  dismissed: 'bg-ink-4',
}

function Dot({ status, className }: { status: ActionStatus; className?: string }) {
  return <span className={cx('inline-block size-2 shrink-0 rounded-full', DOT[status], className)} aria-hidden />
}

// Before the first action: the largest open findings as a short ledger, each
// one a step from becoming tracked recovery work.
function StartWith({ findings, clientName, openCount, openValue }: { findings: Finding[]; clientName: (id: string) => string; openCount: number; openValue: number }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4 border-b border-line-soft px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-h3 text-ink">Start with these</h2>
          <p className="mt-0.5 text-small text-ink-3">No actions yet. Your largest open findings, ready to track through to recovery.</p>
        </div>
        <TextLink to="/app/findings" className="shrink-0 pb-0.5">
          Review findings
        </TextLink>
      </div>
      <ol className="divide-y divide-line-soft">
        {findings.map((f) => (
          <li key={f.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:grid-cols-[minmax(0,1fr)_6rem_9rem] sm:px-5">
            <div className="min-w-0">
              <Link to={`/app/findings/${f.id}`} className="block truncate text-body font-medium text-ink underline-offset-4 hover:underline">
                {f.title}
              </Link>
              <p className="mt-0.5 truncate text-caption text-ink-3">
                {clientName(f.client_id)} · {CATEGORY_META[f.category].short}
              </p>
            </div>
            <span className="tnum text-right text-body font-semibold text-ink">{money(f.estimated_value)}</span>
            <Link
              to={`/app/findings/${f.id}?action=new`}
              aria-label={`Create action for ${f.title}`}
              className="group col-span-2 inline-flex items-center gap-1 justify-self-start rounded-sm text-small font-medium text-ink-2 transition-colors hover:text-ink sm:col-span-1 sm:justify-self-end"
            >
              Create action
              <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ol>
      {openCount > findings.length && (
        <p className="tnum border-t border-line-soft px-4 py-3 text-caption text-ink-3 sm:px-5">
          {plural(openCount, 'open finding')} worth {money(openValue)} potential in all.
        </p>
      )}
    </div>
  )
}

export default function Actions() {
  const { data, setActionStatus, createAction } = useStore()
  const m = useMetrics()
  const toast = useToast()
  const formId = useId()
  const [tab, setTab] = useState<ActionStatus | 'all'>('open')
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', client: '', value: '', notes: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const rows = data.actions.filter((a) => tab === 'all' || a.status === tab).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const stage = (t: ActionStatus | 'all') => {
    const list = t === 'all' ? data.actions : data.actions.filter((a) => a.status === t)
    return { n: list.length, value: list.reduce((s, a) => s + a.value, 0) }
  }

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (saving) return
    setError(null)
    if (!form.title.trim()) return setError('Describe the action.')
    const value = form.value ? parseNumber(form.value) : 0
    if (value == null) return setError('Potential value must be a number.')
    setSaving(true)
    try {
      await createAction({ title: form.title.trim(), notes: form.notes, value, client_id: form.client || null })
      setForm({ title: '', client: '', value: '', notes: '' })
      setCreating(false)
      setTab('open')
      toast('Action created.')
    } finally {
      setSaving(false)
    }
  }

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const j = (i + d + TABS.length) % TABS.length
    setTab(TABS[j])
    tabRefs.current[j]?.focus()
  }

  const startWith = data.findings
    .filter(openish)
    .sort((a, b) => b.estimated_value - a.estimated_value)
    .slice(0, 3)
  return (
    <>
      <PageHeader
        title="Actions"
        subtitle="The work that turns findings into recovered revenue."
        actions={
          <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
            <Plus className="size-4 shrink-0" aria-hidden /> New action
          </Button>
        }
      />

      {data.actions.length > 0 && m.openCount > 0 && (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-small text-ink-2">
            <span className="tnum font-semibold text-ink">{plural(m.openCount, 'finding')}</span> worth <span className="tnum font-semibold text-ink">{money(m.openValue)}</span> potential{' '}
            {m.openCount === 1 ? 'is' : 'are'} not yet resolved or dismissed.
          </p>
          <ButtonLink to="/app/findings" variant="ghost" size="sm" className="-mx-2 self-start sm:mx-0 sm:self-auto">
            Review findings
          </ButtonLink>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Show actions by stage"
        className={cx('mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line-soft sm:grid-cols-5', !data.actions.length && 'hidden')}
      >
        {TABS.map((t, i) => {
          const { n, value } = stage(t)
          const selected = tab === t
          const label = t === 'all' ? 'All' : ACTION_STATUS[t]
          return (
            <button
              key={t}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              role="tab"
              id={`actions-tab-${t}`}
              aria-selected={selected}
              aria-controls="actions-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(t)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cx(
                'flex min-w-0 flex-col items-start gap-1.5 px-4 py-3 text-left transition-colors duration-150 focus-visible:z-10 focus-visible:outline-offset-[-2px]',
                t === 'all' && 'col-span-2 sm:col-span-1',
                selected ? 'bg-raised shadow-[inset_0_-2px_0_var(--color-ink)]' : 'bg-surface hover:bg-hover',
              )}
            >
              <span className={cx('flex items-center gap-2 text-small font-medium', selected ? 'text-ink' : 'text-ink-2')}>
                {t !== 'all' && <Dot status={t} />}
                {label}
                <span className="tnum font-normal text-ink-3">{n}</span>
              </span>
              <span className={cx('tnum text-data-md', t === 'resolved' && value > 0 ? 'text-accent' : t === 'dismissed' ? 'text-ink-3' : selected ? 'text-ink' : 'text-ink-2')}>{money(value)}</span>
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        <div id="actions-panel" role="tabpanel" aria-labelledby={`actions-tab-${tab}`}>
          {rows.length ? (
            <ul className="divide-y divide-line-soft">
              {rows.map((a) => {
                const finding = data.findings.find((f) => f.id === a.finding_id)
                const done = a.status === 'dismissed'
                // Actions created from a finding carry a note that repeats the
                // line above them; show the note only when it adds something.
                const notes = a.notes && finding && a.notes.includes(finding.title) ? null : a.notes
                return (
                  <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-150 hover:bg-hover sm:px-5 md:grid-cols-[minmax(0,1fr)_7rem_10.5rem]">
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <p className={cx('text-body font-medium', done ? 'text-ink-3' : 'text-ink')}>{a.title}</p>
                      <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-ink-3">
                        <span className="text-ink-2">{a.client_id ? m.clientName(a.client_id) : 'No client'}</span>
                        {finding && (
                          <>
                            <span aria-hidden>·</span>
                            <Link to={`/app/findings/${finding.id}`} className="min-w-0 max-w-full truncate rounded-xs underline-offset-4 transition-colors hover:text-ink hover:underline">
                              {finding.title}
                            </Link>
                          </>
                        )}
                        <span aria-hidden>·</span>
                        <span className="tnum">Created {relative(a.created_at)}</span>
                      </p>
                      {notes && <p className="mt-1.5 line-clamp-2 max-w-[72ch] text-small text-ink-2">{notes}</p>}
                    </div>
                    <span className={cx('tnum text-body font-semibold md:text-right', done ? 'text-ink-3' : 'text-ink')}>{money(a.value)}</span>
                    <Select
                      className="w-40 justify-self-end md:w-full"
                      lead={<Dot status={a.status} />}
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
                    </Select>
                  </li>
                )
              })}
            </ul>
          ) : data.actions.length ? (
            <EmptyState
              title={tab === 'all' ? 'No actions' : `Nothing ${ACTION_STATUS[tab].toLowerCase()}`}
              body={tab === 'resolved' ? 'Resolve an action when the money is billed or the agreement is updated. Its value counts here.' : 'Actions in other stages are in the other tabs.'}
            />
          ) : startWith.length ? (
            <StartWith findings={startWith} clientName={m.clientName} openCount={m.openCount} openValue={m.openValue} />
          ) : (
            <EmptyState title="No actions yet" body="Open a finding and choose Create action to track the work of recovering it, or add your own with New action." />
          )}
        </div>
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
            <Button type="submit" form={formId} loading={saving}>
              Create action
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
          <Field label="Action">
            <input className={inputCls} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Review contract and update recurring charge" autoFocus aria-invalid={error === 'Describe the action.' || undefined} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Client">
              <Select value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })}>
                <option value="">No client</option>
                {[...data.clients]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Potential value" hint="Your estimate. Leave blank if unknown.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-3">£</span>
                <input className={cx(inputCls, 'tnum pl-7')} inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0" />
              </div>
            </Field>
          </div>
          <Field label="Notes" hint="Optional. Who is doing it, and what was agreed.">
            <textarea className={cx(inputCls, 'h-24 resize-y py-2')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          {error && (
            <Callout tone="danger" alert>
              {error}
            </Callout>
          )}
        </form>
      </Modal>
    </>
  )
}
