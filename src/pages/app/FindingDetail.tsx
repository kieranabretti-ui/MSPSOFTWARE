import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Sparkles } from 'lucide-react'
import { useStore } from '../../data/store'
import { Button, Card, CardHeader, Disclaimer, EmptyState, Field, Figure, Modal, SeverityBadge, TextLink, inputCls, cx } from '../../components/ui'
import { useToast } from '../../components/toast'
import { StatusBadge } from './Opportunities'
import { EvidenceRow, ValueByMonth } from './findings/evidence'
import { CalculationBlock } from './findings/CalculationBlock'
import { ConfidenceReading } from './findings/ConfidenceReading'
import { StageControl } from './findings/StageControl'
import { TASK_STATUS_OPTIONS, TaskDot } from './findings/StatusTag'
import { Select } from './data/kit'
import { dateTime, money, plural } from '../../lib/format'
import { fmtMinutes, monthLabel, periodLabel } from '../../engine/analyse'
import { confidenceOf } from '../../lib/confidence'
import { mapError } from '../../lib/errors'
import { track } from '../../lib/track'
import { ACTION_STATUS, CATEGORY_META, PRIORITY_LABEL, recurringKind } from '../../lib/labels'
import type { ActionStatus, Finding, SourceRef } from '../../engine/types'

export { Highlighted } from './findings/evidence'

const SOURCE_KIND: Record<SourceRef['table'], string> = {
  tickets: 'Ticket',
  time_entries: 'Time entry',
  contracts: 'Contract',
  billing_items: 'Billing line',
  assets: 'User or device',
  clients: 'Client record',
}

// What each rule compared, in a sentence. Keyed by the full rule first, then
// by its family (the part before the dot).
const HOW_CHECKED: Record<string, string> = {
  out_of_scope: "Matched the ticket against the exclusion clauses found in this client's contract, and checked the time logged against it.",
  'unbilled.billing_mismatch': "Compared the ticket's billable flag with the billable flag on each time entry.",
  unbilled: 'Matched the ticket against work MSPs commonly charge for, and checked the contract for wording that includes it.',
  drift: 'Compared active users or devices in your users and devices export with the contracted figure on the client record.',
  mismatch: 'Compared the contracted quantity on the client record with the quantity on the recurring billing line.',
  license: "Counted users assigned each licence and compared that with the licence's billing line.",
  usage: 'Added up support hours per month and compared them with the included hours.',
  margin: 'Estimated monthly margin from support hours and the labour cost and software cost in Settings.',
}

// The method line under the facts. Where the inputs differ from the usual
// (no contract to check, a billed rather than contracted baseline, prices from
// billing lines), the sentence says what was actually used.
function howChecked(f: Finding): string {
  const c = f.meta.calc
  let method = HOW_CHECKED[f.meta.rule] ?? HOW_CHECKED[f.meta.rule.split('.')[0]] ?? ''
  if (c?.kind === 'time' && f.meta.rule.startsWith('unbilled.') && f.meta.rule !== 'unbilled.billing_mismatch' && !c.contract_checked)
    method = 'Matched the ticket against work MSPs commonly charge for. No contract was uploaded for this client, so its wording was not checked.'
  if (c?.kind === 'seats' && c.baseline_source === 'billing')
    method = 'Compared active users or devices in your users and devices export with the quantity on the recurring billing line, as the client record has no contracted figure.'
  const priced = c && (c.kind === 'mismatch' || c.kind === 'licence' || (c.kind === 'seats' && c.price_source === 'billing_line'))
  const values = !c ? '' : priced ? ' Values use the prices on your billing lines.' : method.includes('Settings') ? '' : ' Values use the rates in Settings.'
  return `${method ? `${method} ` : ''}Records come from your uploaded data.${values}`
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className="mt-1 truncate text-body font-medium text-ink">{children}</dd>
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

export default function FindingDetail() {
  const { id } = useParams()
  const { data, setFindingExplanation, createAction, setActionStatus, backend } = useStore()
  const toast = useToast()
  const nav = useNavigate()
  const formId = useId()
  const [taskOpen, setTaskOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tried, setTried] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [params, setParams] = useSearchParams()
  const f = data.findings.find((x) => x.id === id)
  const client = data.clients.find((c) => c.id === f?.client_id)

  // One view per opportunity opened, with its category and confidence only.
  const viewed = f ? `${f.id}|${f.category}|${confidenceOf(f).level}` : null
  useEffect(() => {
    if (!viewed) return
    const [, category, level] = viewed.split('|') as [string, Finding['category'], ReturnType<typeof confidenceOf>['level']]
    track('finding_viewed', { category, level })
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

  if (!f)
    return (
      <Card>
        <EmptyState
          title="Opportunity not found"
          body="It may have been removed when the analysis was re-run."
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
  const hasHighlights = f.evidence.some((e) => e.highlights?.length)
  const aiReady = backend.mode === 'supabase' && !!backend.aiReview

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

  const explain = async () => {
    if (backend.mode !== 'supabase' || !backend.aiReview) return
    setAiLoading(true)
    try {
      const text = await backend.aiReview(f.id)
      await setFindingExplanation(f.id, text)
    } catch (err) {
      toast(mapError(err, 'ai'), 'error')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <>
      <Link to="/app/opportunities" className="mb-5 inline-flex items-center gap-1.5 rounded-sm text-small font-medium text-ink-3 transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> Opportunities
      </Link>

      <header className="mb-7 max-w-3xl">
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
          <span className="ml-1">
            <StatusBadge status={f.status} />
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        {/* The figure, the sum behind it, how sure we are, and why */}
        <Card className="@container lg:col-span-2 lg:row-span-2 lg:row-start-1">
          <div className="grid gap-6 px-5 py-6 sm:px-6 @xl:grid-cols-[minmax(0,1fr)_15rem]">
            <div className="min-w-0">
              <p className="text-small text-ink-3">Potential value</p>
              <HeroValue f={f} />
            </div>
            <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-8 gap-y-5 border-t border-line-soft pt-5 @xl:grid-cols-1 @xl:content-start @xl:border-l @xl:border-t-0 @xl:pl-6 @xl:pt-0">
              <div className="min-w-0">
                <dt className="text-small text-ink-3">Confidence</dt>
                <dd className="mt-2">
                  <ConfidenceReading finding={f} />
                </dd>
              </div>
              <div>
                <dt className="text-small text-ink-3">{PRIORITY_LABEL}</dt>
                <dd className="mt-2">
                  <SeverityBadge severity={f.severity} />
                </dd>
              </div>
            </dl>
          </div>

          <div className="border-t border-line-soft px-5 py-5 sm:px-6">
            <CalculationBlock finding={f} />
          </div>

          <div className="border-t border-line-soft px-5 py-5 sm:px-6">
            <h2 className="text-h3 text-ink">Why it was flagged</h2>
            <p className="mt-1.5 max-w-[68ch] text-body leading-relaxed text-ink-2">{f.description}</p>
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

          <div className="border-t border-line-soft px-5 py-3.5 sm:px-6">
            <p className="max-w-[90ch] text-caption leading-relaxed text-ink-3">
              <span className="font-medium text-ink-2">How this was checked:</span> {howChecked(f)}
            </p>
          </div>
        </Card>

        {/* The decision: where it stands, the one step that moves it on, and who is on it */}
        <Card className="@container lg:col-start-3 lg:row-start-1">
          <CardHeader
            as="h2"
            title="Stage"
            right={
              <TextLink to="/app/queue" className="shrink-0 pt-0.5">
                Recovery queue
              </TextLink>
            }
          />
          <div className="px-5 py-5">
            <StageControl finding={f} via="detail" />
          </div>
          <div className="border-t border-line-soft px-5 py-5">
            <h2 className="text-h3 text-ink">Recommended action</h2>
            <p className="mt-2 text-body leading-relaxed text-ink-2">{f.recommended_action}</p>
          </div>
          <div className="border-t border-line-soft px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-small font-medium text-ink">Tasks</h3>
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

        {/* The ledger: every record behind the figure */}
        <Card className="lg:col-span-2 lg:row-start-3">
          <CardHeader as="h2" title="Evidence" subtitle={`${plural(f.evidence.length, 'record')} from your uploaded data.${hasHighlights ? ' Matched phrases are highlighted.' : ''}`} />
          <div className="divide-y divide-line-soft">
            {f.evidence.map((e, i) => (
              <EvidenceRow key={i} evidence={e} nonBillableMinutes={f.meta.minutes} />
            ))}
            {months.length > 1 && <ValueByMonth periodValues={f.meta.period_values} total={f.estimated_value} />}
          </div>
        </Card>

        <div className="space-y-6 lg:col-start-3 lg:row-span-2 lg:row-start-2">
          {aiReady && (
            <Card>
              <CardHeader as="h2" title="AI explanation" subtitle="A plain-English read of this evidence" />
              <div className="px-5 py-4">
                {f.ai_explanation ? (
                  <>
                    <p className="whitespace-pre-line text-body leading-relaxed text-ink-2">{f.ai_explanation}</p>
                    <p className="mt-3 text-caption text-ink-3">Written from the evidence on this page. Check it before acting on it.</p>
                  </>
                ) : (
                  <>
                    <Button variant="secondary" size="sm" onClick={explain} loading={aiLoading}>
                      {!aiLoading && <Sparkles className="size-4" aria-hidden />} Explain this opportunity
                    </Button>
                    <p className="mt-3 text-caption leading-relaxed text-ink-3">
                      Sends this one opportunity and its evidence, including any names in the ticket and time entries, to Anthropic's Claude API. Nothing else in your workspace is sent.
                    </p>
                  </>
                )}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader as="h2" title="Source records" subtitle="The rows this opportunity was built from" />
            <ul className="divide-y divide-line-soft">
              {f.source_data.map((s) => (
                <li key={`${s.table}:${s.id}`} className="flex items-baseline justify-between gap-3 px-5 py-2.5 text-small">
                  <span className="min-w-0 truncate text-ink-2">{s.label}</span>
                  <span className="shrink-0 text-caption text-ink-3">{SOURCE_KIND[s.table]}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Disclaimer className="mt-8 max-w-[68ch]" />

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
