import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, CircleCheck, CircleX, ListPlus, RotateCcw, Sparkles } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Badge, Button, Card, CardHeader, Disclaimer, EmptyState, Field, Figure, Modal, SeverityBadge, inputCls, cx, type Tone } from '../../components/ui'
import { useToast } from '../../components/toast'
import { StatusBadge } from './Opportunities'
import { EvidenceRow, ValueByMonth } from './findings/evidence'
import { dateTime, money, plural } from '../../lib/format'
import { fmtMinutes, monthLabel } from '../../engine/analyse'
import { ACTION_STATUS, CATEGORY_META } from '../../lib/labels'
import type { ActionStatus, Finding, FindingStatus, SourceRef } from '../../engine/types'

export { Highlighted } from './findings/evidence'

const SOURCE_KIND: Record<SourceRef['table'], string> = {
  tickets: 'Ticket',
  time_entries: 'Time entry',
  contracts: 'Contract',
  billing_items: 'Billing line',
  assets: 'User or device',
  clients: 'Client record',
}

const ACTION_TONE: Record<ActionStatus, Tone> = { open: 'neutral', in_progress: 'info', resolved: 'success', dismissed: 'neutral' }

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className="mt-1 truncate text-body font-medium text-ink">{children}</dd>
    </div>
  )
}

// How sure the rules engine is, as a figure, a bar and a plain reading.
function ConfidenceMeter({ value }: { value: number }) {
  const fill = value >= 85 ? 'bg-ink' : value >= 70 ? 'bg-ink-3' : 'bg-ink-4'
  const reading = value >= 85 ? 'Strong match in the evidence' : value >= 70 ? 'Good match, worth a check' : 'Weak match, review closely'
  return (
    <>
      <span className="tnum text-data-md text-ink">{value}%</span>
      <span className="mt-2 block h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden>
        <span className={cx('block h-full rounded-full', fill)} style={{ width: `${value}%` }} />
      </span>
      <span className="mt-1.5 block text-caption text-ink-3">{reading}</span>
    </>
  )
}

// One sentence on where the figure comes from, under the hero value.
function ValueBasis({ f }: { f: Finding }) {
  const months = Object.keys(f.meta.period_values).sort()
  if (f.monthly_value > 0)
    return (
      <>
        <span className="tnum font-semibold text-accent">{money(f.monthly_value)} a month</span> recurring, <span className="tnum">{money(f.annual_value)}</span> a year if left as it is.
      </>
    )
  if (f.meta.minutes)
    return (
      <>
        One-off. <span className="tnum">{fmtMinutes(f.meta.minutes)}</span> of work logged as non-billable.
      </>
    )
  if (months.length > 1) return <>Built up over {plural(months.length, 'month')} of the analysis period.</>
  if (months.length === 1) return <>From {monthLabel(months[0], 'long')}.</>
  return null
}

export default function FindingDetail() {
  const { id } = useParams()
  const { data, setFindingStatus, setFindingExplanation, createAction, backend } = useStore()
  const m = useMetrics()
  const toast = useToast()
  const nav = useNavigate()
  const [actionOpen, setActionOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [pending, setPending] = useState<FindingStatus | 'action' | null>(null)
  const f = data.findings.find((x) => x.id === id)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [params, setParams] = useSearchParams()
  const client = data.clients.find((c) => c.id === f?.client_id)

  // The action modal, prefilled from the recommended action. The Actions page
  // links here with ?action=new to open it straight away.
  const openAction = () => {
    if (!f) return
    setTitle(f.recommended_action.split('. ')[0].replace(/\.$/, ''))
    setNotes(`${client?.name}: ${f.title}`)
    setActionOpen(true)
  }
  const wantsAction = params.get('action') === 'new' && !!f
  useEffect(() => {
    if (!wantsAction) return
    openAction()
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsAction])

  if (!f)
    return (
      <Card>
        <EmptyState
          title="Finding not found"
          body="It may have been removed when the analysis was re-run."
          action={
            <Button variant="secondary" onClick={() => nav('/app/findings')}>
              <ArrowLeft className="size-4" /> Back to findings
            </Button>
          }
        />
      </Card>
    )

  const linkedActions = data.actions.filter((a) => a.finding_id === f.id)
  const months = Object.keys(f.meta.period_values)
  const hasHighlights = f.evidence.some((e) => e.highlights?.length)

  const setStatus = async (s: FindingStatus, msg: string) => {
    setPending(s)
    try {
      await setFindingStatus(f.id, s)
      toast(msg)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not update the finding.', 'error')
    } finally {
      setPending(null)
    }
  }

  const explain = async () => {
    if (backend.mode !== 'supabase' || !backend.aiReview) return
    setAiLoading(true)
    try {
      const text = await backend.aiReview(f.id)
      await setFindingExplanation(f.id, text)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'AI review failed.', 'error')
    } finally {
      setAiLoading(false)
    }
  }

  const aiReady = backend.mode === 'supabase' && !!backend.aiReview

  return (
    <>
      <Link to="/app/findings" className="mb-5 inline-flex items-center gap-1.5 rounded-sm text-small font-medium text-ink-3 transition-colors hover:text-ink">
        <ArrowLeft className="size-4" /> Findings
      </Link>

      <header className="mb-7 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
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
            <span className="ml-1">
              <StatusBadge status={f.status} />
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
          {f.status !== 'dismissed' && (
            <Button variant="ghost" size="sm" loading={pending === 'dismissed'} onClick={() => setStatus('dismissed', 'Finding dismissed. It no longer counts towards leakage.')}>
              {pending !== 'dismissed' && <CircleX className="size-4" />} Dismiss
            </Button>
          )}
          {f.status !== 'valid' && f.status !== 'resolved' && (
            <Button variant="secondary" size="sm" loading={pending === 'valid'} onClick={() => setStatus('valid', 'Marked as valid.')}>
              {pending !== 'valid' && <Check className="size-4" />} Mark as valid
            </Button>
          )}
          {f.status !== 'resolved' ? (
            <Button variant="secondary" size="sm" loading={pending === 'resolved'} onClick={() => setStatus('resolved', 'Marked as resolved.')}>
              {pending !== 'resolved' && <CircleCheck className="size-4" />} Mark as resolved
            </Button>
          ) : (
            <Button variant="secondary" size="sm" loading={pending === 'open'} onClick={() => setStatus('open', 'Finding reopened.')}>
              {pending !== 'open' && <RotateCcw className="size-4" />} Reopen
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        {/* The figure, how sure we are, and why */}
        <Card className="lg:col-span-2 lg:row-span-2 lg:row-start-1">
          <div className="grid gap-6 px-5 py-6 sm:px-6 md:grid-cols-[minmax(0,1fr)_13rem]">
            <div className="min-w-0">
              <p className="text-small text-ink-3">Potential value</p>
              <Figure size="xl" testId="finding-value" className="mt-3 block">
                {money(f.estimated_value)}
              </Figure>
              <p className="mt-4 text-small text-ink-2">
                <ValueBasis f={f} />
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-5 border-t border-line-soft pt-5 md:grid-cols-1 md:content-start md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <div>
                <dt className="text-small text-ink-3">Confidence</dt>
                <dd className="mt-1.5">
                  <ConfidenceMeter value={f.confidence} />
                </dd>
              </div>
              <div>
                <dt className="text-small text-ink-3">Severity</dt>
                <dd className="mt-2">
                  <SeverityBadge severity={f.severity} />
                </dd>
              </div>
            </dl>
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

          <p className="border-t border-line-soft px-5 py-3 text-caption text-ink-3 sm:px-6">
            Detected by rule <code className="rounded-xs bg-raised px-1 py-0.5 font-mono text-[11px] text-ink-2">{f.meta.rule}</code>. Every statement on this page is taken from your uploaded data.
          </p>
        </Card>

        {/* The decision: what to do about it */}
        <Card className="lg:col-start-3 lg:row-start-1">
          <div className="px-5 py-5">
            <h2 className="text-h3 text-ink">Recommended action</h2>
            <p className="mt-2 text-body leading-relaxed text-ink-2">{f.recommended_action}</p>
            <Button variant="accent" className="mt-5 w-full" onClick={openAction}>
              <ListPlus className="size-4" /> Create action
            </Button>
          </div>
          <div className="border-t border-line-soft px-5 py-4">
            <h3 className="text-small font-medium text-ink">Tracked actions</h3>
            {linkedActions.length ? (
              <ul className="mt-2 divide-y divide-line-soft">
                {linkedActions.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2 first:pt-1 last:pb-0">
                    <Link to="/app/actions" className="min-w-0 truncate text-small text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline">
                      {a.title}
                    </Link>
                    <Badge tone={ACTION_TONE[a.status]}>{ACTION_STATUS[a.status]}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-small text-ink-3">None yet. Create one to track recovering this revenue.</p>
            )}
          </div>
        </Card>

        {/* The ledger: every record behind the figure */}
        <Card className="lg:col-span-2 lg:row-start-3">
          <CardHeader
            title="Evidence"
            subtitle={`${plural(f.evidence.length, 'record')} from your uploaded data.${hasHighlights ? ' Matched phrases are highlighted.' : ''}`}
          />
          <div className="divide-y divide-line-soft">
            {f.evidence.map((e, i) => (
              <EvidenceRow key={i} evidence={e} nonBillableMinutes={f.meta.minutes} />
            ))}
            {months.length > 1 && <ValueByMonth periodValues={f.meta.period_values} total={f.estimated_value} />}
          </div>
        </Card>

        <div className="space-y-6 lg:col-start-3 lg:row-span-2 lg:row-start-2">
          <Card>
            <CardHeader title="AI review" subtitle="A plain-English read of this evidence" right={
                !f.ai_explanation && !aiReady ? (
                  <span className="shrink-0 whitespace-nowrap">
                    <Badge>Not configured</Badge>
                  </span>
                ) : undefined
              } />
            <div className="px-5 py-4">
              {f.ai_explanation ? (
                <>
                  <p className="whitespace-pre-line text-body leading-relaxed text-ink-2">{f.ai_explanation}</p>
                  <p className="mt-3 text-caption text-ink-3">Written from the evidence on this page. Check it before acting on it.</p>
                </>
              ) : aiReady ? (
                <Button variant="secondary" size="sm" onClick={explain} loading={aiLoading}>
                  {!aiLoading && <Sparkles className="size-4" />} Explain this finding
                </Button>
              ) : (
                <p className="text-small leading-relaxed text-ink-3">
                  Needs Headroom connected to Supabase with an AI key set on the server. The figures and evidence here come from the rules engine, which works without it.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Source records" subtitle="The rows this finding was built from" />
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
        open={actionOpen}
        onClose={() => setActionOpen(false)}
        title="Create action"
        footer={
          <>
            <Button variant="ghost" onClick={() => setActionOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!title.trim()}
              loading={pending === 'action'}
              onClick={async () => {
                setPending('action')
                try {
                  await createAction({ finding: f, title: title.trim(), notes })
                  setActionOpen(false)
                  toast('Action created.')
                } catch (e) {
                  toast(e instanceof Error ? e.message : 'Could not create the action.', 'error')
                } finally {
                  setPending(null)
                }
              }}
            >
              Create action
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 rounded-md border border-line-soft bg-sunken px-4 py-3">
            <div className="min-w-0">
              <p className="line-clamp-2 text-small font-medium text-ink">{f.title}</p>
              <p className="mt-0.5 truncate text-caption text-ink-3">{m.clientName(f.client_id)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="tnum text-body font-semibold text-ink">{money(f.estimated_value)}</p>
              <p className="mt-0.5 text-caption text-ink-3">potential</p>
            </div>
          </div>
          <Field label="Action" hint="Taken from the recommended action. Edit it to suit." error={title.trim() ? null : 'Give the action a short title.'}>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea className={cx(inputCls.replace('h-9', 'h-24'), 'resize-y py-2 leading-relaxed')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  )
}
