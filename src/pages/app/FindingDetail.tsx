import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCircle2, FileText, ListPlus, Quote, Sparkles, Ticket as TicketIcon, XCircle, Clock, Receipt, Users, BarChart3 } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { SupabaseBackend } from '../../data/supabaseBackend'
import { Button, Card, CardHeader, Confidence, Disclaimer, EmptyState, Field, Modal, SeverityBadge, inputCls, cx } from '../../components/ui'
import { useToast } from '../../components/toast'
import { StatusBadge } from './Findings'
import { dateTime, money } from '../../lib/format'
import { fmtMinutes } from '../../engine/analyse'
import { CATEGORY_META } from '../../lib/labels'
import type { Evidence } from '../../engine/types'

export function Highlighted({ text, highlights }: { text: string; highlights?: string[] }) {
  const hs = (highlights ?? []).filter((h) => h && h.length > 2)
  if (!hs.length) return <>{text}</>
  const re = new RegExp(`(${hs.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return (
    <>
      {text.split(re).map((part, i) =>
        hs.some((h) => h.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="rounded-xs bg-accent-soft px-0.5 text-accent">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

const EVIDENCE_ICON: Record<Evidence['kind'], typeof FileText> = {
  contract: FileText,
  ticket: TicketIcon,
  time_entry: Clock,
  billing: Receipt,
  asset: Users,
  metric: BarChart3,
  client: FileText,
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-body font-medium text-ink">{children}</dd>
    </div>
  )
}

export default function FindingDetail() {
  const { id } = useParams()
  const { data, setFindingStatus, setFindingExplanation, createAction, backend } = useStore()
  const m = useMetrics()
  const toast = useToast()
  const nav = useNavigate()
  const [actionOpen, setActionOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const f = data.findings.find((x) => x.id === id)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')

  if (!f)
    return (
      <Card>
        <EmptyState title="Finding not found" body="It may have been removed when the analysis was re-run." action={<Button variant="secondary" onClick={() => nav('/app/findings')}>Back to findings</Button>} />
      </Card>
    )

  const client = data.clients.find((c) => c.id === f.client_id)
  const linkedActions = data.actions.filter((a) => a.finding_id === f.id)
  const contractEv = f.evidence.find((e) => e.kind === 'contract')
  const ticketEv = f.evidence.find((e) => e.kind === 'ticket')
  const setStatus = async (s: typeof f.status, msg: string) => {
    await setFindingStatus(f.id, s)
    toast(msg)
  }

  const explain = async () => {
    if (!(backend instanceof SupabaseBackend)) return
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

  return (
    <>
      <Link to="/app/findings" className="mb-4 inline-flex items-center gap-1.5 text-body text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> Findings
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-caption text-ink-3">
            <span>{CATEGORY_META[f.category].label}</span>
            <span>·</span>
            <StatusBadge status={f.status} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{f.title}</h1>
          <p className="mt-1 text-body text-ink-3">
            <Link to={`/app/clients/${f.client_id}`} className="font-medium text-ink-2 hover:underline">
              {client?.name}
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {f.status !== 'valid' && f.status !== 'resolved' && (
            <Button variant="secondary" size="sm" onClick={() => setStatus('valid', 'Marked as valid.')}>
              <Check className="size-3.5" /> Mark as valid
            </Button>
          )}
          {f.status !== 'dismissed' && (
            <Button variant="secondary" size="sm" onClick={() => setStatus('dismissed', 'Finding dismissed. It no longer counts towards leakage.')}>
              <XCircle className="size-3.5" /> Dismiss
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setTitle(f.recommended_action.split('. ')[0].replace(/\.$/, ''))
              setNotes(`${client?.name}: ${f.title}`)
              setActionOpen(true)
            }}
          >
            <ListPlus className="size-3.5" /> Create action
          </Button>
          {f.status !== 'resolved' ? (
            <Button size="sm" onClick={() => setStatus('resolved', 'Marked as resolved.')}>
              <CheckCircle2 className="size-3.5" /> Mark as resolved
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setStatus('open', 'Finding reopened.')}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <div className="grid grid-cols-3 divide-x divide-line-soft">
              <div className="p-5">
                <p className="text-caption text-ink-3">Potential value</p>
                <p className="tnum mt-1 text-3xl font-semibold tracking-tight" data-testid="finding-value">
                  {money(f.estimated_value)}
                </p>
                {f.monthly_value > 0 && <p className="tnum mt-1 text-caption text-ink-3">{money(f.monthly_value)}/month · {money(f.annual_value)}/year</p>}
              </div>
              <div className="p-5">
                <p className="text-caption text-ink-3">Severity</p>
                <div className="mt-2.5">
                  <SeverityBadge severity={f.severity} />
                </div>
              </div>
              <div className="p-5">
                <p className="text-caption text-ink-3">Confidence</p>
                <p className="tnum mt-1 text-3xl font-semibold tracking-tight">{f.confidence}%</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4 border-t border-line-soft p-5 sm:grid-cols-4">
              <Fact label="Client">{client?.name}</Fact>
              {f.meta.ticket_ref ? (
                <>
                  <Fact label="Ticket">#{f.meta.ticket_ref}</Fact>
                  <Fact label="Technician">{f.meta.technician ?? 'Not recorded'}</Fact>
                  <Fact label="Time spent">{fmtMinutes(f.meta.minutes ?? 0)}</Fact>
                </>
              ) : (
                <>
                  <Fact label="Package">{client?.package ?? 'Not recorded'}</Fact>
                  <Fact label="MRR">{money(client?.monthly_recurring_revenue ?? 0)}</Fact>
                  <Fact label="Months affected">{Object.keys(f.meta.period_values).length}</Fact>
                </>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader title="Why we flagged this" />
            <div className="space-y-4 p-5">
              <p className="text-body leading-relaxed text-ink-2">{f.description}</p>
              {(contractEv || ticketEv) && (
                <div className="space-y-2">
                  {contractEv && (
                    <blockquote className="flex gap-3 rounded-md border border-line bg-sunken px-4 py-3 text-body">
                      <Quote className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                      <span>
                        <span className="font-medium">Contract states:</span> “{contractEv.text}”
                      </span>
                    </blockquote>
                  )}
                  {ticketEv && (
                    <blockquote className="flex gap-3 rounded-md border border-accent-line bg-accent-soft px-4 py-3 text-body">
                      <Quote className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
                      <span>
                        <span className="font-medium">Ticket states:</span> “{ticketEv.text.split('\n')[0]}”
                      </span>
                    </blockquote>
                  )}
                </div>
              )}
              <div className="flex items-center gap-3 text-body">
                <span className="font-semibold">Confidence: {f.confidence}%</span>
                <Confidence value={f.confidence} showLabel={false} />
              </div>
              <p className="text-caption text-ink-3">
                Detected by rule <code className="rounded-xs bg-raised px-1 py-0.5 font-mono text-[11px]">{f.meta.rule}</code>. Every statement above is taken from your uploaded data.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Evidence" subtitle="The source records behind this finding. Matched phrases are highlighted." />
            <div className="divide-y divide-line-soft">
              {f.evidence.map((e, i) => {
                const Icon = EVIDENCE_ICON[e.kind]
                return (
                  <div key={i} className="p-5">
                    <div className="mb-2 flex items-center gap-2 text-caption font-medium text-ink-3">
                      <Icon className="size-3.5" /> {e.label}
                    </div>
                    <div className={cx('whitespace-pre-line rounded-md border border-line-soft bg-sunken px-4 py-3 text-body leading-relaxed text-ink', e.kind === 'time_entry' && 'font-mono text-[12px]')}>
                      <Highlighted text={e.text} highlights={e.highlights} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Recommended action" />
            <div className="space-y-4 p-5">
              <p className="text-body leading-relaxed text-ink-2">{f.recommended_action}</p>
              <Disclaimer />
            </div>
          </Card>

          <Card>
            <CardHeader title="AI review" subtitle="Plain-English explanation grounded in the evidence" />
            <div className="p-5 text-body">
              {f.ai_explanation ? (
                <p className="whitespace-pre-line leading-relaxed text-ink-2">{f.ai_explanation}</p>
              ) : backend.mode === 'supabase' ? (
                <Button variant="secondary" size="sm" onClick={explain} loading={aiLoading}>
                  <Sparkles className="size-3.5" /> Explain this finding
                </Button>
              ) : (
                <p className="text-ink-3">Available when Headroom is connected to Supabase with an AI key configured on the server. The rules engine above works without it.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Actions" />
            <div className="p-5">
              {linkedActions.length ? (
                <ul className="space-y-2">
                  {linkedActions.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 text-body">
                      <Link to="/app/actions" className="truncate hover:underline">
                        {a.title}
                      </Link>
                      <span className="shrink-0 text-caption text-ink-3">{a.status.replace('_', ' ')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-ink-3">No actions yet. Create one to track recovering this revenue.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Source data" />
            <ul className="space-y-1.5 p-5 text-body">
              {f.source_data.map((s) => (
                <li key={`${s.table}:${s.id}`} className="flex items-center justify-between gap-3">
                  <span className="truncate text-ink-2">{s.label}</span>
                  <span className="shrink-0 font-mono text-[11px] text-ink-3">{s.table}</span>
                </li>
              ))}
              {f.meta.work_date && <li className="pt-2 text-caption text-ink-3">Work date {dateTime(f.meta.work_date)}</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Modal
        open={actionOpen}
        onClose={() => setActionOpen(false)}
        title="Create action"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActionOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!title.trim()}
              onClick={async () => {
                await createAction({ finding: f, title: title.trim(), notes })
                setActionOpen(false)
                toast('Action created.')
              }}
            >
              Create action
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Action">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea className={cx(inputCls, 'h-24 py-2')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <p className="text-body text-ink-2">
            Potential value <span className="tnum font-semibold">{money(f.estimated_value)}</span> · {m.clientName(f.client_id)}
          </p>
        </div>
      </Modal>
    </>
  )
}
