// Supabase backend. Tables and RLS policies live in supabase/migrations; every
// row carries workspace_id and policies restrict access to workspace members.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS, type Workspace } from '../engine/types'
import { emptyData, type Backend, type DataPatch, type SessionUser, type WorkspaceData } from './backend'

const TABLES: (keyof WorkspaceData)[] = ['clients', 'contracts', 'tickets', 'time_entries', 'billing_items', 'assets', 'uploads', 'analyses', 'findings', 'actions', 'reports']
const CHUNK = 500
const PAGE = 1000

const toSession = (u: User): SessionUser => ({ id: u.id, email: u.email ?? '', name: (u.user_metadata?.name as string) || (u.email ?? '').split('@')[0] })

const friendly = (message: string) => (/failed to fetch|networkerror|load failed/i.test(message) ? 'Could not reach the server. Check your connection and try again.' : message)

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(friendly(res.error.message))
  return res.data
}

export class SupabaseBackend implements Backend {
  mode = 'supabase' as const
  supportsMagicLink = true
  private sb: SupabaseClient

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey)
  }

  async getSession() {
    const { data } = await this.sb.auth.getSession()
    return data.session?.user ? toSession(data.session.user) : null
  }

  async signUp(email: string, password: string, name: string) {
    const data = check(await this.sb.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: `${location.origin}/app` } }))
    return { user: data.session?.user ? toSession(data.session.user) : null, needsConfirmation: !data.session }
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password })
    if (error) throw new Error(friendly(error.message))
    return toSession(data.user)
  }

  async sendMagicLink(email: string) {
    check(await this.sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/app` } }))
  }

  async signOut() {
    await this.sb.auth.signOut()
  }

  onAuthChange(cb: (u: SessionUser | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_e, session) => cb(session?.user ? toSession(session.user) : null))
    return () => data.subscription.unsubscribe()
  }

  async getWorkspace(user: SessionUser) {
    const rows = check(await this.sb.from('workspace_members').select('workspace:workspaces(*)').eq('user_id', user.id).limit(1))
    const ws = (rows?.[0] as unknown as { workspace: Workspace } | undefined)?.workspace
    return ws ? { ...ws, settings: { ...DEFAULT_SETTINGS, ...ws.settings } } : null
  }

  async createWorkspace(_user: SessionUser, name: string, isDemo = false) {
    // Security-definer function creates the workspace and the membership row.
    const id = check(await this.sb.rpc('create_workspace', { ws_name: name, ws_settings: DEFAULT_SETTINGS, ws_is_demo: isDemo })) as string
    const ws = check(await this.sb.from('workspaces').select('*').eq('id', id).single()) as Workspace
    return ws
  }

  async updateWorkspace(ws: Workspace) {
    check(await this.sb.from('workspaces').update({ name: ws.name, settings: ws.settings }).eq('id', ws.id))
  }

  private async selectAll(table: string, workspaceId: string) {
    const out: unknown[] = []
    for (let from = 0; ; from += PAGE) {
      const rows = check(await this.sb.from(table).select('*').eq('workspace_id', workspaceId).range(from, from + PAGE - 1))
      out.push(...(rows ?? []))
      if (!rows || rows.length < PAGE) break
    }
    return out
  }

  async loadAll(workspaceId: string) {
    const data = emptyData()
    const results = await Promise.all(TABLES.map((t) => this.selectAll(t, workspaceId)))
    TABLES.forEach((t, i) => ((data[t] as unknown[]) = results[i]))
    data.analyses.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return data
  }

  private async upsertRows(table: string, rows: object[]) {
    for (let i = 0; i < rows.length; i += CHUNK) check(await this.sb.from(table).upsert(rows.slice(i, i + CHUNK)))
  }

  async upsert(_workspaceId: string, patch: DataPatch) {
    // Clients first so foreign keys resolve.
    const order: (keyof DataPatch)[] = ['clients', 'uploads', 'contracts', 'tickets', 'time_entries', 'billing_items', 'assets']
    for (const t of order) if (patch[t]?.length) await this.upsertRows(t, patch[t]!)
  }

  async clearAll(workspaceId: string) {
    // Children before parents.
    for (const t of ['actions', 'findings', 'reports', 'analyses', 'contracts', 'tickets', 'time_entries', 'billing_items', 'assets', 'uploads', 'clients'])
      check(await this.sb.from(t).delete().eq('workspace_id', workspaceId))
  }

  async saveAnalysis(workspaceId: string, analysis: WorkspaceData['analyses'][number], findings: WorkspaceData['findings']) {
    check(await this.sb.from('analyses').insert(analysis))
    await this.upsertRows('findings', findings)
    const keep = new Set(findings.map((f) => f.id))
    const existing = check(await this.sb.from('findings').select('id').eq('workspace_id', workspaceId)) as { id: string }[]
    const stale = existing.filter((f) => !keep.has(f.id)).map((f) => f.id)
    for (let i = 0; i < stale.length; i += CHUNK) check(await this.sb.from('findings').delete().in('id', stale.slice(i, i + CHUNK)))
  }

  async updateFinding(_workspaceId: string, id: string, patch: Partial<WorkspaceData['findings'][number]>) {
    check(await this.sb.from('findings').update(patch).eq('id', id))
  }

  async saveAction(_workspaceId: string, action: WorkspaceData['actions'][number]) {
    check(await this.sb.from('actions').upsert(action))
  }

  async saveReport(_workspaceId: string, report: WorkspaceData['reports'][number]) {
    check(await this.sb.from('reports').upsert(report))
  }

  async storeFile(workspaceId: string, file: File) {
    const path = `${workspaceId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`
    check(await this.sb.storage.from('uploads').upload(path, file, { upsert: false }))
    return path
  }

  // Server-side AI review (Edge Function holds the API key).
  async aiReview(findingId: string): Promise<string> {
    const { data, error } = await this.sb.functions.invoke('ai-review', { body: { finding_id: findingId } })
    if (error) {
      // Edge Function errors carry the function's JSON body in error.context.
      const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
      throw new Error(friendly(body?.error ?? error.message))
    }
    return (data as { explanation: string }).explanation
  }
}
