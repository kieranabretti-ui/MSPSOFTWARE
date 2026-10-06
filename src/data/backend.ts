import type {
  Action,
  Analysis,
  Asset,
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
})

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
  signUp(email: string, password: string, name: string): Promise<SignUpResult>
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
  // Removes every data row in the workspace (keeps the workspace itself).
  clearAll(workspaceId: string): Promise<void>
  // Stores the latest analysis; findings are upserted by id and stale ones removed.
  saveAnalysis(workspaceId: string, analysis: Analysis, findings: Finding[]): Promise<void>
  updateFinding(workspaceId: string, id: string, patch: Partial<Finding>): Promise<void>
  saveAction(workspaceId: string, action: Action): Promise<void>
  saveReport(workspaceId: string, report: Report): Promise<void>
  // Stores an original file privately. Returns a storage path, or null when
  // the backend keeps only extracted content (local mode).
  storeFile(workspaceId: string, file: File): Promise<string | null>
}
