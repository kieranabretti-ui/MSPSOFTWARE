import type { Analysis, Action, Finding, Report, Workspace } from '../engine/types'
import type { Backend, DataPatch, SessionUser } from './backend'
import type { SupabaseBackend } from './supabaseBackend'

// The hosted backend, loaded on first use. supabase-js is the largest
// dependency, so it stays out of the entry chunk and the landing page never
// downloads it. Every method waits for the module once, then delegates.
export class LazySupabaseBackend implements Backend {
  mode = 'supabase' as const
  supportsMagicLink = true
  private real: Promise<SupabaseBackend> | null = null

  constructor(
    private url: string,
    private anonKey: string,
  ) {}

  private load(): Promise<SupabaseBackend> {
    if (!this.real)
      this.real = import('./supabaseBackend').then(
        (m) => new m.SupabaseBackend(this.url, this.anonKey),
        (e) => {
          this.real = null // a failed chunk load can be retried
          throw e
        },
      )
    return this.real
  }

  getSession() {
    return this.load().then((b) => b.getSession())
  }
  signUp(email: string, password: string, name: string) {
    return this.load().then((b) => b.signUp(email, password, name))
  }
  signIn(email: string, password: string) {
    return this.load().then((b) => b.signIn(email, password))
  }
  sendMagicLink(email: string) {
    return this.load().then((b) => b.sendMagicLink(email))
  }
  signOut() {
    return this.load().then((b) => b.signOut())
  }

  // Subscribes once the module is loaded. The returned function works either
  // side of that: before, it stops the subscription from ever starting.
  onAuthChange(cb: (user: SessionUser | null) => void) {
    let off: (() => void) | null = null
    let stopped = false
    this.load().then(
      (b) => {
        if (!stopped) off = b.onAuthChange(cb)
      },
      () => undefined,
    )
    return () => {
      stopped = true
      off?.()
    }
  }

  getWorkspace(user: SessionUser) {
    return this.load().then((b) => b.getWorkspace(user))
  }
  createWorkspace(user: SessionUser, name: string, isDemo?: boolean) {
    return this.load().then((b) => b.createWorkspace(user, name, isDemo))
  }
  updateWorkspace(ws: Workspace) {
    return this.load().then((b) => b.updateWorkspace(ws))
  }
  loadAll(workspaceId: string) {
    return this.load().then((b) => b.loadAll(workspaceId))
  }
  upsert(workspaceId: string, patch: DataPatch) {
    return this.load().then((b) => b.upsert(workspaceId, patch))
  }
  clearAll(workspaceId: string) {
    return this.load().then((b) => b.clearAll(workspaceId))
  }
  saveAnalysis(workspaceId: string, analysis: Analysis, findings: Finding[]) {
    return this.load().then((b) => b.saveAnalysis(workspaceId, analysis, findings))
  }
  updateFinding(workspaceId: string, id: string, patch: Partial<Finding>) {
    return this.load().then((b) => b.updateFinding(workspaceId, id, patch))
  }
  saveAction(workspaceId: string, action: Action) {
    return this.load().then((b) => b.saveAction(workspaceId, action))
  }
  saveReport(workspaceId: string, report: Report) {
    return this.load().then((b) => b.saveReport(workspaceId, report))
  }
  storeFile(workspaceId: string, file: File) {
    return this.load().then((b) => b.storeFile(workspaceId, file))
  }
  aiReview(findingId: string) {
    return this.load().then((b) => b.aiReview(findingId))
  }
}
