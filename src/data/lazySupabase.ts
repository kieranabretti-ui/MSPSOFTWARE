import type { Analysis, Action, Finding, Report, Workspace } from '../engine/types'
import type { Backend, DataPatch, SessionUser } from './backend'
import type { SupabaseBackend } from './supabaseBackend'

// Whether this browser could already hold a Supabase session: a stored auth
// token, or a sign-in link or confirmation landing with its tokens in the
// address. Pure, so it can be tested without a browser.
export function mightHaveSession(storageKeys: string[], hash: string, search: string): boolean {
  return storageKeys.some((k) => /^sb-.+-auth-token$/.test(k)) || /(?:^|[#&])(access_token|refresh_token|error_description)=/.test(hash) || /[?&](code|token_hash)=/.test(search)
}

function browserMightHaveSession(): boolean {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i) ?? '')
    return mightHaveSession(keys, location.hash, location.search)
  } catch {
    return true // storage blocked: ask Supabase rather than guess
  }
}

// The hosted backend, loaded on first use. supabase-js is the largest
// dependency, so it stays out of the entry chunk, and a visitor with no
// session (the landing page's usual reader) never downloads it: the session
// check answers "nobody" without loading it, and listeners wait for the
// module to arrive for another reason. Every method waits for the module
// once, then delegates.
export class LazySupabaseBackend implements Backend {
  mode = 'supabase' as const
  supportsMagicLink = true
  private real: Promise<SupabaseBackend> | null = null
  private listeners = new Set<(b: SupabaseBackend) => void>()

  constructor(
    private url: string,
    private anonKey: string,
  ) {}

  private load(): Promise<SupabaseBackend> {
    if (!this.real) {
      this.real = import('./supabaseBackend').then(
        (m) => new m.SupabaseBackend(this.url, this.anonKey),
        (e) => {
          this.real = null // a failed chunk load can be retried
          throw e
        },
      )
      this.real.then((b) => this.listeners.forEach((fn) => fn(b)), () => undefined)
    }
    return this.real
  }

  getSession() {
    // No stored session and no sign-in link: nobody is signed in, and there is
    // no reason to download supabase-js to be told so.
    if (!this.real && !browserMightHaveSession()) return Promise.resolve(null)
    return this.load().then((b) => b.getSession())
  }
  signUp(email: string, password: string, name: string, planInterest?: string) {
    return this.load().then((b) => b.signUp(email, password, name, planInterest))
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

  // Subscribes once the module is loaded, without loading it: a sign-in,
  // sign-up or stored session brings it in. The returned function works either
  // side of that: before, it stops the subscription from ever starting.
  onAuthChange(cb: (user: SessionUser | null) => void) {
    let off: (() => void) | null = null
    let stopped = false
    const attach = (b: SupabaseBackend) => {
      if (!stopped && !off) off = b.onAuthChange(cb)
    }
    if (this.real) this.real.then(attach, () => undefined)
    else this.listeners.add(attach)
    return () => {
      stopped = true
      this.listeners.delete(attach)
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
