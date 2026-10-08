import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { liveClientHealth } from '../engine/health'
import type {
  Action,
  ActionStatus,
  Analysis,
  AnalysisSummary,
  AuditAction,
  AuditEvent,
  Client,
  ConfidenceLevel,
  Contract,
  Dataset,
  DismissReason,
  Finding,
  FindingDraft,
  FindingStatus,
  Report,
  Upload,
  UploadKind,
  Workspace,
  WorkspaceSettings,
} from '../engine/types'
import { DEFAULT_SETTINGS } from '../engine/types'
import { useToast } from '../components/toast'
import { applyDemoStages } from '../demo/stages'
import { auditEvent } from '../lib/audit'
import { confidenceOf } from '../lib/confidence'
import { AppError, mapError } from '../lib/errors'
import { recurringKind } from '../lib/labels'
import { overlapOf } from '../lib/overlap'
import { setTrackContext, track, type AnalysisSource } from '../lib/track'
import type { Backend, SessionUser, UploadDeletion, WorkspaceData } from './backend'
import { emptyData } from './backend'
import { LocalBackend } from './localBackend'
import { LazySupabaseBackend } from './lazySupabase'
import { importRows, newClient, uuid, type CsvKind, type ImportContext, type ImportResult, type MappedRow } from './importers'

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabaseConfigured = !!(SB_URL && SB_KEY)
const MODE_KEY = 'headroom:mode'
const DEMO_EMAIL = 'alex.morgan@northlight-it.example'
const DEMO_PASSWORD = 'northlight-demo'

function pickBackend(): Backend {
  let demo = false
  try {
    demo = localStorage.getItem(MODE_KEY) === 'demo'
  } catch {
    /* storage blocked */
  }
  return supabaseConfigured && !demo ? new LazySupabaseBackend(SB_URL!, SB_KEY!) : new LocalBackend()
}

// The phases an analysis really goes through, reported as each one starts.
export type AnalysisStage = 'reading' | 'checking' | 'saving' | 'done'
export type DemoStage = 'generating' | 'checking' | 'opening'

interface Store {
  ready: boolean
  backend: Backend
  user: SessionUser | null
  workspace: Workspace | null
  data: WorkspaceData
  analysis: Analysis | null
  isDemoSession: boolean
  busy: string | null
  // Set when the workspace couldn't be loaded; cleared by a successful reload.
  loadError: string | null
  reload(): Promise<void>
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, name: string, opts?: { intent?: string; plan?: string }): Promise<{ needsConfirmation: boolean }>
  sendMagicLink(email: string): Promise<void>
  // clearLocalData (local mode): also remove this browser's copy of the
  // account and its workspace data. Hosted data stays on the server.
  signOut(opts?: { clearLocalData?: boolean }): Promise<void>
  startDemo(opts?: { onStage?: (s: DemoStage) => void }): Promise<void>
  createWorkspace(name: string): Promise<void>
  updateSettings(patch: Partial<WorkspaceSettings>, name?: string): Promise<void>
  loadDemoData(): Promise<void>
  resetData(): Promise<void>
  importCsv(kind: CsvKind, fileName: string, rows: MappedRow[], mapping: Record<string, string>): Promise<ImportResult>
  addContract(clientId: string, title: string, text: string, file: File | null): Promise<void>
  createClient(fields: Partial<Client> & { name: string }): Promise<Client>
  runAnalysis(opts?: { source?: Exclude<AnalysisSource, 'demo'>; onStage?: (s: AnalysisStage) => void }): Promise<AnalysisSummary>
  // Deprecated: use setFindingDecision. Dismissing through this records reason 'other'.
  setFindingStatus(id: string, status: FindingStatus, via?: 'detail' | 'queue'): Promise<void>
  // The MSP's decision on a finding: stage, dismiss reason (required when
  // dismissing), note and owner. Every change is written to the audit log.
  setFindingDecision(id: string, decision: FindingDecision, via?: 'detail' | 'queue'): Promise<void>
  // Records the first time a person opens a finding (once; later calls do nothing).
  markFindingViewed(id: string): Promise<void>
  setFindingExplanation(id: string, text: string): Promise<void>
  createAction(input: { finding?: Finding; title: string; notes?: string; value?: number; client_id?: string | null }): Promise<Action>
  setActionStatus(id: string, status: ActionStatus): Promise<void>
  recordReport(): Promise<Report | null>
  // Records a download in the audit log. PDFs go through recordReport.
  logExport(format: 'csv' | 'pdf', opts?: { rows?: number; scope?: 'opportunities' | 'report' }): Promise<void>
  // Deletion controls. Each says exactly what it removes; see the Backend docs.
  deleteUpload(uploadId: string): Promise<UploadDeletion>
  deleteAnalysis(analysisId: string): Promise<void>
  deleteWorkspace(): Promise<void>
  deleteAccount(): Promise<void>
}

export interface FindingDecision {
  status?: FindingStatus
  // Required when status is 'dismissed'.
  dismiss_reason?: DismissReason
  // null clears it. Up to 2,000 characters.
  decision_note?: string | null
  // null clears it. Up to 200 characters.
  owner?: string | null
}

export const NOTE_MAX = 2000
export const OWNER_MAX = 200

const Ctx = createContext<Store | null>(null)

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore outside provider')
  return s
}

const now = () => new Date().toISOString()

// Resolves once the browser has had a chance to paint, so a phase change shows
// before the next block of work. The timeout covers background tabs, where
// animation frames don't fire.
const paint = () =>
  new Promise<void>((resolve) => {
    let done = false
    const go = () => {
      if (done) return
      done = true
      setTimeout(resolve, 0)
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go)
    setTimeout(go, 100)
  })

const dataset = (ws: Workspace, d: WorkspaceData): Dataset => ({
  settings: { ...DEFAULT_SETTINGS, ...ws.settings },
  clients: d.clients,
  contracts: d.contracts,
  tickets: d.tickets,
  time_entries: d.time_entries,
  billing_items: d.billing_items,
  assets: d.assets,
})

// A person has decided something about this finding: moved it off New, or
// given it a note or an owner. Such findings are never deleted by a re-run.
export const isDecided = (f: Pick<Finding, 'status' | 'decision_note' | 'owner'>) => f.status !== 'open' || !!f.decision_note?.trim() || !!f.owner?.trim()

export interface MergeResult {
  // Everything to store: live findings, then stale ones kept for their decision.
  findings: Finding[]
  live: Finding[]
  // live findings with a key not seen before
  created: number
  // findings no longer reproduced, kept as stale because a person decided on them
  stale: number
  // findings no longer reproduced and never decided on: removed
  removed: number
}

// JSON values compared the way Postgres compares jsonb: key order doesn't
// matter and undefined properties don't exist.
function sameJson(a: unknown, b: unknown): boolean {
  const canon = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canon)
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.keys(v)
          .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
          .sort()
          .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
      )
    return v ?? null
  }
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b))
}

// Whether an AI explanation written for `prev` still describes `next`. The
// hosted database clears the explanation when the evidence, values,
// calculation or client change (migration 20261008000100,
// findings_clear_stale_ai); this mirrors it so both modes show the same.
// Mirrors findings_clear_stale_ai: an explanation applies only while the
// finding's figures, evidence, wording, claims and classification are unchanged.
type AiScope = 'evidence' | 'estimated_value' | 'monthly_value' | 'annual_value' | 'meta' | 'client_id' | 'title' | 'description' | 'recommended_action' | 'category' | 'claims' | 'classification' | 'severity' | 'confidence'
export function aiStillApplies(prev: Partial<Pick<Finding, AiScope>> & Pick<Finding, 'evidence' | 'estimated_value' | 'monthly_value' | 'annual_value' | 'meta' | 'client_id'>, next: Partial<Pick<FindingDraft, AiScope>> & Pick<FindingDraft, 'evidence' | 'estimated_value' | 'monthly_value' | 'annual_value' | 'meta' | 'client_id'>): boolean {
  return (
    prev.client_id === next.client_id &&
    Number(prev.estimated_value) === Number(next.estimated_value) &&
    Number(prev.monthly_value) === Number(next.monthly_value) &&
    Number(prev.annual_value) === Number(next.annual_value) &&
    sameJson(prev.meta?.calc ?? null, next.meta?.calc ?? null) &&
    sameJson(prev.evidence, next.evidence) &&
    (prev.title ?? null) === (next.title ?? null) &&
    (prev.description ?? null) === (next.description ?? null) &&
    (prev.recommended_action ?? null) === (next.recommended_action ?? null) &&
    (prev.category ?? null) === (next.category ?? null) &&
    (prev.classification ?? null) === (next.classification ?? null) &&
    (prev.severity ?? null) === (next.severity ?? null) &&
    Number(prev.confidence ?? 0) === Number(next.confidence ?? 0) &&
    sameJson(prev.claims ?? [], next.claims ?? [])
  )
}

// Carries ids, decisions and AI notes over to findings that still apply, by
// finding_key. A previous finding the engine no longer produces is kept as
// stale when a person decided on it, otherwise dropped. Pure.
export function mergeFindings(prev: Finding[], drafts: FindingDraft[], ctx: { workspaceId: string; analysisId: string; at: string }): MergeResult {
  const byKey = new Map(prev.map((f) => [f.finding_key, f]))
  const seen = new Set<string>()
  let created = 0
  const live: Finding[] = drafts.map((f) => {
    const p = byKey.get(f.finding_key)
    seen.add(f.finding_key)
    if (!p) created++
    // An explanation of different evidence or figures is dropped, not carried.
    const keepAi = !!p && aiStillApplies(p, f)
    return {
      ...f,
      id: p?.id ?? uuid(),
      workspace_id: ctx.workspaceId,
      analysis_id: ctx.analysisId,
      status: p?.status ?? 'open',
      ai_explanation: keepAi ? (p.ai_explanation ?? null) : null,
      ai_meta: keepAi ? (p.ai_meta ?? null) : null,
      dismiss_reason: p?.dismiss_reason ?? null,
      decision_note: p?.decision_note ?? null,
      owner: p?.owner ?? null,
      decided_at: p?.decided_at ?? null,
      first_viewed_at: p?.first_viewed_at ?? null,
      stale: false,
      created_at: p?.created_at ?? ctx.at,
      updated_at: ctx.at,
    }
  })
  const gone = prev.filter((p) => !seen.has(p.finding_key))
  const kept = gone.filter(isDecided).map((p) => (p.stale ? p : { ...p, stale: true, updated_at: ctx.at }))
  return { findings: [...live, ...kept], live, created, stale: kept.length, removed: gone.length - kept.length }
}

// Runs the engine and merges the result with the previous findings. Pure:
// nothing is saved here. The engine loads on first use, so the landing page
// doesn't ship it.
const analyseFor = async (ws: Workspace, d: WorkspaceData) => {
  const { analyse } = await import('../engine/analyse')
  const { summary, findings } = analyse(dataset(ws, d))
  const analysis: Analysis = { id: uuid(), workspace_id: ws.id, period_start: summary.period_start, period_end: summary.period_end, summary, created_at: now() }
  const merged = mergeFindings([...d.findings, ...d.stale_findings], findings, { workspaceId: ws.id, analysisId: analysis.id, at: now() })
  return { analysis, ...merged }
}

// The demo opens part-way through the workflow (see demo/stages.ts), with the
// decisions a person would have recorded, set before saving so the first load
// already shows them. The history runs in order: imports, then the analysis
// that found the opportunities, then the decisions. The run and its findings
// are dated a day before the earliest decision, never after it. Pure, so the
// order is tested (store.test.ts).
export function demoHistory(input: {
  workspaceId: string
  actor: { id: string | null; email: string | null }
  uploads: Pick<Upload, 'id' | 'kind' | 'row_count'>[]
  analysisId: string
  findings: Finding[]
  clientName: (id: string) => string
  now: number
}): { importedAt: string; runAt: string; staged: Finding[]; events: AuditEvent[] } {
  const { workspaceId: wsId, actor, uploads, analysisId, findings } = input
  const daysAgo = (n: number, h = 10) => new Date(input.now - n * 864e5 - h * 36e5).toISOString()
  const stages = new Map(applyDemoStages(findings, input.clientName).map((s) => [s.id, s]))
  const start = Math.max(...[...stages.values()].map((s) => s.days_ago), 0) + 1
  const importedAt = daysAgo(start, 12)
  const runAt = daysAgo(start, 11.5)
  const staged = findings.map((f) => {
    const s = stages.get(f.id)
    const dated = { ...f, created_at: runAt, updated_at: runAt }
    return s ? { ...dated, status: s.status, owner: s.owner, decision_note: s.note, decided_at: daysAgo(s.days_ago), first_viewed_at: daysAgo(s.days_ago, 11), updated_at: daysAgo(s.days_ago) } : dated
  })
  // The activity the history implies: the imports, the first run and the
  // decisions above, oldest first.
  const events: AuditEvent[] = [
    ...uploads.map((u) => auditEvent(wsId, actor, 'upload.created', { type: 'upload', id: u.id }, { kind: u.kind, rows: u.row_count }, importedAt)),
    auditEvent(wsId, actor, 'analysis.run', { type: 'analysis', id: analysisId }, { findings: findings.length, new: findings.length, stale: 0, removed: 0, source: 'demo' }, runAt),
    auditEvent(wsId, actor, 'finding.created', { type: 'analysis', id: analysisId }, { count: findings.length }, runAt),
  ]
  for (const s of [...stages.values()].sort((a, b) => b.days_ago - a.days_ago)) {
    const target = { type: 'finding', id: s.id }
    events.push(auditEvent(wsId, actor, 'finding.viewed', target, {}, daysAgo(s.days_ago, 11)))
    events.push(auditEvent(wsId, actor, 'finding.owner', target, { assigned: true }, daysAgo(s.days_ago, 10.8)))
    if (s.note) events.push(auditEvent(wsId, actor, 'finding.note', target, { cleared: false, length: s.note.length }, daysAgo(s.days_ago, 10.5)))
    const path: FindingStatus[] = ['open', 'reviewing', 'valid', 'resolved']
    for (let i = 1; i <= path.indexOf(s.status); i++) events.push(auditEvent(wsId, actor, 'finding.stage_changed', target, { from: path[i - 1], to: path[i], via: 'detail' }, daysAgo(s.days_ago, 10.2 - i * 0.1)))
  }
  return { importedAt, runAt, staged, events }
}

// Contract text keeps a form feed between PDF pages so a clause can be cited
// by page. Normalises line endings and strips other control characters.
export function normaliseContractText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000E-\u001F\u007F]/g, '')
}

// The stage a decision moves a finding to, and the audit events it produces.
export function decisionEvents(prev: Pick<Finding, 'status' | 'decision_note' | 'owner'>, next: Pick<Finding, 'status' | 'decision_note' | 'owner' | 'dismiss_reason'>, via: string): { action: AuditAction; detail: AuditEvent['detail'] }[] {
  const out: { action: AuditAction; detail: AuditEvent['detail'] }[] = []
  if (prev.status !== next.status) {
    if (next.status === 'dismissed') out.push({ action: 'finding.dismissed', detail: { from: prev.status, reason: next.dismiss_reason ?? null, via } })
    else if (prev.status === 'dismissed' || prev.status === 'resolved' || (next.status === 'open' && prev.status !== 'open'))
      out.push({ action: 'finding.reopened', detail: { from: prev.status, to: next.status, via } })
    else out.push({ action: 'finding.stage_changed', detail: { from: prev.status, to: next.status, via } })
  }
  if ((prev.decision_note ?? null) !== (next.decision_note ?? null)) out.push({ action: 'finding.note', detail: { cleared: !next.decision_note, length: next.decision_note?.length ?? 0 } })
  if ((prev.owner ?? null) !== (next.owner ?? null)) out.push({ action: 'finding.owner', detail: { assigned: !!next.owner } })
  return out
}

function levelCounts(findings: Pick<Finding, 'confidence' | 'meta'>[]) {
  const n = { high: 0, medium: 0, low: 0 }
  for (const f of findings) n[confidenceOf(f).level.toLowerCase() as keyof typeof n]++
  return n
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [backend, setBackend] = useState<Backend>(pickBackend)
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [data, setData] = useState<WorkspaceData>(emptyData)
  const [busy, setBusy] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const dataRef = useRef(data)
  dataRef.current = data
  const wsRef = useRef(workspace)
  wsRef.current = workspace
  // Who audit events are recorded against. Set as soon as a user is known,
  // ahead of the re-render.
  const userRef = useRef(user)
  userRef.current = user

  const loadFor = useCallback(async (b: Backend, u: SessionUser | null) => {
    userRef.current = u
    setUser(u)
    if (!u) {
      setWorkspace(null)
      setData(emptyData())
      return
    }
    const ws = await b.getWorkspace(u)
    setWorkspace(ws)
    setData(ws ? await b.loadAll(ws.id) : emptyData())
  }, [])

  const failLoad = useCallback(
    (e: unknown) => {
      const message = mapError(e, 'load')
      setLoadError(message)
      toast(message, 'error')
    },
    [toast],
  )

  useEffect(() => {
    let cancelled = false
    setReady(false)
    backend
      .getSession()
      .then((u) => (cancelled ? undefined : loadFor(backend, u)))
      .then(() => !cancelled && setLoadError(null))
      .catch((e) => !cancelled && failLoad(e))
      .finally(() => !cancelled && setReady(true))
    // Supabase magic-link sign-ins arrive via this listener.
    const off = backend.mode === 'supabase' ? backend.onAuthChange((u) => setUser((prev) => (prev?.id === u?.id ? prev : (void loadFor(backend, u).catch(failLoad), u)))) : () => undefined
    return () => {
      cancelled = true
      off()
    }
  }, [backend, loadFor, failLoad])

  // Every analytics event carries whether this is the demo and which backend.
  useEffect(() => {
    setTrackContext({ is_demo: workspace?.is_demo ?? false, mode: backend.mode })
  }, [user, workspace, backend])

  const withBusy = useCallback(async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    setBusy(label)
    try {
      return await fn()
    } finally {
      setBusy(null)
    }
  }, [])

  const requireWs = () => {
    if (!wsRef.current) throw new Error('No workspace')
    return wsRef.current
  }

  // Appends to the audit log. Best effort: a failed write is reported to the
  // console and never undoes the action it records. Only events the backend
  // accepted are shown.
  const log = useCallback(async (b: Backend, wsId: string, action: AuditAction, target: { type: string; id: string } | null, detail: AuditEvent['detail'] = {}, at?: string) => {
    const e = auditEvent(wsId, { id: userRef.current?.id ?? null, email: userRef.current?.email ?? null }, action, target, detail, at)
    try {
      await b.logEvent(wsId, e)
    } catch (err) {
      console.warn('Audit log write failed', action, err)
      return
    }
    setData((d) => (d.audit_log.some((x) => x.id === e.id) ? d : { ...d, audit_log: [e, ...d.audit_log] }))
  }, [])

  const loadDemoInto = useCallback(async (b: Backend, ws: Workspace, onStage?: (s: DemoStage) => void) => {
    const { buildDemoDataset } = await import('../demo/dataset')
    const files: [UploadKind, string][] = [
      ['clients', 'demo-clients.csv'],
      ['tickets', 'demo-tickets.csv'],
      ['time_entries', 'demo-time-entries.csv'],
      ['assets', 'demo-users-devices.csv'],
      ['billing', 'demo-billing.csv'],
      ['contract', 'demo contracts'],
    ]
    const ids = Object.fromEntries(files.map(([kind, file_name]) => [kind, { id: uuid(), file_name }]))
    const ds = buildDemoDataset(ws.id, ids)
    const rows: Record<UploadKind, number> = { clients: ds.clients.length, tickets: ds.tickets.length, time_entries: ds.time_entries.length, assets: ds.assets.length, billing: ds.billing_items.length, contract: ds.contracts.length }
    const uploads: Upload[] = files.map(([kind, file_name]) => ({
      id: ids[kind].id,
      workspace_id: ws.id,
      kind,
      file_name: kind === 'contract' ? `${rows.contract} ${file_name}` : file_name,
      row_count: rows[kind],
      status: 'imported',
      storage_path: null,
      mapping: null,
      warnings: [],
      created_at: now(),
    }))
    await b.clearAll(ws.id)
    const updated = { ...ws, is_demo: true, settings: { ...DEFAULT_SETTINGS } }
    await b.updateWorkspace(updated)
    wsRef.current = updated
    setWorkspace(updated)
    await b.upsert(ws.id, { clients: ds.clients, contracts: ds.contracts, tickets: ds.tickets, time_entries: ds.time_entries, billing_items: ds.billing_items, assets: ds.assets, uploads })
    const fresh = await b.loadAll(ws.id)
    onStage?.('checking')
    await paint()
    // A fresh demo starts from no findings, so no earlier decision carries over.
    const { analysis, findings } = await analyseFor(updated, { ...fresh, findings: [], stale_findings: [] })
    // The demo opens part-way through the workflow (see demo/stages.ts), with
    // the decisions a person would have recorded. They are set before saving,
    // so the first load already shows them.
    const names = new Map(fresh.clients.map((c) => [c.id, c.name]))
    const demoActor = { id: userRef.current?.id ?? null, email: userRef.current?.email ?? null }
    const { importedAt, runAt, staged, events } = demoHistory({ workspaceId: ws.id, actor: demoActor, uploads, analysisId: analysis.id, findings, clientName: (id) => names.get(id) ?? '', now: Date.now() })
    onStage?.('opening')
    await b.upsert(ws.id, { uploads: uploads.map((u) => ({ ...u, created_at: importedAt })) })
    await b.saveAnalysis(ws.id, { ...analysis, created_at: runAt }, staged)
    for (const e of events) await b.logEvent(ws.id, e)
    setData(await b.loadAll(ws.id))
  }, [])

  const store: Store = {
    ready,
    backend,
    user,
    workspace,
    data,
    analysis: data.analyses[0] ?? null,
    isDemoSession: backend.mode === 'local' && user?.email === DEMO_EMAIL,
    busy,
    loadError,

    async reload() {
      try {
        await loadFor(backend, await backend.getSession())
        setLoadError(null)
      } catch (e) {
        failLoad(e)
      }
    },
    async signIn(email, password) {
      const u = await backend.signIn(email, password)
      await loadFor(backend, u)
    },
    async signUp(email, password, name, opts) {
      const r = await backend.signUp(email, password, name, opts?.plan)
      if (r.user) await loadFor(backend, r.user)
      let intent = opts?.intent
      try {
        intent ??= new URLSearchParams(location.search).get('intent') ?? undefined
      } catch {
        /* no location outside the browser */
      }
      track('signup_completed', { needs_confirmation: r.needsConfirmation, ...(intent ? { intent } : {}) })
      return { needsConfirmation: r.needsConfirmation }
    },
    async sendMagicLink(email) {
      await backend.sendMagicLink(email)
    },
    async signOut(opts) {
      const leaving = user
      await backend.signOut()
      // Local mode keeps everything in this browser; on request, remove it.
      if (opts?.clearLocalData && leaving && backend.forgetLocalUser) await backend.forgetLocalUser(leaving.id)
      try {
        localStorage.removeItem(MODE_KEY)
      } catch {
        /* ignore */
      }
      const next = pickBackend()
      await loadFor(next, null)
      if (next.mode !== backend.mode) setBackend(next)
    },
    async startDemo(opts) {
      const onStage = opts?.onStage
      onStage?.('generating')
      await paint()
      try {
        localStorage.setItem(MODE_KEY, 'demo')
      } catch {
        /* ignore */
      }
      const b = backend.mode === 'local' ? backend : new LocalBackend()
      let u: SessionUser
      try {
        u = await b.signIn(DEMO_EMAIL, DEMO_PASSWORD)
      } catch {
        u = (await b.signUp(DEMO_EMAIL, DEMO_PASSWORD, 'Alex Morgan')).user!
      }
      const ws = (await b.getWorkspace(u)) ?? (await b.createWorkspace(u, 'Northlight IT', true))
      userRef.current = u
      setUser(u)
      await loadDemoInto(b, ws, onStage)
      if (b !== backend) setBackend(b)
      setTrackContext({ is_demo: true, mode: 'local' })
      track('demo_started')
    },
    async createWorkspace(name) {
      if (!user) throw new Error('Not signed in')
      const ws = await backend.createWorkspace(user, name)
      setWorkspace(ws)
      setData(await backend.loadAll(ws.id))
      setTrackContext({ is_demo: ws.is_demo, mode: backend.mode })
      track('workspace_created')
    },
    async updateSettings(patch, name) {
      const ws = requireWs()
      const updated = { ...ws, name: name ?? ws.name, settings: { ...ws.settings, ...patch } }
      await backend.updateWorkspace(updated)
      wsRef.current = updated
      setWorkspace(updated)
      // Which settings changed, by count; never the values.
      const changed = (Object.keys(patch) as (keyof WorkspaceSettings)[]).filter((k) => patch[k] !== ws.settings[k])
      const renamed = name != null && name !== ws.name
      if (changed.length || renamed) await log(backend, ws.id, 'settings.changed', { type: 'workspace', id: ws.id }, { fields: changed.length, keys: changed.slice(0, 6).join(','), renamed })
    },
    async loadDemoData() {
      await withBusy('Loading demo data…', () => loadDemoInto(backend, requireWs()))
    },
    async resetData() {
      const ws = requireWs()
      await withBusy('Clearing data…', async () => {
        const uploads = dataRef.current.uploads.length
        await backend.clearAll(ws.id)
        const updated = { ...ws, is_demo: false }
        await backend.updateWorkspace(updated)
        setWorkspace(updated)
        setData(await backend.loadAll(ws.id))
        // The hosted backend logs this in the same transaction as the delete.
        if (backend.mode === 'local') await log(backend, ws.id, 'data.cleared', { type: 'workspace', id: ws.id }, { uploads })
      })
    },
    async importCsv(kind, fileName, rows, mapping) {
      const ws = requireWs()
      return withBusy('Importing…', async () => {
        const d = dataRef.current
        const uploadId = uuid()
        // Existing rows let a re-upload update records instead of duplicating
        // them. The upload id and file name stamp each row's provenance.
        const ctx: ImportContext = {
          workspaceId: ws.id,
          clients: d.clients,
          existing: { tickets: d.tickets, time_entries: d.time_entries, assets: d.assets, billing_items: d.billing_items },
          upload_id: uploadId,
          file_name: fileName,
        }
        const res = importRows(kind, rows, ctx)
        // Every row written by this file names it, even if the importer gave
        // no row number. A row belongs to the last file that wrote it.
        const stamp = <T extends { source?: { upload_id: string | null } | null }>(r: T): T =>
          r.source?.upload_id === uploadId ? r : { ...r, source: { upload_id: uploadId, file_name: fileName, row: null } }
        res.clients = res.clients.map(stamp)
        res.tickets = res.tickets.map(stamp)
        res.time_entries = res.time_entries.map(stamp)
        res.assets = res.assets.map(stamp)
        res.billing_items = res.billing_items.map(stamp)
        const upload: Upload = {
          id: uploadId,
          workspace_id: ws.id,
          kind,
          file_name: fileName,
          row_count: res.imported,
          status: res.imported ? 'imported' : 'failed',
          storage_path: null,
          mapping,
          warnings: [...res.warnings, ...(res.errors.length ? [`${res.errors.length} row${res.errors.length === 1 ? '' : 's'} skipped because of errors.`] : [])],
          created_at: now(),
        }
        await backend.upsert(ws.id, { clients: res.clients, tickets: res.tickets, time_entries: res.time_entries, assets: res.assets, billing_items: res.billing_items, uploads: [upload] })
        setData(await backend.loadAll(ws.id))
        await log(backend, ws.id, 'upload.created', { type: 'upload', id: uploadId }, { kind, rows: res.imported, added: res.added, updated: res.updated, errors: res.errors.length })
        track('upload_completed', { kind, rows: rows.length, added: res.added, updated: res.updated, errors: res.errors.length })
        return res
      })
    },
    async addContract(clientId, title, text, file) {
      const ws = requireWs()
      await withBusy('Saving contract…', async () => {
        const storage_path = file ? await backend.storeFile(ws.id, file) : null
        const upload: Upload = { id: uuid(), workspace_id: ws.id, kind: 'contract', file_name: file?.name ?? title, row_count: 1, status: 'imported', storage_path, mapping: null, warnings: [], created_at: now() }
        const contract: Contract = { id: uuid(), workspace_id: ws.id, client_id: clientId, title, text: normaliseContractText(text), upload_id: upload.id, created_at: now() }
        await backend.upsert(ws.id, { uploads: [upload], contracts: [contract] })
        setData(await backend.loadAll(ws.id))
        await log(backend, ws.id, 'upload.created', { type: 'upload', id: upload.id }, { kind: 'contract', rows: 1, file_stored: !!storage_path, pages: text.split('\f').length })
      })
    },
    async createClient(fields) {
      const ws = requireWs()
      const c = newClient(ws.id, fields.name.trim(), fields)
      await backend.upsert(ws.id, { clients: [c] })
      setData(await backend.loadAll(ws.id))
      return c
    },
    async runAnalysis(opts) {
      const ws = requireWs()
      const source = opts?.source ?? 'manual'
      const onStage = opts?.onStage
      const started = performance.now()
      track('analysis_started', { source })
      onStage?.('reading')
      await paint()
      onStage?.('checking')
      await paint()
      const { analysis, findings, live, created, stale, removed } = await analyseFor(ws, dataRef.current)
      onStage?.('saving')
      await backend.saveAnalysis(ws.id, analysis, findings)
      setData(await backend.loadAll(ws.id))
      const target = { type: 'analysis', id: analysis.id }
      await log(backend, ws.id, 'analysis.run', target, { findings: live.length, new: created, stale, removed, source })
      if (created) await log(backend, ws.id, 'finding.created', target, { count: created })
      onStage?.('done')
      track('analysis_completed', { source, opportunities: live.length, ...levelCounts(live), duration_ms: Math.round(performance.now() - started) })
      return analysis.summary
    },
    async setFindingStatus(id, status, via = 'detail') {
      await store.setFindingDecision(id, status === 'dismissed' ? { status, dismiss_reason: 'other' } : { status }, via)
    },
    async setFindingDecision(id, decision, via = 'detail') {
      const ws = requireWs()
      const prev = [...dataRef.current.findings, ...dataRef.current.stale_findings].find((f) => f.id === id)
      if (!prev) throw new AppError('This opportunity is no longer in the workspace. Reload and try again.', { code: 'finding_not_found' })
      const status = decision.status ?? prev.status
      if (status === 'dismissed' && !(decision.dismiss_reason ?? (prev.status === 'dismissed' ? prev.dismiss_reason : null)))
        throw new AppError('Choose a reason before dismissing.', { code: 'dismiss_reason_required' })
      const clean = (v: string | null | undefined, max: number) => (v == null ? v : v.trim().slice(0, max) || null)
      const stamp = now()
      const patch: Partial<Finding> = { updated_at: stamp }
      if (status !== prev.status) {
        patch.status = status
        patch.decided_at = stamp
        // A reason belongs to a dismissal; moving out of Dismissed clears it.
        patch.dismiss_reason = status === 'dismissed' ? decision.dismiss_reason! : null
      } else if (status === 'dismissed' && decision.dismiss_reason && decision.dismiss_reason !== prev.dismiss_reason) patch.dismiss_reason = decision.dismiss_reason
      if (decision.decision_note !== undefined) patch.decision_note = clean(decision.decision_note, NOTE_MAX) ?? null
      if (decision.owner !== undefined) patch.owner = clean(decision.owner, OWNER_MAX) ?? null
      const next = { ...prev, ...patch }
      const events = decisionEvents(prev, next, via)
      if (status === prev.status && patch.dismiss_reason) events.unshift({ action: 'finding.dismissed', detail: { from: prev.status, reason: patch.dismiss_reason, via, changed_reason: true } })
      if (!events.length) return
      const apply = (f: Finding) => (f.id === id ? { ...f, ...patch } : f)
      setData((d) => ({ ...d, findings: d.findings.map(apply), stale_findings: d.stale_findings.map(apply) }))
      try {
        await backend.updateFinding(ws.id, id, patch)
      } catch (e) {
        // Put it back, unless something else has changed it since.
        const undo = (f: Finding) => (f.id === id && f.updated_at === stamp ? prev : f)
        setData((d) => ({ ...d, findings: d.findings.map(undo), stale_findings: d.stale_findings.map(undo) }))
        throw e
      }
      for (const ev of events) await log(backend, ws.id, ev.action, { type: 'finding', id }, ev.detail)
      if (status !== prev.status) track('finding_stage_changed', { from: prev.status, to: status, category: prev.category, via })
    },
    async markFindingViewed(id) {
      const ws = wsRef.current
      const f = dataRef.current.findings.find((x) => x.id === id) ?? dataRef.current.stale_findings.find((x) => x.id === id)
      if (!ws || !f || f.first_viewed_at) return
      const stamp = now()
      const apply = (x: Finding) => (x.id === id && !x.first_viewed_at ? { ...x, first_viewed_at: stamp } : x)
      setData((d) => ({ ...d, findings: d.findings.map(apply), stale_findings: d.stale_findings.map(apply) }))
      dataRef.current = { ...dataRef.current, findings: dataRef.current.findings.map(apply), stale_findings: dataRef.current.stale_findings.map(apply) }
      try {
        // updated_at is left alone: opening a finding isn't a change to it.
        await backend.updateFinding(ws.id, id, { first_viewed_at: stamp })
      } catch (e) {
        console.warn('Could not record first view', e)
        return
      }
      await log(backend, ws.id, 'finding.viewed', { type: 'finding', id }, { category: f.category })
    },
    // The hosted ai-review function stores the explanation (and its model,
    // time and evidence hash) and logs ai.explained itself, so the browser can't
    // write text that looks like AI output. Here it is only shown. Local mode
    // has no AI.
    async setFindingExplanation(id, text) {
      const apply = (patch: Pick<Finding, 'ai_explanation'> & Partial<Pick<Finding, 'ai_meta'>>) => (d: WorkspaceData) => ({
        ...d,
        findings: d.findings.map((f) => (f.id === id ? { ...f, ...patch } : f)),
        stale_findings: d.stale_findings.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      })
      setData(apply({ ai_explanation: text }))
      // Read back what the function stored, with its model, time and
      // evidence hash, so the label and freshness check use the saved values.
      const ws = wsRef.current
      if (backend.mode !== 'supabase' || !ws) return
      try {
        const fresh = await backend.loadAll(ws.id)
        const saved = [...fresh.findings, ...fresh.stale_findings].find((f) => f.id === id)
        if (saved) setData(apply({ ai_explanation: saved.ai_explanation ?? null, ai_meta: saved.ai_meta ?? null }))
      } catch (e) {
        console.warn('Could not read back the AI explanation metadata', e)
      }
    },
    // A task on an opportunity. Adding one starts the review of a New
    // opportunity; it never approves it. The value is kept on the row for
    // older reports but nothing sums it, so money is never counted twice.
    async createAction({ finding, title, notes, value, client_id }) {
      const ws = requireWs()
      const action: Action = {
        id: uuid(),
        workspace_id: ws.id,
        finding_id: finding?.id ?? null,
        client_id: finding?.client_id ?? client_id ?? null,
        title,
        notes: notes ?? null,
        status: 'open',
        value: value ?? finding?.estimated_value ?? 0,
        created_at: now(),
        updated_at: now(),
      }
      await backend.saveAction(ws.id, action)
      const current = finding && (dataRef.current.findings.find((f) => f.id === finding.id) ?? finding)
      const moved = !!current && current.status === 'open'
      if (moved) {
        const stamp = now()
        await backend.updateFinding(ws.id, current.id, { status: 'reviewing', decided_at: stamp, updated_at: stamp })
        track('finding_stage_changed', { from: 'open', to: 'reviewing', category: current.category, via: 'detail' })
      }
      setData(await backend.loadAll(ws.id))
      // Recorded as a task, so review metrics can tell it from a deliberate review.
      if (moved) await log(backend, ws.id, 'finding.stage_changed', { type: 'finding', id: current.id }, { from: 'open', to: 'reviewing', via: 'task' })
      return action
    },
    // Finishing a task never moves the opportunity's stage.
    async setActionStatus(id, status) {
      const ws = requireWs()
      const a = dataRef.current.actions.find((x) => x.id === id)
      if (!a) return
      const updated = { ...a, status, updated_at: now() }
      setData((d) => ({ ...d, actions: d.actions.map((x) => (x.id === id ? updated : x)) }))
      try {
        await backend.saveAction(ws.id, updated)
      } catch (e) {
        setData((d) => ({ ...d, actions: d.actions.map((x) => (x.id === id && x.updated_at === updated.updated_at ? a : x)) }))
        throw e
      }
    },
    async recordReport() {
      const ws = requireWs()
      const an = dataRef.current.analyses[0]
      if (!an) return null
      const report: Report = { id: uuid(), workspace_id: ws.id, analysis_id: an.id, title: 'Revenue Opportunity Report', period_label: an.summary.period_label, created_at: now() }
      await backend.saveReport(ws.id, report)
      setData((d) => ({ ...d, reports: [report, ...d.reports] }))
      await log(backend, ws.id, 'export.pdf', { type: 'report', id: report.id }, { scope: 'report', analysis_id: an.id })
      track('report_downloaded', { format: 'pdf' })
      return report
    },
    async logExport(format, opts) {
      const ws = requireWs()
      await log(backend, ws.id, format === 'pdf' ? 'export.pdf' : 'export.csv', null, { scope: opts?.scope ?? 'opportunities', rows: opts?.rows ?? null })
    },
    async deleteUpload(uploadId) {
      const ws = requireWs()
      const kind = dataRef.current.uploads.find((u) => u.id === uploadId)?.kind ?? null
      return withBusy('Deleting file…', async () => {
        const res = await backend.deleteUpload(ws.id, uploadId)
        setData(await backend.loadAll(ws.id))
        // The hosted RPC logs this in the same transaction as the delete.
        if (backend.mode === 'local') await log(backend, ws.id, 'upload.deleted', { type: 'upload', id: uploadId }, { kind, ...res })
        return res
      })
    },
    async deleteAnalysis(analysisId) {
      const ws = requireWs()
      const findings = dataRef.current.findings.filter((f) => f.analysis_id === analysisId).length + dataRef.current.stale_findings.filter((f) => f.analysis_id === analysisId).length
      const reports = dataRef.current.reports.filter((r) => r.analysis_id === analysisId).length
      await withBusy('Deleting analysis…', async () => {
        await backend.deleteAnalysis(ws.id, analysisId)
        setData(await backend.loadAll(ws.id))
        if (backend.mode === 'local') await log(backend, ws.id, 'analysis.deleted', { type: 'analysis', id: analysisId }, { findings, reports })
      })
    },
    // Removes the workspace and everything in it. The account stays, with no
    // workspace, so the app offers to create a new one.
    async deleteWorkspace() {
      const ws = requireWs()
      await withBusy('Deleting workspace…', async () => {
        await backend.deleteWorkspace(ws.id)
        wsRef.current = null
        setWorkspace(null)
        setData(emptyData())
      })
    },
    async deleteAccount() {
      await withBusy('Deleting account…', async () => {
        await backend.deleteAccount()
        try {
          localStorage.removeItem(MODE_KEY)
        } catch {
          /* ignore */
        }
        wsRef.current = null
        const next = pickBackend()
        await loadFor(next, null)
        if (next.mode !== backend.mode) setBackend(next)
      })
    },
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

// ------------------------------------------------------------ live metrics

export const counted = (f: Finding) => f.status !== 'dismissed'
// Still being worked: New, Reviewing or Approved.
export const openish = (f: Finding) => f.status === 'open' || f.status === 'reviewing' || f.status === 'valid'

const zeroLevels = (): Record<ConfidenceLevel, { count: number; value: number; monthly: number }> => ({
  HIGH: { count: 0, value: 0, monthly: 0 },
  MEDIUM: { count: 0, value: 0, monthly: 0 },
  LOW: { count: 0, value: 0, monthly: 0 },
})
const zeroStages = (): Record<FindingStatus, { count: number; value: number }> => ({
  open: { count: 0, value: 0 },
  reviewing: { count: 0, value: 0 },
  valid: { count: 0, value: 0 },
  resolved: { count: 0, value: 0 },
  dismissed: { count: 0, value: 0 },
})

export function useMetrics() {
  const { data, analysis, workspace } = useStore()
  return useMemo(() => {
    const live = data.findings.filter(counted)
    const total = live.reduce((a, f) => a + f.estimated_value, 0)
    const monthly = live.reduce((a, f) => a + f.monthly_value, 0)
    const byCategory: Record<string, { value: number; count: number; clients: Set<string> }> = {}
    const byLevel = zeroLevels()
    let oneOff = 0
    let recurringAgreement = 0
    let recurringPricing = 0
    for (const f of live) {
      const c = (byCategory[f.category] ??= { value: 0, count: 0, clients: new Set() })
      c.value += f.estimated_value
      c.count++
      c.clients.add(f.client_id)
      const l = byLevel[confidenceOf(f).level]
      l.count++
      l.value += f.estimated_value
      l.monthly += f.monthly_value
      if (f.monthly_value === 0) oneOff += f.estimated_value
      else if (recurringKind(f.category) === 'pricing') recurringPricing += f.monthly_value
      else recurringAgreement += f.monthly_value
    }
    // Stages count every finding, dismissed included, so the queue adds up.
    const byStage = zeroStages()
    for (const f of data.findings) {
      const s = (byStage[f.status] ??= { count: 0, value: 0 })
      s.count++
      s.value += f.estimated_value
    }
    const months = analysis?.summary.months ?? []
    const trend = months.map((m) => ({
      month: m,
      label: analysis!.summary.trend.find((t) => t.month === m)?.label ?? m,
      value: live.reduce((a, f) => a + (f.meta.period_values[m] ?? 0), 0),
    }))
    const leakageByClient = new Map<string, number>()
    const liveByClient = new Map<string, Finding[]>()
    for (const f of live) {
      leakageByClient.set(f.client_id, (leakageByClient.get(f.client_id) ?? 0) + f.estimated_value)
      if (!liveByClient.has(f.client_id)) liveByClient.set(f.client_id, [])
      liveByClient.get(f.client_id)!.push(f)
    }
    // At risk is recomputed from the findings that still count, so dismissing
    // one moves the client. Clients without MRR are never at risk on margin.
    const summary = analysis?.summary
    const settings = { ...DEFAULT_SETTINGS, ...workspace?.settings, ...summary?.settings }
    const atRisk = summary
      ? summary.client_metrics.filter((mt) => liveClientHealth(mt, liveByClient.get(mt.client_id) ?? [], settings, summary.average_monthly_hours, summary.months.length).health === 'at_risk').length
      : 0
    const open = data.findings.filter(openish)
    const resolved = data.findings.filter((f) => f.status === 'resolved')
    const names = new Map(data.clients.map((c) => [c.id, c.name]))
    return {
      total,
      monthly,
      annual: monthly * 12,
      count: live.length,
      byCategory,
      trend,
      leakageByClient,
      openCount: open.length,
      openValue: open.reduce((a, f) => a + f.estimated_value, 0),
      resolvedValue: resolved.reduce((a, f) => a + f.estimated_value, 0),
      clientName: (id: string | null) => (id != null && names.get(id)) || 'Unknown client',
      // one-off money (no monthly part) and the recurring split
      oneOff,
      recurringAgreement,
      recurringPricing,
      clientsAffected: liveByClient.size,
      atRisk,
      byLevel,
      byStage,
      // counted twice and disclosed, not netted (see lib/overlap)
      overlap: overlapOf(data.findings),
      history: data.analyses,
    }
  }, [data, analysis, workspace])
}
