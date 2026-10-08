import { DEFAULT_SETTINGS, type Contract, type Dataset } from '../engine/types'
import { importRows, KIND_ORDER, type CsvKind, type ImportContext, uuid, clientKey } from '../data/importers'
import { generateDemo, type DemoRaw } from './generate'

const RAW_KEY: Record<CsvKind, keyof Omit<DemoRaw, 'contracts'>> = {
  clients: 'clients',
  tickets: 'tickets',
  time_entries: 'time_entries',
  assets: 'assets',
  billing: 'billing',
}

// The upload each demo file is recorded as, so demo rows trace back to a file
// like real imports do. Optional: the engine tests don't need it.
export type DemoUploads = Partial<Record<CsvKind | 'contract', { id: string; file_name: string }>>

export function buildDemoDataset(workspaceId: string, uploads: DemoUploads = {}): Dataset {
  const raw = generateDemo()
  const ds: Dataset = { settings: { ...DEFAULT_SETTINGS }, clients: [], contracts: [], tickets: [], time_entries: [], billing_items: [], assets: [] }
  for (const kind of KIND_ORDER) {
    const up = uploads[kind]
    const ctx: ImportContext = { workspaceId, clients: ds.clients, ...(up ? { upload_id: up.id, file_name: up.file_name } : {}) }
    const res = importRows(kind, raw[RAW_KEY[kind]], ctx)
    if (res.errors.length) throw new Error(`Demo ${kind}: ${res.errors[0].message} (row ${res.errors[0].row})`)
    // Every row this file wrote names it, with its row when the importer gives one.
    const stamp = <T extends { source?: { upload_id: string | null } | null }>(r: T): T =>
      !up || r.source?.upload_id === up.id ? r : { ...r, source: { upload_id: up.id, file_name: up.file_name, row: null } }
    const ids = new Set(res.clients.map((c) => c.id))
    ds.clients = [...ds.clients.filter((c) => !ids.has(c.id)), ...res.clients.map(stamp)]
    ds.tickets.push(...res.tickets.map(stamp))
    ds.time_entries.push(...res.time_entries.map(stamp))
    ds.assets.push(...res.assets.map(stamp))
    ds.billing_items.push(...res.billing_items.map(stamp))
  }
  const byKey = new Map(ds.clients.map((c) => [clientKey(c.name), c]))
  ds.contracts = raw.contracts.map(
    (c): Contract => ({ id: uuid(), workspace_id: workspaceId, client_id: byKey.get(clientKey(c.client))!.id, title: c.title, text: c.text, upload_id: uploads.contract?.id ?? null, created_at: new Date().toISOString() }),
  )
  return ds
}
