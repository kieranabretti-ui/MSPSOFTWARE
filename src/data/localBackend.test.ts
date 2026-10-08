import { beforeEach, describe, expect, it } from 'vitest'
import type { Analysis, Client, Finding, Ticket, Upload } from '../engine/types'
import { auditEvent } from '../lib/audit'
import { LocalBackend } from './localBackend'

// No localStorage under vitest's node environment, so the backend falls back
// to its in-memory store, shared across instances in this module.

const client = (id: string, upload: string | null): Client => ({
  id,
  workspace_id: 'ws',
  name: id,
  monthly_recurring_revenue: 0,
  contracted_users: null,
  contracted_devices: null,
  package: null,
  contract_start: null,
  contract_end: null,
  included_hours: null,
  monthly_software_cost: null,
  created_at: '',
  source: upload ? { upload_id: upload, file_name: `${upload}.csv`, row: 2 } : null,
})
const ticket = (id: string, clientId: string, upload: string): Ticket => ({
  id,
  workspace_id: 'ws',
  client_id: clientId,
  external_id: id,
  date: '2026-09-01T09:00:00',
  technician: null,
  subject: 's',
  description: null,
  status: null,
  time_spent_minutes: 30,
  billable: false,
  source: { upload_id: upload, file_name: `${upload}.csv`, row: 2 },
})
const upload = (id: string, kind: Upload['kind']): Upload => ({ id, workspace_id: 'ws', kind, file_name: `${id}.csv`, row_count: 1, status: 'imported', storage_path: null, mapping: null, warnings: [], created_at: '' })
const finding = (id: string, clientId: string, over: Partial<Finding> = {}): Finding => ({
  id,
  workspace_id: 'ws',
  analysis_id: 'an1',
  finding_key: id,
  client_id: clientId,
  category: 'OTHER',
  severity: 'LOW',
  confidence: 50,
  title: '',
  description: '',
  evidence: [],
  estimated_value: 1,
  monthly_value: 0,
  annual_value: 0,
  recommended_action: '',
  source_data: [],
  meta: { rule: 'x', period_values: {} },
  status: 'open',
  ai_explanation: null,
  created_at: '',
  updated_at: '',
  ...over,
})
const analysis = (id: string): Analysis => ({ id, workspace_id: 'ws', period_start: '', period_end: '', summary: {} as Analysis['summary'], created_at: '' })

describe('LocalBackend', () => {
  let b: LocalBackend
  let ws: string
  beforeEach(async () => {
    b = new LocalBackend()
    const { user } = await b.signUp(`u${Math.random()}@test.example`, 'pw', 'U')
    ws = (await b.createWorkspace(user!, 'W')).id
  })

  it('deletes an upload and the rows it produced, keeping clients that still have data', async () => {
    await b.upsert(ws, {
      clients: [client('c-from-clients', 'up-clients'), client('c-from-tickets', 'up-tickets'), client('c-other', 'up-clients')],
      tickets: [ticket('t1', 'c-from-clients', 'up-tickets'), ticket('t2', 'c-from-tickets', 'up-tickets'), ticket('t3', 'c-other', 'up-other')],
      uploads: [upload('up-clients', 'clients'), upload('up-tickets', 'tickets')],
    })
    await b.saveAnalysis(ws, analysis('an1'), [finding('f1', 'c-from-tickets'), finding('f2', 'c-other')])
    const res = await b.deleteUpload(ws, 'up-tickets')
    expect(res).toMatchObject({ tickets: 2, clients: 1, clients_kept: 0 })
    let d = await b.loadAll(ws)
    expect(d.tickets.map((t) => t.id)).toEqual(['t3'])
    expect(d.clients.map((c) => c.id).sort()).toEqual(['c-from-clients', 'c-other'])
    expect(d.findings.map((f) => f.id)).toEqual(['f2']) // went with its client
    expect(d.uploads.map((u) => u.id)).toEqual(['up-clients'])

    // c-other still has a ticket from another file, so it stays without provenance
    const res2 = await b.deleteUpload(ws, 'up-clients')
    expect(res2).toMatchObject({ clients: 1, clients_kept: 1 })
    d = await b.loadAll(ws)
    expect(d.clients).toHaveLength(1)
    expect(d.clients[0]).toMatchObject({ id: 'c-other', source: null })
  })

  it('splits stale findings out on load and writes only decision fields', async () => {
    await b.upsert(ws, { clients: [client('c1', null)] })
    await b.saveAnalysis(ws, analysis('an1'), [finding('live', 'c1'), finding('old', 'c1', { stale: true, status: 'valid' })])
    await b.updateFinding(ws, 'live', { status: 'dismissed', dismiss_reason: 'data_wrong', estimated_value: 999 })
    const d = await b.loadAll(ws)
    expect(d.findings.map((f) => f.id)).toEqual(['live'])
    expect(d.stale_findings.map((f) => f.id)).toEqual(['old'])
    expect(d.findings[0]).toMatchObject({ status: 'dismissed', dismiss_reason: 'data_wrong', estimated_value: 1 })
  })

  it('deletes one analysis with its findings and reports', async () => {
    await b.upsert(ws, { clients: [client('c1', null)] })
    await b.saveAnalysis(ws, analysis('an1'), [finding('f1', 'c1')])
    await b.saveReport(ws, { id: 'r1', workspace_id: ws, analysis_id: 'an1', title: '', period_label: '', created_at: '' })
    await b.saveAction(ws, { id: 'a1', workspace_id: ws, finding_id: 'f1', client_id: 'c1', title: '', notes: null, status: 'open', value: 0, created_at: '', updated_at: '' })
    await b.deleteAnalysis(ws, 'an1')
    const d = await b.loadAll(ws)
    expect(d.analyses).toEqual([])
    expect(d.findings).toEqual([])
    expect(d.reports).toEqual([])
    expect(d.actions[0].finding_id).toBeNull()
    expect(d.clients).toHaveLength(1)
  })

  it('keeps the audit log, newest first, when data is cleared', async () => {
    await b.logEvent(ws, auditEvent(ws, { id: 'u', email: null }, 'upload.created', null, { kind: 'tickets', rows: 1 }))
    await b.logEvent(ws, auditEvent(ws, { id: 'u', email: null }, 'analysis.run', null, { findings: 0 }))
    await b.upsert(ws, { clients: [client('c1', null)] })
    await b.clearAll(ws)
    const d = await b.loadAll(ws)
    expect(d.clients).toEqual([])
    expect(d.audit_log.map((e) => e.action)).toEqual(['analysis.run', 'upload.created'])
  })

  it('forgets a user: account, workspace and data leave this browser', async () => {
    const me = (await b.getSession())!
    await b.upsert(ws, { clients: [client('c1', null)] })
    await b.deleteAccount()
    expect(await b.getSession()).toBeNull()
    expect(await b.getWorkspace(me)).toBeNull()
    await expect(b.signIn(me.email, 'pw')).rejects.toThrow()
    expect((await new LocalBackend().loadAll(ws)).clients).toEqual([])
  })
})
