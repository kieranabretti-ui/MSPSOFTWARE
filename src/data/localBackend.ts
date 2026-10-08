// Browser-only backend used when Supabase isn't configured, and for the
// one-click demo. Everything lives in localStorage on this device.
import { DEFAULT_SETTINGS, type Workspace } from '../engine/types'
import { AppError } from '../lib/errors'
import { emptyData, pickDecision, splitStale, type Backend, type DataPatch, type SessionUser, type UploadDeletion, type WorkspaceData } from './backend'

const USERS = 'headroom:users'
const SESSION = 'headroom:session'
const WS_INDEX = 'headroom:workspaces'
const dataKey = (id: string) => `headroom:data:${id}`
// The audit log is append-only; the oldest events drop off past this many so
// one browser's storage can't fill up. Stated in the data and privacy copy.
export const LOCAL_AUDIT_CAP = 2000
export const LOCAL_ANALYSIS_CAP = 12

interface StoredUser extends SessionUser {
  salt: string
  hash: string
}

// When the browser blocks storage (private windows, embedded previews) data is
// kept in memory for this tab instead, so the demo still works.
const memory = new Map<string, string>()

const read = <T,>(key: string, fallback: T): T => {
  let raw: string | null | undefined
  try {
    raw = localStorage.getItem(key)
  } catch {
    raw = memory.get(key)
  }
  try {
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown) => {
  const raw = JSON.stringify(value)
  try {
    localStorage.setItem(key, raw)
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError')
      throw new AppError('This browser has run out of local storage. Clear data on the Analyses page or use an account.', { code: 'quota_exceeded', detail: e.message })
    memory.set(key, raw)
  }
}

const remove = (key: string) => {
  memory.delete(key)
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage blocked */
  }
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${password}`))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export class LocalBackend implements Backend {
  mode = 'local' as const
  supportsMagicLink = false
  private listeners = new Set<(u: SessionUser | null) => void>()
  private cache = new Map<string, WorkspaceData>()

  private emit(u: SessionUser | null) {
    this.listeners.forEach((l) => l(u))
  }

  async getSession() {
    const id = read<string | null>(SESSION, null)
    if (!id) return null
    const u = read<StoredUser[]>(USERS, []).find((x) => x.id === id)
    return u ? { id: u.id, email: u.email, name: u.name } : null
  }

  async signUp(email: string, password: string, name: string) {
    const users = read<StoredUser[]>(USERS, [])
    const e = email.trim().toLowerCase()
    if (users.some((u) => u.email === e)) throw new AppError('An account with this email already exists on this device. Sign in instead.', { code: 'user_already_exists' })
    const salt = crypto.randomUUID()
    const user: StoredUser = { id: crypto.randomUUID(), email: e, name: name.trim() || e.split('@')[0], salt, hash: await hashPassword(password, salt) }
    write(USERS, [...users, user])
    write(SESSION, user.id)
    const session = { id: user.id, email: user.email, name: user.name }
    this.emit(session)
    return { user: session, needsConfirmation: false }
  }

  async signIn(email: string, password: string) {
    const u = read<StoredUser[]>(USERS, []).find((x) => x.email === email.trim().toLowerCase())
    if (!u || (await hashPassword(password, u.salt)) !== u.hash) throw new AppError('Email or password is incorrect.', { code: 'invalid_credentials' })
    write(SESSION, u.id)
    const session = { id: u.id, email: u.email, name: u.name }
    this.emit(session)
    return session
  }

  async sendMagicLink() {
    throw new AppError('Magic links need Supabase to be configured.', { code: 'magic_link_unavailable' })
  }

  async signOut() {
    remove(SESSION)
    this.emit(null)
  }

  onAuthChange(cb: (u: SessionUser | null) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async getWorkspace(user: SessionUser) {
    const index = read<Record<string, Workspace>>(WS_INDEX, {})
    const ws = index[user.id]
    return ws ? { ...ws, settings: { ...DEFAULT_SETTINGS, ...ws.settings } } : null
  }

  async createWorkspace(user: SessionUser, name: string, isDemo = false) {
    const ws: Workspace = { id: crypto.randomUUID(), name: name.trim(), settings: { ...DEFAULT_SETTINGS }, is_demo: isDemo, created_at: new Date().toISOString() }
    const index = read<Record<string, Workspace>>(WS_INDEX, {})
    index[user.id] = ws
    write(WS_INDEX, index)
    write(dataKey(ws.id), emptyData())
    return ws
  }

  async updateWorkspace(ws: Workspace) {
    const index = read<Record<string, Workspace>>(WS_INDEX, {})
    for (const [uid, w] of Object.entries(index)) if (w.id === ws.id) index[uid] = ws
    write(WS_INDEX, index)
  }

  // Raw stored data: live and stale findings share `findings`, as in the
  // hosted table; loadAll splits them.
  private get(id: string): WorkspaceData {
    if (!this.cache.has(id)) {
      const d = { ...emptyData(), ...read<Partial<WorkspaceData>>(dataKey(id), {}) }
      if (d.stale_findings.length) d.findings = [...d.findings, ...d.stale_findings]
      d.stale_findings = []
      this.cache.set(id, d)
    }
    return this.cache.get(id)!
  }

  private save(id: string) {
    write(dataKey(id), this.get(id))
  }

  async loadAll(id: string) {
    return splitStale(structuredClone(this.get(id)))
  }

  async upsert(id: string, patch: DataPatch) {
    const d = this.get(id)
    for (const [table, rows] of Object.entries(patch) as [keyof DataPatch, { id: string }[]][]) {
      if (!rows?.length) continue
      const list = d[table] as { id: string }[]
      const byId = new Map(list.map((r, i) => [r.id, i]))
      for (const r of rows) {
        const i = byId.get(r.id)
        if (i == null) list.push(r)
        else list[i] = r
      }
    }
    this.save(id)
  }

  // Keeps the audit log: clearing data is itself an event worth keeping.
  async clearAll(id: string) {
    const audit = this.get(id).audit_log
    this.cache.set(id, { ...emptyData(), audit_log: audit })
    this.save(id)
  }

  async saveAnalysis(id: string, analysis: WorkspaceData['analyses'][number], findings: WorkspaceData['findings']) {
    const d = this.get(id)
    // Newest first; older runs drop off to save space, with their reports.
    d.analyses = [analysis, ...d.analyses].slice(0, LOCAL_ANALYSIS_CAP)
    const kept = new Set(d.analyses.map((a) => a.id))
    d.reports = d.reports.filter((r) => kept.has(r.analysis_id))
    d.findings = findings
    this.unlinkActions(d)
    this.save(id)
  }

  private unlinkActions(d: WorkspaceData) {
    const live = new Set(d.findings.map((f) => f.id))
    d.actions = d.actions.map((a) => (a.finding_id && !live.has(a.finding_id) ? { ...a, finding_id: null } : a))
  }

  async updateFinding(id: string, fid: string, patch: Partial<WorkspaceData['findings'][number]>) {
    const d = this.get(id)
    const allowed = pickDecision(patch)
    d.findings = d.findings.map((f) => (f.id === fid ? { ...f, ...allowed } : f))
    this.save(id)
  }

  async logEvent(id: string, event: WorkspaceData['audit_log'][number]) {
    const d = this.get(id)
    d.audit_log = [event, ...d.audit_log].slice(0, LOCAL_AUDIT_CAP)
    this.save(id)
  }

  // Same rules as the hosted delete_upload(): rows the file produced go;
  // clients it created stay if anything else of theirs remains.
  async deleteUpload(id: string, uploadId: string): Promise<UploadDeletion> {
    const d = this.get(id)
    const mine = (r: { source?: { upload_id: string | null } | null }) => r.source?.upload_id === uploadId
    const count = <T,>(list: T[], drop: (r: T) => boolean) => {
      const before = list.length
      const after = list.filter((r) => !drop(r))
      return [after, before - after.length] as const
    }
    let n: number
    const out: UploadDeletion = { tickets: 0, time_entries: 0, billing_items: 0, assets: 0, contracts: 0, clients: 0, clients_kept: 0 }
    ;[d.tickets, n] = count(d.tickets, mine)
    out.tickets = n
    ;[d.time_entries, n] = count(d.time_entries, mine)
    out.time_entries = n
    ;[d.billing_items, n] = count(d.billing_items, mine)
    out.billing_items = n
    ;[d.assets, n] = count(d.assets, mine)
    out.assets = n
    ;[d.contracts, n] = count(d.contracts, (c) => c.upload_id === uploadId)
    out.contracts = n
    const inUse = new Set([...d.tickets, ...d.time_entries, ...d.billing_items, ...d.assets, ...d.contracts].map((r) => r.client_id))
    ;[d.clients, n] = count(d.clients, (c) => mine(c) && !inUse.has(c.id))
    out.clients = n
    d.clients = d.clients.map((c) => (mine(c) ? (out.clients_kept++, { ...c, source: null }) : c))
    // Findings on removed clients go with them, as the hosted foreign keys do.
    const clients = new Set(d.clients.map((c) => c.id))
    d.findings = d.findings.filter((f) => clients.has(f.client_id))
    d.actions = d.actions.map((a) => (a.client_id && !clients.has(a.client_id) ? { ...a, client_id: null } : a))
    this.unlinkActions(d)
    d.uploads = d.uploads.filter((u) => u.id !== uploadId)
    this.save(id)
    return out
  }

  async deleteAnalysis(id: string, analysisId: string) {
    const d = this.get(id)
    d.findings = d.findings.filter((f) => f.analysis_id !== analysisId)
    d.reports = d.reports.filter((r) => r.analysis_id !== analysisId)
    d.analyses = d.analyses.filter((a) => a.id !== analysisId)
    this.unlinkActions(d)
    this.save(id)
  }

  async deleteWorkspace(id: string) {
    const index = read<Record<string, Workspace>>(WS_INDEX, {})
    for (const [uid, w] of Object.entries(index)) if (w.id === id) delete index[uid]
    write(WS_INDEX, index)
    this.cache.delete(id)
    remove(dataKey(id))
  }

  // Everything this browser holds for one user: their workspace data, the
  // workspace entry, the account record and, if it's theirs, the session.
  async forgetLocalUser(userId: string) {
    const index = read<Record<string, Workspace>>(WS_INDEX, {})
    const ws = index[userId]
    if (ws) await this.deleteWorkspace(ws.id)
    write(
      USERS,
      read<StoredUser[]>(USERS, []).filter((u) => u.id !== userId),
    )
    if (read<string | null>(SESSION, null) === userId) {
      remove(SESSION)
      this.emit(null)
    }
  }

  async deleteAccount() {
    const id = read<string | null>(SESSION, null)
    if (!id) throw new AppError('Sign in to delete your account.', { code: 'not_signed_in' })
    await this.forgetLocalUser(id)
  }

  async saveAction(id: string, action: WorkspaceData['actions'][number]) {
    const d = this.get(id)
    d.actions = d.actions.some((a) => a.id === action.id) ? d.actions.map((a) => (a.id === action.id ? action : a)) : [action, ...d.actions]
    this.save(id)
  }

  async saveReport(id: string, report: WorkspaceData['reports'][number]) {
    const d = this.get(id)
    d.reports = [report, ...d.reports.filter((r) => r.id !== report.id)]
    this.save(id)
  }

  async storeFile() {
    return null
  }
}
