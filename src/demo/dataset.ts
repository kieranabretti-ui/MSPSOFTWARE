import { DEFAULT_SETTINGS, type Contract, type Dataset } from '../engine/types'
import { importRows, KIND_ORDER, type CsvKind, uuid, clientKey } from '../data/importers'
import { generateDemo, type DemoRaw } from './generate'

const RAW_KEY: Record<CsvKind, keyof Omit<DemoRaw, 'contracts'>> = {
  clients: 'clients',
  tickets: 'tickets',
  time_entries: 'time_entries',
  assets: 'assets',
  billing: 'billing',
}

export function buildDemoDataset(workspaceId: string): Dataset {
  const raw = generateDemo()
  const ds: Dataset = { settings: { ...DEFAULT_SETTINGS }, clients: [], contracts: [], tickets: [], time_entries: [], billing_items: [], assets: [] }
  for (const kind of KIND_ORDER) {
    const res = importRows(kind, raw[RAW_KEY[kind]], { workspaceId, clients: ds.clients })
    if (res.errors.length) throw new Error(`Demo ${kind}: ${res.errors[0].message} (row ${res.errors[0].row})`)
    const ids = new Set(res.clients.map((c) => c.id))
    ds.clients = [...ds.clients.filter((c) => !ids.has(c.id)), ...res.clients]
    ds.tickets.push(...res.tickets)
    ds.time_entries.push(...res.time_entries)
    ds.assets.push(...res.assets)
    ds.billing_items.push(...res.billing_items)
  }
  const byKey = new Map(ds.clients.map((c) => [clientKey(c.name), c]))
  ds.contracts = raw.contracts.map(
    (c): Contract => ({ id: uuid(), workspace_id: workspaceId, client_id: byKey.get(clientKey(c.client))!.id, title: c.title, text: c.text, upload_id: null, created_at: new Date().toISOString() }),
  )
  return ds
}
