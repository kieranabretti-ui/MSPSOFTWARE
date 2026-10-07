import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, RotateCcw } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Button, ButtonLink, Card, CardHeader, EmptyState, Field, Modal, PageHeader, cx, inputCls } from '../../components/ui'
import { ConfidenceLevel } from '../../components/ConfidenceLevel'
import { useToast } from '../../components/toast'
import { money, plural, relative } from '../../lib/format'
import { confidenceOf } from '../../lib/confidence'
import { mapError } from '../../lib/errors'
import { ACTION_STATUS, CATEGORY_META, CONFIDENCE, FINDING_STATUS, LEVEL_ORDER, NEXT_STAGE, STAGE_ORDER } from '../../lib/labels'
import { parseNumber } from '../../data/importers'
import type { Action, ActionStatus, Finding, FindingStatus } from '../../engine/types'
import { Callout, Select } from './data/kit'
import { OpportunityTabs } from './findings/OpportunityTabs'
import { REOPENED_TOAST } from './findings/StageControl'
import { StageMark, TASK_STATUS_OPTIONS, TaskDot } from './findings/StatusTag'

// What each empty stage is for, and how things get there.
const EMPTY_STAGE: Record<FindingStatus, string> = {
  open: 'Every opportunity has moved on. New ones from your next analysis start here.',
  reviewing: "Start a review from New when you're ready to check an opportunity.",
  valid: "Approve an opportunity once you've checked the evidence.",
  resolved: "Mark an opportunity actioned once you've billed it, updated the agreement or repriced the client.",
  dismissed: 'Dismissed opportunities stop counting towards potential leakage.',
}

const PAGE = 100
const isStage = (v: string | null): v is FindingStatus => !!v && (STAGE_ORDER as string[]).includes(v)

// The one button on each row: the next stage, or Reopen once it's settled.
function rowStep(status: FindingStatus): { to: FindingStatus; label: string; toast: string } {
  return NEXT_STAGE[status] ?? { to: 'open', label: 'Reopen', toast: REOPENED_TOAST }
}

export default function RecoveryQueue() {
  const { data, analysis, setFindingStatus, setActionStatus, createAction } = useStore()
  const m = useMetrics()
  const toast = useToast()
  const formId = useId()
  const [params, setParams] = useSearchParams()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const refocus = useRef<number | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)

  // Opens on ?stage= when given, otherwise on the first stage with work in it.
  const [tab, setTabState] = useState<FindingStatus>(() => {
    const asked = params.get('stage')
    if (isStage(asked)) return asked
    return (['open', 'reviewing', 'valid'] as FindingStatus[]).find((s) => m.byStage[s].count > 0) ?? 'open'
  })
  const setTab = (s: FindingStatus) => {
    setTabState(s)
    setLimit(PAGE)
    const next = new URLSearchParams(params)
    next.set('stage', s)
    setParams(next, { replace: true })
  }

  // The latest task on each opportunity, shown under its row.
  const latestTask = useMemo(() => {
    const out = new Map<string, Action>()
    for (const a of data.actions) {
      if (!a.finding_id) continue
      const prev = out.get(a.finding_id)
      if (!prev || a.created_at > prev.created_at) out.set(a.finding_id, a)
    }
    return out
  }, [data.actions])

  // Most certain first, then the largest.
  const rows = useMemo(
    () =>
      data.findings
        .filter((f) => f.status === tab)
        .map((f) => ({ f, level: confidenceOf(f).level }))
        .sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || b.f.estimated_value - a.f.estimated_value),
    [data.findings, tab],
  )
  const visible = rows.slice(0, limit)
  // The visible rows under a heading per confidence level, keeping each row's
  // place in the whole list for focus.
  const groups = LEVEL_ORDER.map((level) => ({
    level,
    count: rows.filter((r) => r.level === level).length,
    rows: visible.flatMap((r, i) => (r.level === level ? [{ ...r, i }] : [])),
  })).filter((g) => g.rows.length)

  // When a row moves on it leaves this list, so focus goes to the row that
  // took its place, or back to the stage tab when the list is empty.
  useEffect(() => {
    const i = refocus.current
    if (i == null) return
    refocus.current = null
    const target = visible[Math.min(i, visible.length - 1)]?.f
    const el = target ? panelRef.current?.querySelector<HTMLButtonElement>(`[data-step="${target.id}"]`) : tabRefs.current[STAGE_ORDER.indexOf(tab)]
    el?.focus()
  }, [visible, tab])

  const manual = data.actions.filter((a) => !a.finding_id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))

  const move = async (f: Finding, index: number) => {
    const step = rowStep(f.status)
    setPending(f.id)
    try {
      await setFindingStatus(f.id, step.to, 'queue')
      refocus.current = index
      toast(step.toast)
    } catch (e) {
      toast(mapError(e, 'finding'), 'error')
    } finally {
      setPending(null)
    }
  }

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const last = STAGE_ORDER.length - 1
    const j = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1) : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : null
    if (j == null) return
    e.preventDefault()
    setTab(STAGE_ORDER[j])
    tabRefs.current[j]?.focus()
  }

  // ------------------------------------------------------------ manual tasks
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', client: '', value: '', notes: '' })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (saving) return
    setError(null)
    if (!form.title.trim()) return setError('Describe the task.')
    const value = form.value ? parseNumber(form.value) : 0
    if (value == null) return setError('Potential value must be a number.')
    setSaving(true)
    try {
      await createAction({ title: form.title.trim(), notes: form.notes.trim() || undefined, value, client_id: form.client || null })
      setForm({ title: '', client: '', value: '', notes: '' })
      setCreating(false)
      toast('Task added.')
    } catch (err) {
      setError(mapError(err, 'action'))
    } finally {
      setSaving(false)
    }
  }

  const setTaskStatus = async (a: Action, s: ActionStatus) => {
    try {
      await setActionStatus(a.id, s)
      toast(`Task moved to ${ACTION_STATUS[s].toLowerCase()}.`)
    } catch (err) {
      toast(mapError(err, 'action'), 'error')
    }
  }

  const header = (
    <>
      <PageHeader title="Recovery queue" subtitle="Work through each opportunity from review to recovery." />
      <OpportunityTabs />
    </>
  )

  if (!analysis)
    return (
      <>
        {header}
        <Card>
          <EmptyState
            title="No opportunities yet"
            body="Run your first analysis to find unbilled work, agreement drift and underpriced clients."
            action={
              <ButtonLink to="/app/analyses" variant="accent">
                Start analysis
              </ButtonLink>
            }
          />
        </Card>
      </>
    )

  return (
    <>
      {header}

      <div role="tablist" aria-label="Opportunities by stage" className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line-soft sm:grid-cols-5">
        {STAGE_ORDER.map((s, i) => {
          const { count, value } = m.byStage[s]
          const selected = tab === s
          return (
            <button
              key={s}
              ref={(el) => {
                tabRefs.current[i] = el
              }}
              role="tab"
              id={`stage-tab-${s}`}
              aria-selected={selected}
              aria-controls="stage-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(s)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cx(
                'relative flex min-w-0 flex-col items-start gap-1.5 px-4 py-3 text-left transition-colors duration-150 focus-visible:z-10 focus-visible:outline-offset-[-2px]',
                s === 'dismissed' && 'col-span-2 sm:col-span-1',
                selected ? 'bg-raised' : 'bg-surface hover:bg-hover',
              )}
            >
              <span className={cx('flex items-center gap-2 text-small font-medium', selected ? 'text-ink' : 'text-ink-2')}>
                <StageMark status={s} className={s === 'dismissed' ? 'text-ink-3' : undefined} />
                {FINDING_STATUS[s]}
                <span className="tnum font-normal text-ink-3">{count}</span>
              </span>
              <span className={cx('tnum text-data-md', s === 'dismissed' ? 'text-ink-3' : selected ? 'text-ink' : 'text-ink-2')}>{money(value)}</span>
              {selected && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-ink" aria-hidden />}
            </button>
          )
        })}
      </div>

      <Card className="overflow-hidden">
        <div ref={panelRef} id="stage-panel" role="tabpanel" aria-labelledby={`stage-tab-${tab}`}>
          {rows.length ? (
            groups.map((g) => (
              <section key={g.level} aria-labelledby={`queue-level-${g.level}`} className="border-t border-line-soft first:border-t-0">
                <h3 id={`queue-level-${g.level}`} className="flex items-baseline gap-2 border-b border-line-soft bg-sunken px-4 py-2 text-label uppercase text-ink-3 sm:px-5">
                  {CONFIDENCE[g.level].label}
                  <span className="tnum font-normal tracking-normal">{g.count}</span>
                </h3>
                <ul className="divide-y divide-line-soft">
                  {g.rows.map(({ f, level, i }) => {
                    const step = rowStep(f.status)
                    const task = latestTask.get(f.id)
                    const titleId = `queue-row-${f.id}`
                    const settled = f.status === 'resolved' || f.status === 'dismissed'
                    return (
                      <li
                        key={f.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors duration-150 hover:bg-hover sm:px-5 md:grid-cols-[minmax(0,1fr)_7rem_9.5rem]"
                      >
                        <div className="col-span-2 min-w-0 md:col-span-1">
                          <Link
                            id={titleId}
                            to={`/app/opportunities/${f.id}`}
                            className={cx('line-clamp-2 text-body font-medium underline-offset-4 hover:underline md:line-clamp-1', f.status === 'dismissed' ? 'text-ink-2' : 'text-ink')}
                          >
                            {f.title}
                          </Link>
                          <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-caption text-ink-3">
                            <span className="text-ink-2">{m.clientName(f.client_id)}</span>
                            <span aria-hidden>·</span>
                            <span>{CATEGORY_META[f.category].short}</span>
                            <span aria-hidden>·</span>
                            <ConfidenceLevel level={level} short />
                          </p>
                          {task && (
                            <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-caption text-ink-3">
                              <TaskDot status={task.status} />
                              <span className="truncate">
                                Task: <span className="text-ink-2">{task.title}</span>
                                <span className="sr-only"> ({ACTION_STATUS[task.status]})</span>
                              </span>
                            </p>
                          )}
                        </div>
                        <div className="md:text-right">
                          <span className={cx('tnum block text-body font-semibold', f.status === 'dismissed' ? 'text-ink-3' : 'text-ink')}>{money(f.estimated_value)}</span>
                          {f.monthly_value > 0 && <span className="tnum mt-0.5 block text-caption text-ink-3">{money(f.monthly_value)}/mo</span>}
                        </div>
                        <Button
                          data-step={f.id}
                          variant={settled ? 'ghost' : 'secondary'}
                          size="sm"
                          className="justify-self-end md:w-full"
                          loading={pending === f.id}
                          disabled={!!pending && pending !== f.id}
                          aria-describedby={titleId}
                          onClick={() => move(f, i)}
                        >
                          {settled && pending !== f.id && <RotateCcw className="size-4" aria-hidden />}
                          {step.label}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          ) : (
            <EmptyState
              title={`Nothing in ${FINDING_STATUS[tab]}`}
              body={data.findings.length ? EMPTY_STAGE[tab] : 'The analysis found nothing to flag. Add more months of exports to widen the check.'}
            />
          )}
          {rows.length > visible.length && (
            <div className="flex flex-col gap-3 border-t border-line-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="tnum text-caption text-ink-3">
                Showing {visible.length} of {plural(rows.length, 'opportunity', 'opportunities')} in {FINDING_STATUS[tab]}.
              </p>
              <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={() => setLimit(limit + PAGE)}>
                Show {Math.min(PAGE, rows.length - visible.length)} more
              </Button>
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-8 overflow-hidden">
        <CardHeader
          as="h2"
          title="Manual tasks"
          subtitle="Follow-up work that isn't tied to one opportunity."
          right={
            <Button size="sm" variant="secondary" className="shrink-0" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden /> New task
            </Button>
          }
        />
        {manual.length ? (
          <ul className="divide-y divide-line-soft">
            {manual.map((a) => {
              const done = a.status === 'resolved' || a.status === 'dismissed'
              return (
                <li key={a.id} className="grid grid-cols-1 items-center gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5 md:grid-cols-[minmax(0,1fr)_7rem_10.5rem]">
                  <div className="min-w-0">
                    <p className={cx('text-body font-medium', done ? 'text-ink-3' : 'text-ink')}>{a.title}</p>
                    <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-ink-3">
                      <span className="text-ink-2">{a.client_id ? m.clientName(a.client_id) : 'No client'}</span>
                      <span aria-hidden>·</span>
                      <span className="tnum">Added {relative(a.created_at)}</span>
                    </p>
                    {a.notes && <p className="mt-1.5 line-clamp-2 max-w-[72ch] text-small text-ink-2">{a.notes}</p>}
                  </div>
                  <span className={cx('tnum hidden text-body md:block md:text-right', done ? 'text-ink-3' : 'text-ink-2')}>{a.value > 0 ? money(a.value) : ''}</span>
                  <Select
                    className="w-full sm:w-40 md:w-full"
                    lead={<TaskDot status={a.status} />}
                    value={a.status}
                    onChange={(e) => setTaskStatus(a, e.target.value as ActionStatus)}
                    aria-label="Task status"
                  >
                    {TASK_STATUS_OPTIONS.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="px-4 py-5 text-small text-ink-3 sm:px-5">No manual tasks. Add one for follow-up work such as a contract review or a pricing conversation.</p>
        )}
      </Card>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New task"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              Add task
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
          <Field label="Task">
            <input
              className={inputCls}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Review contract and update recurring charge"
              autoFocus
              aria-invalid={error === 'Describe the task.' || undefined}
            />
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
            <textarea className={cx(inputCls.replace('h-9', 'h-24'), 'resize-y py-2')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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
