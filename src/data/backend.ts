import type {
  Action,
  Analysis,
  Asset,
  AuditEvent,
  BillingItem,
  Client,
  Contract,
  Finding,
  Report,
  Ticket,
  TimeEntry,
  Upload,
  Workspace,
} from '../engine/types'

export interface SessionUser {
  id: string
  email: string
  name: string
}

export interface WorkspaceData {
  clients: Client[]
  contracts: Contract[]
  tickets: Ticket[]
  time_entries: TimeEntry[]
  billing_items: BillingItem[]
  assets: Asset[]
  uploads: Upload[]
  analyses: Analysis[]
  findings: Finding[]
  actions: Action[]
  reports: Report[]
  // Findings a later analysis no longer reproduces but a person decided on
  // (moved off New, or gave a note or owner). Kept apart from `findings` so
  // nothing counts them by accident; shown as history.
  stale_findings: Finding[]
  // Append-only activity record, newest first. Ids, counts and stage names
  // only, never client data values.
  audit_log: AuditEvent[]
}

export const emptyData = (): WorkspaceData => ({
  clients: [],
  contracts: [],
  tickets: [],
  time_entries: [],
  billing_items: [],
  assets: [],
  uploads: [],
  analyses: [],
  findings: [],
  actions: [],
  reports: [],
  stale_findings: [],
  audit_log: [],
})

// Backends store live and stale findings in one table; the app sees them apart.
export function splitStale(data: WorkspaceData): WorkspaceData {
  const all = [...data.findings, ...data.stale_findings]
  return { ...data, findings: all.filter((f) => !f.stale), stale_findings: all.filter((f) => !!f.stale) }
}

// The finding columns a person may change. Everything else on a finding is the
// engine's output and only changes when an analysis is saved.
export const DECISION_FIELDS = ['status', 'dismiss_reason', 'decision_note', 'owner', 'decided_at', 'first_viewed_at', 'updated_at'] as const
export type FindingDecisionPatch = Partial<Pick<Finding, (typeof DECISION_FIELDS)[number]>>

export const pickDecision = (patch: Partial<Finding>): FindingDecisionPatch => {
  const out: Record<string, unknown> = {}
  for (const k of DECISION_FIELDS) if (k in patch) out[k] = patch[k]
  return out as FindingDecisionPatch
}

// What deleting one upload removed.
export interface UploadDeletion {
  tickets: number
  time_entries: number
  billing_items: number
  assets: number
  contracts: number
  clients: number
  // clients the file created that still have other data, so they were kept
  clients_kept: number
}

export type DataTable = keyof WorkspaceData

// Rows to add to a workspace in one go (an import, a contract upload, the demo).
export type DataPatch = Partial<Pick<WorkspaceData, 'clients' | 'contracts' | 'tickets' | 'time_entries' | 'billing_items' | 'assets' | 'uploads'>>

export interface SignUpResult {
  user: SessionUser | null
  needsConfirmation: boolean
}

export interface Backend {
  mode: 'local' | 'supabase'
  supportsMagicLink: boolean

  getSession(): Promise<SessionUser | null>
  // planInterest: the paid plan a pricing button carried to sign-up, kept with the account so it can be followed up.
  signUp(email: string, password: string, name: string, planInterest?: string): Promise<SignUpResult>
  signIn(email: string, password: string): Promise<SessionUser>
  sendMagicLink(email: string): Promise<void>
  signOut(): Promise<void>
  onAuthChange(cb: (user: SessionUser | null) => void): () => void

  getWorkspace(user: SessionUser): Promise<Workspace | null>
  createWorkspace(user: SessionUser, name: string, isDemo?: boolean): Promise<Workspace>
  updateWorkspace(ws: Workspace): Promise<void>

  loadAll(workspaceId: string): Promise<WorkspaceData>
  // Upserts every row by id.
  upsert(workspaceId: string, patch: DataPatch): Promise<void>
  // Removes every data row in the workspace and any stored files. Keeps the
  // workspace, its settings and the audit log. Hosted mode logs data.cleared
  // server-side.
  clearAll(workspaceId: string): Promise<void>
  // Stores the latest analysis. `findings` is the complete set to keep (live
  // and stale); any other finding row is removed.
  saveAnalysis(workspaceId: string, analysis: Analysis, findings: Finding[]): Promise<void>
  // Only the decision fields (DECISION_FIELDS) are written.
  updateFinding(workspaceId: string, id: string, patch: Partial<Finding>): Promise<void>
  // Appends to the audit log. The hosted backend stamps actor and time itself.
  logEvent(workspaceId: string, event: AuditEvent): Promise<void>
  // Deletes one upload, the rows it produced and its stored file. Hosted mode
  // logs upload.deleted server-side.
  deleteUpload(workspaceId: string, uploadId: string): Promise<UploadDeletion>
  // Deletes one analysis, its findings and its reports. Source data stays.
  deleteAnalysis(workspaceId: string, analysisId: string): Promise<void>
  // Deletes the workspace and everything in it, stored files included.
  deleteWorkspace(workspaceId: string): Promise<void>
  // Deletes the signed-in user's account, their workspaces and files, then signs out.
  deleteAccount(): Promise<void>
  // Removes this browser's copy of a user's data (local mode only).
  forgetLocalUser?(userId: string): Promise<void>
  saveAction(workspaceId: string, action: Action): Promise<void>
  saveReport(workspaceId: string, report: Report): Promise<void>
  // Stores an original file privately. Returns a storage path, or null when
  // the backend keeps only extracted content (local mode).
  storeFile(workspaceId: string, file: File): Promise<string | null>
  // Server-side AI explanation of one finding. Only the hosted backend has it.
  aiReview?(findingId: string): Promise<string>
}
