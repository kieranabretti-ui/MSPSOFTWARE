// Browser-only backend used when Supabase isn't configured, and for the
// one-click demo. Everything lives in localStorage on this device.
import { DEFAULT_SETTINGS, type Workspace } from '../engine/types'
import { emptyData, type Backend, type DataPatch, type SessionUser, type WorkspaceData } from './backend'

const USERS = 'mspleak:users'
const SESSION = 'mspleak:session'
const WS_INDEX = 'mspleak:workspaces'
const dataKey = (id: string) => `mspleak:data:${id}`

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
    if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new Error('This browser has run out of local storage. Clear demo data in Settings or connect Supabase.')
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
    if (users.some((u) => u.email === e)) throw new Error('An account with this email already exists on this device. Sign in instead.')
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
    if (!u || (await hashPassword(password, u.salt)) !== u.hash) throw new Error('Email or password is incorrect.')
    write(SESSION, u.id)
    const session = { id: u.id, email: u.email, name: u.name }
    this.emit(session)
    return session
  }

  async sendMagicLink() {
    throw new Error('Magic links need Supabase to be configured.')
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

  private get(id: string): WorkspaceData {
    if (!this.cache.has(id)) this.cache.set(id, { ...emptyData(), ...read<Partial<WorkspaceData>>(dataKey(id), {}) })
    return this.cache.get(id)!
  }

  private save(id: string) {
    write(dataKey(id), this.get(id))
  }

  async loadAll(id: string) {
    return structuredClone(this.get(id))
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

  async clearAll(id: string) {
    this.cache.set(id, emptyData())
    this.save(id)
  }

  async saveAnalysis(id: string, analysis: WorkspaceData['analyses'][number], findings: WorkspaceData['findings']) {
    const d = this.get(id)
    d.analyses = [analysis] // only the latest is kept
    d.findings = findings
    const live = new Set(findings.map((f) => f.id))
    d.actions = d.actions.map((a) => (a.finding_id && !live.has(a.finding_id) ? { ...a, finding_id: null } : a))
    this.save(id)
  }

  async updateFinding(id: string, fid: string, patch: Partial<WorkspaceData['findings'][number]>) {
    const d = this.get(id)
    d.findings = d.findings.map((f) => (f.id === fid ? { ...f, ...patch } : f))
    this.save(id)
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
