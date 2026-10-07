import type { Asset, BillingItem, Client, Ticket, TimeEntry } from '../engine/types'

export type CsvKind = 'clients' | 'tickets' | 'time_entries' | 'assets' | 'billing'
type FieldType = 'string' | 'number' | 'date' | 'datetime' | 'boolean'

export interface FieldDef {
  key: string
  label: string
  required: boolean
  type: FieldType
  aliases: string[]
  help?: string
}

export interface CsvSchema {
  kind: CsvKind
  title: string
  description: string
  fields: FieldDef[]
}

const f = (key: string, label: string, type: FieldType, required: boolean, aliases: string[] = [], help?: string): FieldDef => ({ key, label, type, required, aliases, help })

export const SCHEMAS: Record<CsvKind, CsvSchema> = {
  clients: {
    kind: 'clients',
    title: 'Clients',
    description: 'One row per client with their agreement: what they pay each month and how many users and devices it covers.',
    fields: [
      f('client', 'Client name', 'string', true, ['company', 'client name', 'customer', 'account', 'organisation', 'organization', 'company name']),
      f('monthly_recurring_revenue', 'Monthly recurring revenue', 'number', true, ['mrr', 'monthly value', 'monthly fee', 'recurring revenue', 'contract value', 'monthly charge']),
      f('contracted_users', 'Contracted users', 'number', false, ['users', 'seats', 'licensed users', 'user count']),
      f('contracted_devices', 'Contracted devices', 'number', false, ['devices', 'endpoints', 'device count', 'machines']),
      f('package', 'Package / tier', 'string', false, ['plan', 'tier', 'agreement', 'agreement type', 'service level']),
      f('contract_start', 'Contract start', 'date', false, ['start date', 'start']),
      f('contract_end', 'Contract end', 'date', false, ['end date', 'renewal date', 'end']),
      f('included_hours', 'Included support hours / month', 'number', false, ['hours included', 'block hours', 'included hours'], 'Only for block-hours agreements.'),
      f('monthly_software_cost', 'Monthly software cost', 'number', false, ['software cost', 'licence cost', 'license cost', 'cost of sales'], 'Your cost for the tools and licences used for this client.'),
    ],
  },
  tickets: {
    kind: 'tickets',
    title: 'Tickets',
    description: 'Service desk tickets. Subject and description are used to spot out-of-scope and potentially billable work.',
    fields: [
      f('ticket_id', 'Ticket ID', 'string', true, ['id', 'ticket', 'ticket number', 'ticket #', 'ticket no', 'reference']),
      f('client', 'Client', 'string', true, ['company', 'customer', 'account', 'organisation', 'organization', 'company name']),
      f('date', 'Date', 'datetime', true, ['created', 'created date', 'date created', 'opened', 'date opened']),
      f('technician', 'Technician', 'string', false, ['tech', 'engineer', 'assigned to', 'owner', 'resource', 'agent']),
      f('subject', 'Subject', 'string', true, ['title', 'summary', 'issue']),
      f('description', 'Description', 'string', false, ['details', 'notes', 'body', 'resolution']),
      f('status', 'Status', 'string', false, ['state']),
      f('time_spent_minutes', 'Time spent (minutes)', 'number', false, ['minutes', 'time spent', 'duration', 'time', 'actual minutes'], 'Hours are fine too: values with "h" are converted.'),
      f('billable', 'Billable', 'boolean', false, ['is billable', 'chargeable', 'billable?']),
    ],
  },
  time_entries: {
    kind: 'time_entries',
    title: 'Time entries',
    description: 'Logged time. Used to measure support effort and to find non-billable time on billable work.',
    fields: [
      f('date', 'Date', 'datetime', true, ['date worked', 'start', 'start time', 'entry date']),
      f('client', 'Client', 'string', true, ['company', 'customer', 'account', 'company name']),
      f('technician', 'Technician', 'string', false, ['tech', 'engineer', 'member', 'resource', 'agent']),
      f('ticket_id', 'Ticket ID', 'string', false, ['ticket', 'ticket number', 'ticket #', 'charge to', 'reference']),
      f('minutes', 'Minutes', 'number', true, ['time', 'duration', 'actual minutes', 'hours', 'time spent'], 'Hours are fine too: values with "h" are converted.'),
      f('billable', 'Billable', 'boolean', false, ['is billable', 'chargeable', 'billable option']),
    ],
  },
  assets: {
    kind: 'assets',
    title: 'Users & devices',
    description: 'Users and devices you actually support, typically exported from your RMM or Microsoft 365. Compared against what each agreement covers.',
    fields: [
      f('client', 'Client', 'string', true, ['company', 'customer', 'site', 'organisation', 'organization']),
      f('type', 'Type (user / device)', 'string', true, ['asset type', 'kind', 'category']),
      f('name', 'Name', 'string', true, ['display name', 'hostname', 'device name', 'user', 'username', 'email']),
      f('ownership', 'Ownership', 'string', false, ['owner type', 'owned by']),
      f('license', 'Licence', 'string', false, ['licence', 'licenses', 'licences', 'sku', 'plan']),
      f('status', 'Status', 'string', false, ['state', 'enabled', 'active']),
      f('first_seen', 'First seen / created', 'date', false, ['created', 'created date', 'date added', 'enrolled', 'first seen date']),
    ],
  },
  billing: {
    kind: 'billing',
    title: 'Billing / agreements',
    description: 'Recurring charges per client as they appear on invoices or agreement additions.',
    fields: [
      f('client', 'Client', 'string', true, ['company', 'customer', 'account', 'company name']),
      f('service', 'Service / product', 'string', true, ['product', 'description', 'item', 'addition', 'line item']),
      f('quantity', 'Quantity', 'number', true, ['qty', 'units', 'count']),
      f('unit_price', 'Unit price', 'number', true, ['price', 'rate', 'unit cost', 'each']),
      f('monthly_value', 'Monthly value', 'number', false, ['total', 'line total', 'amount', 'extended price', 'monthly total']),
    ],
  },
}

export const KIND_ORDER: CsvKind[] = ['clients', 'tickets', 'time_entries', 'assets', 'billing']

const norm = (s: string) => s.toLowerCase().replace(/[_\-#?]+/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim()

export function autoMap(headers: string[], kind: CsvKind): Record<string, string> {
  const mapping: Record<string, string> = {}
  const taken = new Set<string>()
  for (const field of SCHEMAS[kind].fields) {
    const candidates = [field.key, field.label, ...field.aliases].map(norm)
    const hit = headers.find((h) => !taken.has(h) && candidates.includes(norm(h)))
    if (hit) {
      mapping[field.key] = hit
      taken.add(hit)
    }
  }
  return mapping
}

// Required fields no other export requires (minutes for time entries, the
// service and price for billing): the columns that tell one export from another.
const DISTINCTIVE = Object.fromEntries(
  KIND_ORDER.map((k) => [k, SCHEMAS[k].fields.filter((x) => x.required && !KIND_ORDER.some((o) => o !== k && SCHEMAS[o].fields.some((y) => y.required && y.key === x.key))).map((x) => x.key)]),
) as Record<CsvKind, string[]>

/**
 * For a file dropped in the wrong slot: the export its columns match better
 * than `kind`, or null. Kinds rank by the share of their required fields the
 * columns cover, then by how many columns they explain, then by distinctive
 * fields matched. Only a kind with at least one distinctive field present is
 * suggested, so a file of shared columns (client, date) suggests nothing.
 */
export function suggestKind(headers: string[], kind: CsvKind): CsvKind | null {
  const fit = (k: CsvKind) => {
    const m = autoMap(headers, k)
    const required = SCHEMAS[k].fields.filter((x) => x.required)
    return { k, ratio: required.filter((x) => m[x.key]).length / required.length, mapped: Object.keys(m).length, distinct: DISTINCTIVE[k].filter((key) => m[key]).length }
  }
  const beats = (a: ReturnType<typeof fit>, b: ReturnType<typeof fit>) => a.ratio - b.ratio || a.mapped - b.mapped || a.distinct - b.distinct
  const own = fit(kind)
  let best: ReturnType<typeof fit> | null = null
  for (const k of KIND_ORDER) {
    if (k === kind) continue
    const c = fit(k)
    if (c.distinct > 0 && beats(c, own) > 0 && (!best || beats(c, best) > 0)) best = c
  }
  return best?.k ?? null
}

// ---------------------------------------------------------------- parsing

export function parseNumber(v: string | undefined): number | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  const hm = s.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?(?:\s*(\d+)\s*m(?:in(?:ute)?s?)?)?$/i)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2] ?? 0)
  const colon = s.match(/^(\d+):(\d{2})$/)
  if (colon) return Number(colon[1]) * 60 + Number(colon[2])
  const cleaned = s.replace(/[£$€,\s]/g, '').replace(/^\((.*)\)$/, '-$1')
  if (!/^-?\d*\.?\d+$/.test(cleaned)) return null
  return Number(cleaned)
}

export function parseBool(v: string | undefined): boolean | null {
  if (v == null) return null
  const s = String(v).trim().toLowerCase()
  if (!s) return null
  if (['y', 'yes', 'true', '1', 'billable', 'chargeable', 'b'].includes(s)) return true
  if (['n', 'no', 'false', '0', 'non-billable', 'non billable', 'nonbillable', 'not billable', 'nb', 'no charge', 'covered'].includes(s)) return false
  return null
}

// Accepts ISO dates, UK-style DD/MM/YYYY and either with an optional time.
export function parseDate(v: string | undefined, withTime: boolean): string | null {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  let y: number, m: number, d: number
  let rest = ''
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(.*)$/)
  if (match) {
    ;[y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
    rest = match[4]
  } else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(.*)$/))) {
    ;[d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])]
    if (y < 100) y += 2000
    rest = match[4]
  } else {
    const t = Date.parse(s)
    if (Number.isNaN(t)) return null
    const dt = new Date(t)
    ;[y, m, d] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()]
    rest = withTime ? ` ${dt.getHours()}:${dt.getMinutes()}` : ''
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  if (!withTime) return date
  const tm = rest.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?/i)
  if (!tm) return date
  let hh = Number(tm[1])
  if (tm[3]?.toLowerCase() === 'pm' && hh < 12) hh += 12
  if (tm[3]?.toLowerCase() === 'am' && hh === 12) hh = 0
  return `${date}T${String(hh).padStart(2, '0')}:${tm[2]}:00`
}

// ---------------------------------------------------------------- import

export type MappedRow = Record<string, string>

export interface RowError {
  row: number
  message: string
}

export interface ImportContext {
  workspaceId: string
  clients: Client[]
  // Rows already in the workspace. A row with the same natural key reuses the
  // existing id, so the upsert replaces it instead of adding a duplicate.
  existing?: { tickets: Ticket[]; time_entries: TimeEntry[]; assets: Asset[]; billing_items: BillingItem[] }
}

export interface ImportResult {
  kind: CsvKind
  clients: Client[] // new or updated
  tickets: Ticket[]
  time_entries: TimeEntry[]
  assets: Asset[]
  billing_items: BillingItem[]
  errors: RowError[]
  warnings: string[]
  imported: number // added + updated
  added: number
  updated: number
}

export const uuid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
export const clientKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '')

// What makes two rows the same record, per table. Re-importing an export
// matches on these rather than on ids, which a CSV doesn't carry.
const lowerTrim = (s: string) => s.trim().toLowerCase()
export const naturalKey = {
  tickets: (t: Pick<Ticket, 'client_id' | 'external_id'>) => `${t.client_id}|${t.external_id}`,
  time_entries: (e: Pick<TimeEntry, 'client_id' | 'ticket_external_id' | 'date' | 'technician' | 'minutes'>) => `${e.client_id}|${e.ticket_external_id ?? ''}|${e.date}|${e.technician ?? ''}|${e.minutes}`,
  assets: (a: Pick<Asset, 'client_id' | 'asset_type' | 'name'>) => `${a.client_id}|${a.asset_type}|${lowerTrim(a.name)}`,
  billing_items: (b: Pick<BillingItem, 'client_id' | 'service'>) => `${b.client_id}|${lowerTrim(b.service)}`,
}
type KeyedTable = keyof typeof naturalKey

export function newClient(workspaceId: string, name: string, extra: Partial<Client> = {}): Client {
  return {
    id: uuid(),
    workspace_id: workspaceId,
    name,
    monthly_recurring_revenue: 0,
    contracted_users: null,
    contracted_devices: null,
    package: null,
    contract_start: null,
    contract_end: null,
    included_hours: null,
    monthly_software_cost: null,
    created_at: now(),
    ...extra,
  }
}

export function applyMapping(rows: Record<string, string>[], mapping: Record<string, string>): MappedRow[] {
  return rows.map((r) => {
    const out: MappedRow = {}
    for (const [field, header] of Object.entries(mapping)) if (header) out[field] = r[header] ?? ''
    return out
  })
}

export function validateRows(kind: CsvKind, rows: MappedRow[]): RowError[] {
  const errors: RowError[] = []
  const schema = SCHEMAS[kind]
  rows.forEach((r, i) => {
    for (const field of schema.fields) {
      const v = (r[field.key] ?? '').trim()
      if (!v) {
        if (field.required) errors.push({ row: i + 2, message: `${field.label} is empty` })
        continue
      }
      if (field.type === 'number' && parseNumber(v) == null) errors.push({ row: i + 2, message: `${field.label} "${v}" isn't a number` })
      if ((field.type === 'date' || field.type === 'datetime') && !parseDate(v, field.type === 'datetime')) errors.push({ row: i + 2, message: `${field.label} "${v}" isn't a recognisable date` })
      if (field.type === 'boolean' && parseBool(v) == null) errors.push({ row: i + 2, message: `${field.label} "${v}" should be yes/no` })
    }
    if (kind === 'assets' && r.type && !/^(user|device|person|account|computer|laptop|desktop|server|workstation|endpoint|mobile|phone)/i.test(r.type.trim()))
      errors.push({ row: i + 2, message: `Type "${r.type}" should be user or device` })
  })
  return errors
}

export function importRows(kind: CsvKind, rows: MappedRow[], ctx: ImportContext): ImportResult {
  const res: ImportResult = { kind, clients: [], tickets: [], time_entries: [], assets: [], billing_items: [], errors: [], warnings: [], imported: 0, added: 0, updated: 0 }
  const byKey = new Map(ctx.clients.map((c) => [clientKey(c.name), c]))
  const created = new Set<string>()
  // Ids by natural key: rows already in the workspace, then rows seen in this file.
  const known: Record<KeyedTable, Map<string, string>> = {
    tickets: new Map((ctx.existing?.tickets ?? []).map((r) => [naturalKey.tickets(r), r.id])),
    time_entries: new Map((ctx.existing?.time_entries ?? []).map((r) => [naturalKey.time_entries(r), r.id])),
    assets: new Map((ctx.existing?.assets ?? []).map((r) => [naturalKey.assets(r), r.id])),
    billing_items: new Map((ctx.existing?.billing_items ?? []).map((r) => [naturalKey.billing_items(r), r.id])),
  }
  let repeated = 0 // rows that repeat an earlier row in this same file
  const seenInFile = new Set<string>()
  // Returns the id for a row: the existing one when the key matches, otherwise new.
  const idFor = <T extends KeyedTable>(table: T, row: Parameters<(typeof naturalKey)[T]>[0]): string => {
    const key = (naturalKey[table] as (r: typeof row) => string)(row)
    const id = known[table].get(key)
    if (seenInFile.has(`${table}:${key}`)) repeated++
    seenInFile.add(`${table}:${key}`)
    if (id) {
      res.updated++
      return id
    }
    const fresh = uuid()
    known[table].set(key, fresh)
    res.added++
    return fresh
  }
  const errors = validateRows(kind, rows)
  const badRows = new Set(errors.map((e) => e.row))
  res.errors = errors

  const resolve = (name: string): Client => {
    const k = clientKey(name)
    let c = byKey.get(k)
    if (!c) {
      c = newClient(ctx.workspaceId, name.trim())
      byKey.set(k, c)
      res.clients.push(c)
      created.add(c.name)
    }
    return c
  }

  rows.forEach((r, i) => {
    if (badRows.has(i + 2)) return
    const ws = ctx.workspaceId
    switch (kind) {
      case 'clients': {
        const existing = byKey.get(clientKey(r.client))
        const fields: Partial<Client> = {
          monthly_recurring_revenue: parseNumber(r.monthly_recurring_revenue) ?? 0,
          contracted_users: parseNumber(r.contracted_users),
          contracted_devices: parseNumber(r.contracted_devices),
          package: r.package?.trim() || null,
          contract_start: parseDate(r.contract_start, false),
          contract_end: parseDate(r.contract_end, false),
          included_hours: parseNumber(r.included_hours),
          monthly_software_cost: parseNumber(r.monthly_software_cost),
        }
        if (existing) {
          const updated = { ...existing, ...fields }
          byKey.set(clientKey(r.client), updated)
          res.clients = res.clients.filter((c) => c.id !== existing.id)
          res.clients.push(updated)
          res.updated++
        } else {
          const c = newClient(ws, r.client.trim(), fields)
          byKey.set(clientKey(r.client), c)
          res.clients.push(c)
          res.added++
        }
        break
      }
      case 'tickets': {
        const c = resolve(r.client)
        const billable = parseBool(r.billable)
        const external_id = r.ticket_id.trim().replace(/^#/, '')
        res.tickets.push({
          id: idFor('tickets', { client_id: c.id, external_id }),
          workspace_id: ws,
          client_id: c.id,
          external_id,
          date: parseDate(r.date, true)!,
          technician: r.technician?.trim() || null,
          subject: r.subject.trim(),
          description: r.description?.trim() || null,
          status: r.status?.trim() || null,
          time_spent_minutes: Math.max(0, parseNumber(r.time_spent_minutes) ?? 0),
          billable: billable ?? false,
        })
        break
      }
      case 'time_entries': {
        const c = resolve(r.client)
        const raw = r.minutes ?? ''
        let minutes = parseNumber(raw) ?? 0
        // A bare decimal under 24 in an "hours" column is almost certainly hours.
        if (/^\d+\.\d+$/.test(raw.trim()) && minutes < 24) minutes = Math.round(minutes * 60)
        const entry = {
          workspace_id: ws,
          client_id: c.id,
          ticket_external_id: r.ticket_id?.trim().replace(/^#/, '') || null,
          date: parseDate(r.date, true)!,
          technician: r.technician?.trim() || null,
          minutes,
          billable: parseBool(r.billable) ?? false,
        }
        res.time_entries.push({ id: idFor('time_entries', entry), ...entry })
        break
      }
      case 'assets': {
        const c = resolve(r.client)
        const type = /^(user|person|account)/i.test(r.type.trim()) ? 'user' : 'device'
        const status = r.status?.trim().toLowerCase()
        const own = r.ownership?.trim().toLowerCase()
        const name = r.name.trim()
        res.assets.push({
          id: idFor('assets', { client_id: c.id, asset_type: type, name }),
          workspace_id: ws,
          client_id: c.id,
          asset_type: type,
          name,
          ownership: own ? (/personal|byod|employee|private/.test(own) ? 'personal' : 'company') : null,
          license: r.license?.trim() || null,
          status: status && /^(inactive|disabled|retired|false|no|deleted|left)/.test(status) ? 'inactive' : 'active',
          first_seen: parseDate(r.first_seen, false),
        })
        break
      }
      case 'billing': {
        const c = resolve(r.client)
        const quantity = parseNumber(r.quantity) ?? 0
        const unit = parseNumber(r.unit_price) ?? 0
        const service = r.service.trim()
        res.billing_items.push({
          id: idFor('billing_items', { client_id: c.id, service }),
          workspace_id: ws,
          client_id: c.id,
          service,
          quantity,
          unit_price: unit,
          monthly_value: parseNumber(r.monthly_value) ?? Math.round(quantity * unit * 100) / 100,
        })
        break
      }
    }
    res.imported++
  })
  // A row repeated within the file keeps only its last version, so one upsert
  // never touches the same id twice.
  res.tickets = lastById(res.tickets)
  res.time_entries = lastById(res.time_entries)
  res.assets = lastById(res.assets)
  res.billing_items = lastById(res.billing_items)
  const again = res.updated - repeated
  if (again > 0) res.warnings.push(`${again} row${again === 1 ? '' : 's'} already imported ${again === 1 ? 'was' : 'were'} updated, not duplicated.`)
  if (repeated > 0) res.warnings.push(`${repeated} row${repeated === 1 ? '' : 's'} repeated in this file ${repeated === 1 ? 'was' : 'were'} merged into one.`)
  if (created.size && kind !== 'clients')
    res.warnings.push(
      `${created.size} client${created.size === 1 ? '' : 's'} not found in your client list ${created.size === 1 ? 'was' : 'were'} added: ${[...created].slice(0, 5).join(', ')}${created.size > 5 ? '…' : ''}. Upload a Clients CSV to add contract details.`,
    )
  return res
}

function lastById<T extends { id: string }>(rows: T[]): T[] {
  const byId = new Map<string, T>()
  for (const r of rows) byId.set(r.id, r)
  return byId.size === rows.length ? rows : [...byId.values()]
}
