import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { analyse } from '../engine/analyse'
import type { Action, ActionStatus, Analysis, Client, Contract, Dataset, Finding, FindingStatus, Report, Upload, UploadKind, Workspace, WorkspaceSettings } from '../engine/types'
import { DEFAULT_SETTINGS } from '../engine/types'
import type { Backend, SessionUser, WorkspaceData } from './backend'
import { emptyData } from './backend'
import { LocalBackend } from './localBackend'
import { SupabaseBackend } from './supabaseBackend'
import { importRows, newClient, uuid, type CsvKind, type ImportResult, type MappedRow } from './importers'

const SB_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabaseConfigured = !!(SB_URL && SB_KEY)
const MODE_KEY = 'mspleak:mode'
const DEMO_EMAIL = 'demo@mspleak.app'
const DEMO_PASSWORD = 'northlight-demo'

function pickBackend(): Backend {
  let demo = false
  try {
    demo = localStorage.getItem(MODE_KEY) === 'demo'
  } catch {
    /* storage blocked */
  }
  return supabaseConfigured && !demo ? new SupabaseBackend(SB_URL!, SB_KEY!) : new LocalBackend()
}

interface Store {
  ready: boolean
  backend: Backend
  user: SessionUser | null
  workspace: Workspace | null
  data: WorkspaceData
  analysis: Analysis | null
  isDemoSession: boolean
  busy: string | null
  signIn(email: string, password: string): Promise<void>
  signUp(email: string, password: string, name: string): Promise<{ needsConfirmation: boolean }>
  sendMagicLink(email: string): Promise<void>
  signOut(): Promise<void>
  startDemo(): Promise<void>
  createWorkspace(name: string): Promise<void>
  updateSettings(patch: Partial<WorkspaceSettings>, name?: string): Promise<void>
  loadDemoData(): Promise<void>
  resetData(): Promise<void>
  importCsv(kind: CsvKind, fileName: string, rows: MappedRow[], mapping: Record<string, string>): Promise<ImportResult>
  addContract(clientId: string, title: string, text: string, file: File | null): Promise<void>
  createClient(fields: Partial<Client> & { name: string }): Promise<Client>
  runAnalysis(): Promise<void>
  setFindingStatus(id: string, status: FindingStatus): Promise<void>
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend>(pickBackend)
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<SessionUser | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [data, setData] = useState<WorkspaceData>(emptyData)
  const [busy, setBusy] = useState<string | null>(null)
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

  useEffect(() => {
    let cancelled = false
    setReady(false)
    backend
      .getSession()
      .then((u) => (cancelled ? undefined : loadFor(backend, u)))
      .catch(() => undefined)
      .finally(() => !cancelled && setReady(true))
    // Supabase magic-link sign-ins arrive via this listener.
    const off = backend.mode === 'supabase' ? backend.onAuthChange((u) => setUser((prev) => (prev?.id === u?.id ? prev : (void loadFor(backend, u), u)))) : () => undefined
    return () => {
      cancelled = true
      off()
    }
  }, [backend, loadFor])

  const withBusy = useCallback(async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    setBusy(label)
    try {
      return await fn()
    } finally {
      setBusy(null)
    }
  }, [])

  const dataset = (ws: Workspace, d: WorkspaceData): Dataset => ({
    settings: { ...DEFAULT_SETTINGS, ...ws.settings },
    clients: d.clients,
    contracts: d.contracts,
    tickets: d.tickets,
    time_entries: d.time_entries,
    billing_items: d.billing_items,
    assets: d.assets,
  })

  const runAnalysisFor = useCallback(
    async (b: Backend, ws: Workspace, d: WorkspaceData) => {
      const { summary, findings } = analyse(dataset(ws, d))
      const analysis: Analysis = { id: uuid(), workspace_id: ws.id, period_start: summary.period_start, period_end: summary.period_end, summary, created_at: now() }
      // Keep ids, statuses and notes for findings that still apply.
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
      await b.saveAnalysis(ws.id, analysis, merged)
      setData(await b.loadAll(ws.id))
    },
    [],
  )

  const requireWs = () => {
    if (!wsRef.current) throw new Error('No workspace')
    return wsRef.current
  }

  const loadDemoInto = useCallback(
    async (b: Backend, ws: Workspace) => {
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
      await runAnalysisFor(b, updated, fresh)
    },
    [runAnalysisFor],
  )

  const store: Store = {
    ready,
    backend,
    user,
    workspace,
    data,
    analysis: data.analyses[0] ?? null,
    isDemoSession: backend.mode === 'local' && user?.email === DEMO_EMAIL,
    busy,

    async signIn(email, password) {
      const u = await backend.signIn(email, password)
      await loadFor(backend, u)
    },
    async signUp(email, password, name) {
      const r = await backend.signUp(email, password, name)
      if (r.user) await loadFor(backend, r.user)
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
    async startDemo() {
      await withBusy('Loading demo MSP…', async () => {
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
        await loadDemoInto(b, ws)
        if (b !== backend) setBackend(b)
      })
    },
    async createWorkspace(name) {
      if (!user) throw new Error('Not signed in')
      const ws = await backend.createWorkspace(user, name)
      setWorkspace(ws)
      setData(await backend.loadAll(ws.id))
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
        const res = importRows(kind, rows, { workspaceId: ws.id, clients: dataRef.current.clients })
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
    async runAnalysis() {
      const ws = requireWs()
      await withBusy('Analysing your data…', async () => {
        await new Promise((r) => setTimeout(r, 350)) // let the UI paint the busy state
        await runAnalysisFor(backend, ws, dataRef.current)
      })
    },
    async setFindingStatus(id, status) {
      const ws = requireWs()
      setData((d) => ({ ...d, findings: d.findings.map((f) => (f.id === id ? { ...f, status } : f)) }))
      await backend.updateFinding(ws.id, id, { status, updated_at: now() })
    },
    async setFindingExplanation(id, text) {
      const ws = requireWs()
      setData((d) => ({ ...d, findings: d.findings.map((f) => (f.id === id ? { ...f, ai_explanation: text } : f)) }))
      await backend.updateFinding(ws.id, id, { ai_explanation: text })
    },
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
      if (finding && finding.status === 'open') await backend.updateFinding(ws.id, finding.id, { status: 'valid', updated_at: now() })
      setData(await backend.loadAll(ws.id))
      return action
    },
    async setActionStatus(id, status) {
      const ws = requireWs()
      const a = dataRef.current.actions.find((x) => x.id === id)
      if (!a) return
      const updated = { ...a, status, updated_at: now() }
      setData((d) => ({ ...d, actions: d.actions.map((x) => (x.id === id ? updated : x)) }))
      await backend.saveAction(ws.id, updated)
      if (status === 'resolved' && a.finding_id) await store.setFindingStatus(a.finding_id, 'resolved')
    },
    async recordReport() {
      const ws = requireWs()
      const an = dataRef.current.analyses[0]
      if (!an) return null
      const report: Report = { id: uuid(), workspace_id: ws.id, analysis_id: an.id, title: 'MSP Revenue Leakage Report', period_label: an.summary.period_label, created_at: now() }
      await backend.saveReport(ws.id, report)
      setData((d) => ({ ...d, reports: [report, ...d.reports] }))
      return report
    },
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

// ------------------------------------------------------------ live metrics

export const counted = (f: Finding) => f.status !== 'dismissed'
export const openish = (f: Finding) => f.status === 'open' || f.status === 'valid'

export function useMetrics() {
  const { data, analysis } = useStore()
  return useMemo(() => {
    const live = data.findings.filter(counted)
    const total = live.reduce((a, f) => a + f.estimated_value, 0)
    const monthly = live.reduce((a, f) => a + f.monthly_value, 0)
    const byCategory: Record<string, { value: number; count: number; clients: Set<string> }> = {}
    for (const f of live) {
      const c = (byCategory[f.category] ??= { value: 0, count: 0, clients: new Set() })
      c.value += f.estimated_value
      c.count++
      c.clients.add(f.client_id)
    }
    const months = analysis?.summary.months ?? []
    const trend = months.map((m) => ({
      month: m,
      label: analysis!.summary.trend.find((t) => t.month === m)?.label ?? m,
      value: live.reduce((a, f) => a + (f.meta.period_values[m] ?? 0), 0),
    }))
    const leakageByClient = new Map<string, number>()
    for (const f of live) leakageByClient.set(f.client_id, (leakageByClient.get(f.client_id) ?? 0) + f.estimated_value)
    const open = data.findings.filter(openish)
    const resolved = data.findings.filter((f) => f.status === 'resolved')
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
      clientName: (id: string | null) => data.clients.find((c) => c.id === id)?.name ?? 'Unknown client',
    }
  }, [data, analysis])
}
