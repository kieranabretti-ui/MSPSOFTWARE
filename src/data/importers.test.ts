import { readFileSync } from 'node:fs'
import Papa from 'papaparse'
import { describe, expect, it } from 'vitest'
import { importRows, KIND_ORDER, suggestKind, type CsvKind, type MappedRow } from './importers'

const ticketRows: MappedRow[] = [
  { ticket_id: '#501', client: 'ABC Ltd', date: '2026-09-01 10:00', subject: 'Laptop setup for new starter', time_spent_minutes: '60', billable: 'no' },
  { ticket_id: '502', client: 'ABC Ltd', date: '2026-09-02 11:00', subject: 'Printer offline', time_spent_minutes: '30', billable: 'no' },
  { ticket_id: '503', client: 'Castle Accountancy', date: '2026-09-03 09:00', subject: 'Sage 50 update', time_spent_minutes: '45', billable: 'yes' },
]

describe('importRows natural keys', () => {
  it('updates tickets already imported instead of adding them again', () => {
    const first = importRows('tickets', ticketRows, { workspaceId: 'ws', clients: [] })
    expect(first).toMatchObject({ imported: 3, added: 3, updated: 0 })
    expect(first.warnings.some((w) => /already imported/.test(w))).toBe(false)

    const existing = { tickets: first.tickets, time_entries: [], assets: [], billing_items: [] }
    const second = importRows('tickets', ticketRows, { workspaceId: 'ws', clients: first.clients, existing })
    expect(second).toMatchObject({ imported: 3, added: 0, updated: 3 })
    expect(second.tickets.map((t) => t.id).sort()).toEqual(first.tickets.map((t) => t.id).sort())
    expect(second.clients).toHaveLength(0)
    expect(second.warnings).toContain('3 rows already imported were updated, not duplicated.')
  })

  it('collapses a ticket repeated within one file onto one id', () => {
    const res = importRows('tickets', [...ticketRows, { ...ticketRows[1], subject: 'Printer offline again' }], { workspaceId: 'ws', clients: [] })
    expect(res).toMatchObject({ imported: 4, added: 3, updated: 1 })
    expect(res.tickets).toHaveLength(3)
    expect(res.tickets.find((t) => t.external_id === '502')?.subject).toBe('Printer offline again')
    expect(res.warnings).toContain('1 row repeated in this file was merged into one.')
  })

  it('matches time entries, assets and billing lines on their natural keys', () => {
    const time: MappedRow[] = [{ date: '2026-09-01 10:00', client: 'ABC Ltd', technician: 'Sam', ticket_id: '501', minutes: '60', billable: 'no' }]
    const t1 = importRows('time_entries', time, { workspaceId: 'ws', clients: [] })
    const t2 = importRows('time_entries', time, { workspaceId: 'ws', clients: t1.clients, existing: { tickets: [], time_entries: t1.time_entries, assets: [], billing_items: [] } })
    expect(t2.time_entries[0].id).toBe(t1.time_entries[0].id)

    const assets: MappedRow[] = [{ client: 'ABC Ltd', type: 'user', name: 'Jo Bloggs' }]
    const a1 = importRows('assets', assets, { workspaceId: 'ws', clients: [] })
    const a2 = importRows('assets', [{ ...assets[0], name: '  jo bloggs ' }], { workspaceId: 'ws', clients: a1.clients, existing: { tickets: [], time_entries: [], assets: a1.assets, billing_items: [] } })
    expect(a2).toMatchObject({ added: 0, updated: 1 })
    expect(a2.assets[0].id).toBe(a1.assets[0].id)

    const billing: MappedRow[] = [{ client: 'ABC Ltd', service: 'Managed User Support (per user)', quantity: '35', unit_price: '18' }]
    const b1 = importRows('billing', billing, { workspaceId: 'ws', clients: [] })
    const b2 = importRows('billing', [{ ...billing[0], quantity: '39' }], { workspaceId: 'ws', clients: b1.clients, existing: { tickets: [], time_entries: [], assets: [], billing_items: b1.billing_items } })
    expect(b2.billing_items[0]).toMatchObject({ id: b1.billing_items[0].id, quantity: 39 })
  })
})

describe('suggestKind', () => {
  // The sample exports in samples/, as the import modal reads their headers.
  const SAMPLES: Record<CsvKind, string> = {
    clients: 'clients.csv',
    tickets: 'tickets.csv',
    time_entries: 'time-entries.csv',
    assets: 'users-and-devices.csv',
    billing: 'billing.csv',
  }
  const headersOf = (file: string) => {
    const text = readFileSync(new URL(`../../samples/${file}`, import.meta.url), 'utf8')
    return (Papa.parse<Record<string, string>>(text, { header: true, preview: 1, transformHeader: (h) => h.trim() }).meta.fields ?? []).filter(Boolean)
  }

  for (const kind of KIND_ORDER) {
    const headers = headersOf(SAMPLES[kind])
    it(`suggests nothing for the ${kind} sample in its own slot`, () => {
      expect(suggestKind(headers, kind)).toBeNull()
    })
    for (const slot of KIND_ORDER.filter((k) => k !== kind))
      it(`suggests ${kind} for the ${kind} sample in the ${slot} slot`, () => {
        expect(suggestKind(headers, slot)).toBe(kind)
      })
  }

  it('suggests nothing when only shared columns match', () => {
    expect(suggestKind(['client', 'date', 'notes'], 'clients')).toBeNull()
  })
})
