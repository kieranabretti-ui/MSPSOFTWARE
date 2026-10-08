// Supabase backend. Tables and RLS policies live in supabase/migrations; every
// row carries workspace_id and policies restrict access to workspace members.
// Loaded on demand through lazySupabase.ts, so supabase-js stays out of the
// entry chunk.
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { DEFAULT_SETTINGS, type Workspace } from '../engine/types'
import { AppError, GENERIC_ERROR, knownError } from '../lib/errors'
import { emptyData, pickDecision, splitStale, type Backend, type DataPatch, type SessionUser, type UploadDeletion, type WorkspaceData } from './backend'

const TABLES = ['clients', 'contracts', 'tickets', 'time_entries', 'billing_items', 'assets', 'uploads', 'analyses', 'findings', 'actions', 'reports'] as const
// The newest audit events loaded with the workspace.
const AUDIT_LOAD = 1000
const CHUNK = 500
const PAGE = 1000

const toSession = (u: User): SessionUser => ({ id: u.id, email: u.email ?? '', name: (u.user_metadata?.name as string) || (u.email ?? '').split('@')[0] })

const FILE_PAGE = 100

// The database schema this build needs. The hosted service's published
// controls (composite tenant keys, append-only audit log, server-written AI
// text, AI rate limits, deletion functions, storage limits) come from
// migrations 20261008000000 and 20261008000100. If the project hasn't had
// them applied, this build refuses to open a workspace rather than run with
// controls the Trust Centre describes but the database doesn't have.
export const REQUIRED_SCHEMA = '20261008000100'
export const SCHEMA_NOT_READY = 'Headroom is being updated and your workspace is not available just now. Nothing has been changed. Please try again later.'

type RawError = { message: string; code?: string | number; status?: number }

// Every failure leaves as an AppError: a message that's safe to show, with the
// raw code and text kept aside for mapError and the console.
function fail(error: RawError, status?: number): AppError {
  const code = error.code == null ? undefined : String(error.code)
  const st = error.status ?? status
  return new AppError(knownError({ code, status: st, message: error.message }) ?? GENERIC_ERROR, { code, status: st, detail: error.message })
}

function check<T>(res: { data: T; error: RawError | null; status?: number }): T {
  if (res.error) throw fail(res.error, res.status)
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

  async signUp(email: string, password: string, name: string, planInterest?: string) {
    const data = check(await this.sb.auth.signUp({ email, password, options: { data: { name, ...(planInterest ? { plan_interest: planInterest } : {}) }, emailRedirectTo: `${location.origin}/app` } }))
    return { user: data.session?.user ? toSession(data.session.user) : null, needsConfirmation: !data.session }
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password })
    if (error) throw fail(error)
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

  private schemaChecked: Promise<void> | null = null
  private ensureSchema(): Promise<void> {
    this.schemaChecked ??= (async () => {
      const { data, error } = await this.sb.rpc('schema_version')
      if (error || typeof data !== 'string' || data < REQUIRED_SCHEMA) {
        this.schemaChecked = null
        throw new AppError(SCHEMA_NOT_READY, { code: 'schema_not_ready', detail: error?.message ?? `schema ${String(data)}` })
      }
    })()
    return this.schemaChecked
  }

  async getWorkspace(user: SessionUser) {
    await this.ensureSchema()
    const rows = check(await this.sb.from('workspace_members').select('workspace:workspaces(*)').eq('user_id', user.id).limit(1))
    const ws = (rows?.[0] as unknown as { workspace: Workspace } | undefined)?.workspace
    return ws ? { ...ws, settings: { ...DEFAULT_SETTINGS, ...ws.settings } } : null
  }

  async createWorkspace(user: SessionUser, name: string, isDemo = false) {
    // Security-definer function creates the workspace and the membership row.
    const res = await this.sb.rpc('create_workspace', { ws_name: name, ws_settings: DEFAULT_SETTINGS, ws_is_demo: isDemo })
    // One workspace per user (migration 20261008000100): a second call, such as
    // a double-submitted form, gets 23505; use the workspace that already exists.
    if (res.error && String(res.error.code) === '23505') {
      const existing = await this.getWorkspace(user)
      if (existing) return existing
    }
    const id = check(res) as string
    const ws = check(await this.sb.from('workspaces').select('*').eq('id', id).single()) as Workspace
    return ws
  }

  async updateWorkspace(ws: Workspace) {
    check(await this.sb.from('workspaces').update({ name: ws.name, settings: ws.settings }).eq('id', ws.id))
  }

  private async selectAll(table: string, workspaceId: string, columns = '*') {
    const out: unknown[] = []
    for (let from = 0; ; from += PAGE) {
      const rows = check(await this.sb.from(table).select(columns).eq('workspace_id', workspaceId).range(from, from + PAGE - 1))
      out.push(...(rows ?? []))
      if (!rows || rows.length < PAGE) break
    }
    return out
  }

  async loadAll(workspaceId: string) {
    const data = emptyData()
    const [results, audit] = await Promise.all([
      Promise.all(TABLES.map((t) => this.selectAll(t, workspaceId))),
      this.sb.from('audit_log').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(AUDIT_LOAD),
    ])
    TABLES.forEach((t, i) => ((data[t] as unknown[]) = results[i]))
    data.audit_log = check(audit) ?? []
    data.analyses.sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    return splitStale(data)
  }

  private async upsertRows(table: string, rows: object[]) {
    for (let i = 0; i < rows.length; i += CHUNK) check(await this.sb.from(table).upsert(rows.slice(i, i + CHUNK)))
  }

  async upsert(_workspaceId: string, patch: DataPatch) {
    // Clients first so foreign keys resolve.
    const order: (keyof DataPatch)[] = ['clients', 'uploads', 'contracts', 'tickets', 'time_entries', 'billing_items', 'assets']
    for (const t of order) if (patch[t]?.length) await this.upsertRows(t, patch[t]!)
  }

  // Every stored file under the workspace's folder, including any a failed
  // save left behind with no upload row pointing at it.
  private async removeAllFiles(workspaceId: string) {
    const bucket = this.sb.storage.from('uploads')
    const paths: string[] = []
    for (let offset = 0; ; offset += FILE_PAGE) {
      const files = check(await bucket.list(workspaceId, { limit: FILE_PAGE, offset })) ?? []
      paths.push(...files.map((f) => `${workspaceId}/${f.name}`))
      if (files.length < FILE_PAGE) break
    }
    await this.removeFiles(paths)
  }

  private async removeFiles(paths: string[]) {
    const bucket = this.sb.storage.from('uploads')
    for (let i = 0; i < paths.length; i += FILE_PAGE) check(await bucket.remove(paths.slice(i, i + FILE_PAGE)))
  }

  async clearAll(workspaceId: string) {
    // Stored files first, so nothing is left behind in storage if this fails
    // part way. The rows go in one transaction, which also logs data.cleared.
    await this.removeAllFiles(workspaceId)
    check(await this.sb.rpc('clear_workspace_data', { ws: workspaceId }))
  }

  async saveAnalysis(workspaceId: string, analysis: WorkspaceData['analyses'][number], findings: WorkspaceData['findings']) {
    check(await this.sb.from('analyses').insert(analysis))
    // AI columns are written by the ai-review function only, so they're left
    // out of the upsert and keep their stored values.
    await this.upsertRows(
      'findings',
      findings.map(({ ai_explanation: _a, ai_meta: _m, ...f }) => f),
    )
    const keep = new Set(findings.map((f) => f.id))
    const existing = (await this.selectAll('findings', workspaceId, 'id')) as { id: string }[]
    const gone = existing.filter((f) => !keep.has(f.id)).map((f) => f.id)
    for (let i = 0; i < gone.length; i += CHUNK) check(await this.sb.from('findings').delete().in('id', gone.slice(i, i + CHUNK)))
  }

  async updateFinding(_workspaceId: string, id: string, patch: Partial<WorkspaceData['findings'][number]>) {
    check(await this.sb.from('findings').update(pickDecision(patch)).eq('id', id))
  }

  async logEvent(_workspaceId: string, event: WorkspaceData['audit_log'][number]) {
    // created_at and actor_id are set by the database.
    const { created_at: _c, ...row } = event
    check(await this.sb.from('audit_log').insert(row))
  }

  async deleteUpload(_workspaceId: string, uploadId: string): Promise<UploadDeletion> {
    const path = check(await this.sb.rpc('delete_upload', { p_upload_id: uploadId })) as string | null
    if (path) await this.removeFiles([path])
    // The RPC logs the counts; read them back from its audit row.
    const rows = check(await this.sb.from('audit_log').select('detail').eq('action', 'upload.deleted').eq('target_id', uploadId).order('created_at', { ascending: false }).limit(1))
    const d = ((rows?.[0] as { detail?: Record<string, number> } | undefined)?.detail ?? {}) as Partial<UploadDeletion>
    return { tickets: d.tickets ?? 0, time_entries: d.time_entries ?? 0, billing_items: d.billing_items ?? 0, assets: d.assets ?? 0, contracts: d.contracts ?? 0, clients: d.clients ?? 0, clients_kept: d.clients_kept ?? 0 }
  }

  async deleteAnalysis(_workspaceId: string, analysisId: string) {
    check(await this.sb.rpc('delete_analysis', { p_analysis_id: analysisId }))
  }

  async deleteWorkspace(workspaceId: string) {
    await this.removeAllFiles(workspaceId)
    check(await this.sb.rpc('delete_workspace', { ws: workspaceId }))
  }

  // Files first (Storage objects can't be removed from SQL), then the account
  // and every workspace it owns in one call, then the local session.
  async deleteAccount() {
    const { data } = await this.sb.auth.getUser()
    const uid = data.user?.id
    if (!uid) throw new AppError('Sign in to delete your account.', { code: 'not_signed_in' })
    const owned = check(await this.sb.from('workspace_members').select('workspace_id').eq('user_id', uid).eq('role', 'owner')) as { workspace_id: string }[]
    for (const m of owned ?? []) await this.removeAllFiles(m.workspace_id)
    check(await this.sb.rpc('delete_my_account'))
    await this.sb.auth.signOut({ scope: 'local' })
  }

  async saveAction(_workspaceId: string, action: WorkspaceData['actions'][number]) {
    check(await this.sb.from('actions').upsert(action))
  }

  async saveReport(_workspaceId: string, report: WorkspaceData['reports'][number]) {
    check(await this.sb.from('reports').upsert(report))
  }

  async storeFile(workspaceId: string, file: File) {
    const path = `${workspaceId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, '_')}`
    // The bucket accepts only PDF and plain text (migration 20261008000100).
    const contentType = file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? 'application/pdf' : 'text/plain'
    check(await this.sb.storage.from('uploads').upload(path, file, { upsert: false, contentType }))
    return path
  }

  // Server-side AI review (Edge Function holds the API key). The function
  // stores the explanation and its ai_meta {model, generated_at,
  // evidence_hash} itself; the store reads both back afterwards
  // (setFindingExplanation).
  async aiReview(findingId: string): Promise<string> {
    const { data, error } = await this.sb.functions.invoke('ai-review', { body: { finding_id: findingId } })
    if (error) {
      // Edge Function errors carry the function's JSON body in error.context.
      const context = (error as { context?: Response }).context
      const status = context?.status
      const body = (await context?.json?.().catch(() => null)) as { error?: unknown } | null
      const message = typeof body?.error === 'string' ? body.error : null
      // Limits (429) and failed output checks (422) come with a fixed message
      // from the function that says what happened; show it as written rather
      // than the generic "too many attempts". Sign-in and access failures
      // keep the shared messages.
      if (message && status !== 401 && status !== 403) throw new AppError(message, { code: `ai_review_${status ?? 'error'}`, detail: error.message })
      throw fail({ message: message ?? error.message, status })
    }
    return (data as { explanation: string }).explanation
  }
}
