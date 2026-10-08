import { useEffect, useId, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileSearch, Plus } from 'lucide-react'
import { useStore } from '../../data/store'
import { Badge, Button, Card, EmptyState, Field, Figure, Modal, inputCls, cx } from '../../components/ui'
import { useToast } from '../../components/toast'
import { CalculationBlock } from './findings/CalculationBlock'
import { ConfidenceReading } from './findings/ConfidenceReading'
import { FindingStatusTag, TASK_STATUS_OPTIONS, TaskDot } from './findings/StatusTag'
import { WhatWeFound, recommendations } from './findings/Claims'
import { EvidenceLedger } from './findings/EvidenceLedger'
import { DataSources } from './findings/DataSources'
import { DecisionPanel } from './findings/DecisionPanel'
import { AiExplanation } from './findings/AiExplanation'
import EvidenceView, { AI_LINE } from './findings/EvidenceView'
import { CLASS_LABEL, classDefinition } from './findings/rules'
import { Select } from './data/kit'
import { dateTime, money } from '../../lib/format'
import { fmtMinutes, monthLabel, periodLabel } from '../../engine/format'
import { confidenceOf } from '../../lib/confidence'
import { valueBasis } from '../../lib/calculation'
import { mapError } from '../../lib/errors'
import { track } from '../../lib/track'
import { ACTION_STATUS, CATEGORY_META, recurringKind } from '../../lib/labels'
import type { ActionStatus, Finding } from '../../engine/types'

export { Highlighted } from './findings/evidence'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className="mt-1 break-words text-body font-medium text-ink">{children}</dd>
    </div>
  )
}

// The headline figure. Recurring gaps lead with the monthly amount, the way an
// agreement is priced, with the period total and the year beside it. One-off
// work leads with the amount itself and when it happened.
function HeroValue({ f }: { f: Finding }) {
  const months = Object.keys(f.meta.period_values).sort()
  const span = months.length ? periodLabel(months[0], months[months.length - 1]) : null
  if (f.monthly_value > 0)
    return (
      <>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Figure size="xl" testId="finding-value">
            {money(f.monthly_value)}
          </Figure>
          <span className="text-lead text-ink-2">a month</span>
        </p>
        <p className="tnum mt-4 max-w-[60ch] text-pretty text-small text-ink-2">
          {money(f.estimated_value)}
          {span && (recurringKind(f.category) === 'pricing' ? ` below target across ${span}` : ` across ${span} (possible back-bill)`)}
          <span className="mx-1.5 text-ink-4" aria-hidden>
            ·
          </span>
          <span className="sr-only">, </span>
          {money(f.annual_value)} a year if left as it is
        </p>
      </>
    )
  return (
    <>
      <Figure size="xl" testId="finding-value" className="mt-3 block">
        {money(f.estimated_value)}
      </Figure>
      <p className="tnum mt-4 max-w-[60ch] text-pretty text-small text-ink-2">
        One-off{span && (months.length > 1 ? `, across ${span}` : `, from ${monthLabel(months[0], 'long')}`)}
        {f.meta.minutes ? (
          <>
            <span className="mx-1.5 text-ink-4" aria-hidden>
              ·
            </span>
            <span className="sr-only">, </span>
            {fmtMinutes(f.meta.minutes)} logged as non-billable
          </>
        ) : null}
      </p>
    </>
  )
}

// The decision panel sits beside the evidence on wide screens, and straight
// under the headline figure on narrow ones, rendered once either way.
const WIDE = '(min-width: 1024px)'
const subscribeWide = (cb: () => void) => {
  const m = window.matchMedia(WIDE)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}
const useWide = () => useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => true)

const VALUE_LABEL = { confirmed: 'Evidence-backed opportunity', potential: 'Potential opportunity', investigate: 'Potential opportunity, requires review' } as const

export default function FindingDetail() {
  const { id } = useParams()
  const { data, createAction, setActionStatus, markFindingViewed, loadError, reload } = useStore()
  const toast = useToast()
  const nav = useNavigate()
  const formId = useId()
  const wide = useWide()
  const [taskOpen, setTaskOpen] = useState(false)
  const [whyOpen, setWhyOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [params, setParams] = useSearchParams()
  const f = data.findings.find((x) => x.id === id) ?? data.stale_findings.find((x) => x.id === id)
  const client = data.clients.find((c) => c.id === f?.client_id)

  // One view per opportunity opened, with its category and confidence only,
  // and the first open recorded on the finding for the trust metrics.
  const viewed = f ? `${f.id}|${f.category}|${confidenceOf(f).level}` : null
  useEffect(() => {
    if (!viewed) return
    const [fid, category, level] = viewed.split('|') as [string, Finding['category'], ReturnType<typeof confidenceOf>['level']]
    track('finding_viewed', { category, level })
    markFindingViewed(fid).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewed])

  // The task form, prefilled from the recommended action. The queue and older
  // links open it straight away with ?action=new.
  const openTask = () => {
    if (!f) return
    setTitle(f.recommended_action.split('. ')[0].replace(/\.$/, ''))
    setNotes('')
    setTried(false)
    setTaskOpen(true)
  }
  const wantsTask = params.get('action') === 'new' && !!f
  useEffect(() => {
    if (!wantsTask) return
    openTask()
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsTask])

  if (!f && loadError)
    return (
      <Card>
        <EmptyState
          title="This opportunity couldn't be loaded"
          body={`${loadError} Nothing has been changed or removed.`}
          action={
            <Button
              variant="secondary"
              loading={retrying}
              onClick={async () => {
                setRetrying(true)
                try {
                  await reload()
                } finally {
                  setRetrying(false)
                }
              }}
            >
              Try again
            </Button>
          }
        />
      </Card>
    )

  if (!f)
    return (
      <Card>
        <EmptyState
          title="Opportunity not found"
          body="The latest analysis no longer produces it, or the analysis it came from was deleted. Opportunities with a recorded decision are kept under No longer detected."
          action={
            <Button variant="secondary" onClick={() => nav('/app/opportunities')}>
              <ArrowLeft className="size-4" /> Back to opportunities
            </Button>
          }
        />
      </Card>
    )

  const tasks = data.actions.filter((a) => a.finding_id === f.id).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  const months = Object.keys(f.meta.period_values)
  const conf = confidenceOf(f)
  const classification = f.classification ?? conf.classification
  const basis = valueBasis(f)
  const recs = recommendations(f)

  const addTask = async (e?: FormEvent) => {
    e?.preventDefault()
    setTried(true)
    if (!title.trim() || saving) return
    const wasNew = f.status === 'open'
    setSaving(true)
    try {
      await createAction({ finding: f, title: title.trim(), notes: notes.trim() || undefined })
      setTaskOpen(false)
      toast(wasNew ? 'Task added. Moved to Reviewing.' : 'Task added.')
    } catch (err) {
      toast(mapError(err, 'action'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const setTaskStatus = async (taskId: string, s: ActionStatus) => {
    try {
      await setActionStatus(taskId, s)
      toast(`Task moved to ${ACTION_STATUS[s].toLowerCase()}.`)
    } catch (err) {
      toast(mapError(err, 'action'), 'error')
    }
  }

  const decision = (
    <Card>
      <DecisionPanel finding={f} />
    </Card>
  )

  return (
    <>
      <Link to="/app/opportunities" className="mb-5 inline-flex items-center gap-1.5 rounded-sm text-small font-medium text-ink-3 transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> Opportunities
      </Link>

      <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-balance text-h1 text-ink">{f.title}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-small text-ink-3">
            <Link to={`/app/clients/${f.client_id}`} className="font-medium text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline">
              {client?.name}
            </Link>
            <span aria-hidden>·</span>
            <span>{CATEGORY_META[f.category].label}</span>
            {f.meta.ticket_ref && (
              <>
                <span aria-hidden>·</span>
                <span className="tnum">Ticket #{f.meta.ticket_ref}</span>
              </>
            )}
            <span className="ml-1 inline-flex flex-wrap items-center gap-1.5">
              <Badge>{CLASS_LABEL[classification]}</Badge>
              <FindingStatusTag status={f.status} />
            </span>
          </div>
        </div>
        <Button variant="secondary" size="lg" className="w-full shrink-0 sm:w-auto" onClick={() => setWhyOpen(true)} data-testid="why-flagged">
          <FileSearch className="size-4" aria-hidden /> Why was this flagged?
        </Button>
      </header>

      {f.stale && (
        <div className="mb-6 rounded-lg border border-line bg-surface px-5 py-4 text-small text-ink-2">
          <span className="font-medium text-ink">No longer detected.</span> The latest analysis didn't produce this opportunity. It's kept because a decision was recorded on it, and it isn't counted in any total.
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {/* The figure, how sure we are, and what the records say */}
          <Card className="@container">
            <div className="grid gap-6 px-5 py-6 sm:px-6 @xl:grid-cols-[minmax(0,1fr)_15rem]">
              <div className="min-w-0">
                <p className="text-small text-ink-3">{basis === 'estimate' ? 'Estimated opportunity, requires review' : VALUE_LABEL[classification]}</p>
                <HeroValue f={f} />
              </div>
              <dl className="grid grid-cols-1 gap-y-5 border-t border-line-soft pt-5 @md:grid-cols-2 @md:gap-x-8 @xl:grid-cols-1 @xl:content-start @xl:border-l @xl:border-t-0 @xl:pl-6 @xl:pt-0">
                <div className="min-w-0">
                  <dt className="text-small text-ink-3">Confidence</dt>
                  <dd className="mt-2">
                    <ConfidenceReading finding={f} />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-small text-ink-3">Classification</dt>
                  <dd className="mt-2">
                    <p className="text-small font-medium text-ink">{CLASS_LABEL[classification]}</p>
                    <p className="mt-1 text-caption leading-relaxed text-ink-3">{classDefinition(classification)}</p>
                  </dd>
                </div>
              </dl>
            </div>

            <div className="border-t border-line-soft px-5 py-5 sm:px-6">
              <WhatWeFound finding={f} />
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line-soft px-5 py-4 sm:grid-cols-4 sm:px-6">
              {f.meta.ticket_ref ? (
                <>
                  <Fact label="Ticket">
                    <span className="tnum">#{f.meta.ticket_ref}</span>
                  </Fact>
                  <Fact label="Technician">{f.meta.technician ?? 'Not recorded'}</Fact>
                  <Fact label="Non-billable time">
                    <span className="tnum">{fmtMinutes(f.meta.minutes ?? 0)}</span>
                  </Fact>
                  <Fact label="Work date">
                    <span className="tnum">{f.meta.work_date ? dateTime(f.meta.work_date.slice(0, 10)) : 'Not recorded'}</span>
                  </Fact>
                </>
              ) : (
                <>
                  <Fact label="Client">{client?.name}</Fact>
                  <Fact label="Package">{client?.package ?? 'Not recorded'}</Fact>
                  <Fact label="Agreement MRR">
                    <span className="tnum">{money(client?.monthly_recurring_revenue ?? 0)}</span>
                  </Fact>
                  <Fact label="Months affected">
                    <span className="tnum">{months.length}</span>
                  </Fact>
                </>
              )}
            </dl>
          </Card>

          {!wide && decision}

          <Card>
            <EvidenceLedger finding={f} />
          </Card>

          <Card>
            <div className="px-5 py-5 sm:px-6">
              <CalculationBlock finding={f} />
            </div>
          </Card>

          <Card>
            <section aria-labelledby="rec-heading" className="px-5 py-5 sm:px-6">
              <h2 id="rec-heading" className="text-h3 text-ink">
                Recommended action
              </h2>
              <ul className="mt-2 space-y-2">
                {recs.map((r, i) => (
                  <li key={i} className="max-w-[72ch] text-body leading-relaxed text-ink-2">
                    {r}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-caption text-ink-3">Recommendations require MSP review before action.</p>
            </section>
          </Card>

          <Card>
            <div className="px-5 py-5 sm:px-6">
              <DataSources finding={f} />
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          {wide && decision}

          <Card className="@container">
            <div className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-h3 text-ink">Tasks</h2>
                <Button variant="secondary" size="sm" onClick={openTask}>
                  <Plus className="size-4" aria-hidden /> Add a task
                </Button>
              </div>
              {tasks.length ? (
                <ul className="mt-3 divide-y divide-line-soft">
                  {tasks.map((a) => {
                    const note = a.notes && !a.notes.includes(f.title) ? a.notes : null
                    const done = a.status === 'resolved' || a.status === 'dismissed'
                    return (
                      <li key={a.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 @md:flex-row @md:items-start @md:justify-between @md:gap-3">
                        <div className="min-w-0">
                          <p className={cx('text-small font-medium', done ? 'text-ink-3' : 'text-ink')}>{a.title}</p>
                          {note && <p className="mt-0.5 line-clamp-2 text-caption text-ink-3">{note}</p>}
                        </div>
                        <Select
                          className="w-40 shrink-0"
                          lead={<TaskDot status={a.status} />}
                          value={a.status}
                          onChange={(e) => setTaskStatus(a.id, e.target.value as ActionStatus)}
                          aria-label={`Task status: ${a.title}`}
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
                <p className="mt-2 text-small text-ink-3">No tasks yet. Add one to note who is following this up.</p>
              )}
            </div>
          </Card>

          <AiExplanation finding={f} />
        </div>
      </div>

      <p className="mt-8 max-w-[72ch] text-caption leading-relaxed text-ink-3">
        Figures are potential revenue based on the data provided, not amounts a client owes. {AI_LINE} Recommendations require MSP review before action.
      </p>

      <EvidenceView finding={f} open={whyOpen} onClose={() => setWhyOpen(false)} />

      <Modal
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        title="Add a task"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTaskOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={saving}>
              Add task
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={addTask} noValidate className="space-y-5">
          <div className="flex items-start justify-between gap-4 rounded-md border border-line-soft bg-sunken px-4 py-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-small font-medium text-ink">{f.title}</p>
              <p className="mt-0.5 truncate text-caption text-ink-3">{client?.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="tnum text-body font-semibold text-ink">{money(f.estimated_value)}</p>
              <p className="mt-0.5 text-caption text-ink-3">potential</p>
            </div>
          </div>
          <Field label="Task" hint="Taken from the recommended action. Edit it to suit." error={tried && !title.trim() ? 'Give the task a short title.' : null}>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Notes" hint="Optional. Who is following this up, and what was agreed.">
            <textarea className={cx(inputCls.replace('h-9', 'h-24'), 'resize-y py-2 leading-relaxed')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {f.status === 'open' && <p className="text-caption text-ink-3">Adding a task moves this opportunity to Reviewing.</p>}
        </form>
      </Modal>
    </>
  )
}
