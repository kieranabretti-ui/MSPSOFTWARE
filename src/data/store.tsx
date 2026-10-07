import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { liveClientHealth } from '../engine/health'
import type {
  Action,
  ActionStatus,
  Analysis,
  AnalysisSummary,
  Client,
  ConfidenceLevel,
  Contract,
  Dataset,
  Finding,
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
import { confidenceOf } from '../lib/confidence'
import { mapError } from '../lib/errors'
import { recurringKind } from '../lib/labels'
import { overlapOf } from '../lib/overlap'
import { setTrackContext, track, type AnalysisSource } from '../lib/track'
import type { Backend, SessionUser, WorkspaceData } from './backend'
import { emptyData } from './backend'
import { LocalBackend } from './localBackend'
import { LazySupabaseBackend } from './lazySupabase'
import { importRows, newClient, uuid, type CsvKind, type ImportResult, type MappedRow } from './importers'

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
  signOut(): Promise<void>
  startDemo(opts?: { onStage?: (s: DemoStage) => void }): Promise<void>
  createWorkspace(name: string): Promise<void>
  updateSettings(patch: Partial<WorkspaceSettings>, name?: string): Promise<void>
  loadDemoData(): Promise<void>
  resetData(): Promise<void>
  importCsv(kind: CsvKind, fileName: string, rows: MappedRow[], mapping: Record<string, string>): Promise<ImportResult>
  addContract(clientId: string, title: string, text: string, file: File | null): Promise<void>
  createClient(fields: Partial<Client> & { name: string }): Promise<Client>
  runAnalysis(opts?: { source?: Exclude<AnalysisSource, 'demo'>; onStage?: (s: AnalysisStage) => void }): Promise<AnalysisSummary>
  setFindingStatus(id: string, status: FindingStatus, via?: 'detail' | 'queue'): Promise<void>
  setFindingExplanation(id: string, text: string): Promise<void>
  createAction(input: { finding?: Finding; title: string; notes?: string; value?: number; client_id?: string | null }): Promise<Action>
  setActionStatus(id: string, status: ActionStatus): Promise<void>
  recordReport(): Promise<Report | null>
}

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

// Runs the engine and carries ids, stages and AI notes over to findings that
// still apply. Pure: nothing is saved here. The engine loads on first use, so
// the landing page doesn't ship it.
const analyseFor = async (ws: Workspace, d: WorkspaceData) => {
  const { analyse } = await import('../engine/analyse')
  const { summary, findings } = analyse(dataset(ws, d))
  const analysis: Analysis = { id: uuid(), workspace_id: ws.id, period_start: summary.period_start, period_end: summary.period_end, summary, created_at: now() }
  const prev = new Map(d.findings.map((f) => [f.finding_key, f]))
  const merged: Finding[] = findings.map((f) => {
    const p = prev.get(f.finding_key)
    return {
      ...f,
      id: p?.id ?? uuid(),
      workspace_id: ws.id,
      analysis_id: analysis.id,
      status: p?.status ?? 'open',
      ai_explanation: p?.ai_explanation ?? null,
      created_at: p?.created_at ?? now(),
      updated_at: now(),
    }
  })
  return { analysis, findings: merged }
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

  const loadFor = useCallback(async (b: Backend, u: SessionUser | null) => {
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

  const loadDemoInto = useCallback(async (b: Backend, ws: Workspace, onStage?: (s: DemoStage) => void) => {
    const { buildDemoDataset } = await import('../demo/dataset')
    const ds = buildDemoDataset(ws.id)
    const kinds: [UploadKind, string, number][] = [
      ['clients', 'demo-clients.csv', ds.clients.length],
      ['tickets', 'demo-tickets.csv', ds.tickets.length],
      ['time_entries', 'demo-time-entries.csv', ds.time_entries.length],
      ['assets', 'demo-users-devices.csv', ds.assets.length],
      ['billing', 'demo-billing.csv', ds.billing_items.length],
      ['contract', `${ds.contracts.length} demo contracts`, ds.contracts.length],
    ]
    const uploads: Upload[] = kinds.map(([kind, file_name, row_count]) => ({ id: uuid(), workspace_id: ws.id, kind, file_name, row_count, status: 'imported', storage_path: null, mapping: null, warnings: [], created_at: now() }))
    await b.clearAll(ws.id)
    const updated = { ...ws, is_demo: true, settings: { ...DEFAULT_SETTINGS } }
    await b.updateWorkspace(updated)
    wsRef.current = updated
    setWorkspace(updated)
    await b.upsert(ws.id, { clients: ds.clients, contracts: ds.contracts, tickets: ds.tickets, time_entries: ds.time_entries, billing_items: ds.billing_items, assets: ds.assets, uploads })
    const fresh = await b.loadAll(ws.id)
    onStage?.('checking')
    await paint()
    const { analysis, findings } = await analyseFor(updated, fresh)
    // The demo opens part-way through the workflow (see demo/stages.ts). The
    // stages are set before saving, so the first load already shows them.
    const names = new Map(fresh.clients.map((c) => [c.id, c.name]))
    const stages = new Map(applyDemoStages(findings, (id) => names.get(id) ?? '').map((s) => [s.id, s.status]))
    const staged = findings.map((f) => (stages.has(f.id) ? { ...f, status: stages.get(f.id)! } : f))
    onStage?.('opening')
    await b.saveAnalysis(ws.id, analysis, staged)
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
    async signOut() {
      await backend.signOut()
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
    },
    async loadDemoData() {
      await withBusy('Loading demo data…', () => loadDemoInto(backend, requireWs()))
    },
    async resetData() {
      const ws = requireWs()
      await withBusy('Clearing data…', async () => {
        await backend.clearAll(ws.id)
        const updated = { ...ws, is_demo: false }
        await backend.updateWorkspace(updated)
        setWorkspace(updated)
        setData(await backend.loadAll(ws.id))
      })
    },
    async importCsv(kind, fileName, rows, mapping) {
      const ws = requireWs()
      return withBusy('Importing…', async () => {
        const d = dataRef.current
        // Existing rows let a re-upload update records instead of duplicating them.
        const res = importRows(kind, rows, {
          workspaceId: ws.id,
          clients: d.clients,
          existing: { tickets: d.tickets, time_entries: d.time_entries, assets: d.assets, billing_items: d.billing_items },
        })
        const upload: Upload = {
          id: uuid(),
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
        track('upload_completed', { kind, rows: rows.length, added: res.added, updated: res.updated, errors: res.errors.length })
        return res
      })
    },
    async addContract(clientId, title, text, file) {
      const ws = requireWs()
      await withBusy('Saving contract…', async () => {
        const storage_path = file ? await backend.storeFile(ws.id, file) : null
        const upload: Upload = { id: uuid(), workspace_id: ws.id, kind: 'contract', file_name: file?.name ?? title, row_count: 1, status: 'imported', storage_path, mapping: null, warnings: [], created_at: now() }
        const contract: Contract = { id: uuid(), workspace_id: ws.id, client_id: clientId, title, text, upload_id: upload.id, created_at: now() }
        await backend.upsert(ws.id, { uploads: [upload], contracts: [contract] })
        setData(await backend.loadAll(ws.id))
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
      const { analysis, findings } = await analyseFor(ws, dataRef.current)
      onStage?.('saving')
      await backend.saveAnalysis(ws.id, analysis, findings)
      setData(await backend.loadAll(ws.id))
      onStage?.('done')
      track('analysis_completed', { source, opportunities: findings.length, ...levelCounts(findings), duration_ms: Math.round(performance.now() - started) })
      return analysis.summary
    },
    async setFindingStatus(id, status, via = 'detail') {
      const ws = requireWs()
      const prev = dataRef.current.findings.find((f) => f.id === id)
      const stamp = now()
      setData((d) => ({ ...d, findings: d.findings.map((f) => (f.id === id ? { ...f, status, updated_at: stamp } : f)) }))
      try {
        await backend.updateFinding(ws.id, id, { status, updated_at: stamp })
      } catch (e) {
        // Put it back, unless something else has changed it since.
        if (prev) setData((d) => ({ ...d, findings: d.findings.map((f) => (f.id === id && f.status === status ? { ...f, status: prev.status, updated_at: prev.updated_at } : f)) }))
        throw e
      }
      if (prev && prev.status !== status) track('finding_stage_changed', { from: prev.status, to: status, category: prev.category, via })
    },
    async setFindingExplanation(id, text) {
      const ws = requireWs()
      setData((d) => ({ ...d, findings: d.findings.map((f) => (f.id === id ? { ...f, ai_explanation: text } : f)) }))
      await backend.updateFinding(ws.id, id, { ai_explanation: text })
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
      if (current && current.status === 'open') {
        await backend.updateFinding(ws.id, current.id, { status: 'reviewing', updated_at: now() })
        track('finding_stage_changed', { from: 'open', to: 'reviewing', category: current.category, via: 'detail' })
      }
      setData(await backend.loadAll(ws.id))
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
      const report: Report = { id: uuid(), workspace_id: ws.id, analysis_id: an.id, title: 'MSP Revenue Leakage Report', period_label: an.summary.period_label, created_at: now() }
      await backend.saveReport(ws.id, report)
      setData((d) => ({ ...d, reports: [report, ...d.reports] }))
      track('report_downloaded', { format: 'pdf' })
      return report
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
