import { analyse } from '../../engine/analyse'
import { importRows } from '../../data/importers'
import { confidenceOf } from '../../lib/confidence'
import { formatCalculation } from '../../lib/calculation'
import { DEFAULT_SETTINGS, type BillingItem, type Client, type Contract, type Dataset, type TimeEntry } from '../../engine/types'

// The landing page's "Check the evidence" example: the brief's agreement-drift
// case (39 contracted users, 47 active, £82 a user), run through the real
// importer and engine on a three-file sample. The same case is a known-answer
// test (src/engine/knownAnswers.test.ts), so the page shows what the engine
// actually produces, not an illustration. Never imported by the page itself.

const WS = 'sample'
const AT = '2026-01-01T00:00:00Z'

export function sampleDriftDataset(): Dataset {
  const acme: Client = {
    id: 'client-acme',
    workspace_id: WS,
    name: 'Acme Ltd',
    monthly_recurring_revenue: 0,
    contracted_users: 39,
    contracted_devices: null,
    package: null,
    contract_start: null,
    contract_end: null,
    included_hours: null,
    monthly_software_cost: null,
    created_at: AT,
    source: { upload_id: 'up-clients', file_name: 'clients.csv', row: 2 },
  }
  const agreement: Contract = {
    id: 'contract-acme',
    workspace_id: WS,
    client_id: acme.id,
    title: 'Acme Managed Services Agreement',
    text: '1. Services\n\n1.1 Remote support for the Client.\n\n1.2 The monthly charge is based on 39 supported users.',
    upload_id: 'up-contract',
    created_at: AT,
  }
  const users = importRows(
    'assets',
    Array.from({ length: 47 }, (_, i) => ({ client: 'Acme Ltd', type: 'user', name: `Person ${i + 1}`, status: 'active', first_seen: '2025-03-01' })),
    { workspaceId: WS, clients: [acme], upload_id: 'up-users', file_name: 'users.csv' },
  )
  const line: BillingItem = {
    id: 'bill-acme',
    workspace_id: WS,
    client_id: acme.id,
    service: 'Managed Support (per user)',
    quantity: 39,
    unit_price: 82,
    monthly_value: 39 * 82,
    source: { upload_id: 'up-billing', file_name: 'billing.csv', row: 2 },
  }
  // One billable entry fixes the analysis window to a single month and raises nothing itself.
  const window: TimeEntry = {
    id: 'time-acme',
    workspace_id: WS,
    client_id: acme.id,
    ticket_external_id: null,
    date: '2026-09-10T10:00:00',
    technician: 'Sam',
    minutes: 30,
    billable: true,
    source: { upload_id: 'up-time', file_name: 'time.csv', row: 2 },
  }
  return { settings: { ...DEFAULT_SETTINGS }, clients: [acme], contracts: [agreement], tickets: [], time_entries: [window], billing_items: [line], assets: users.assets }
}

export function sampleDriftFinding() {
  const ds = sampleDriftDataset()
  const f = analyse(ds).findings.find((x) => x.meta.rule === 'drift.user')
  if (!f) throw new Error('Evidence example: no drift finding from the sample dataset')
  return { f, ds, reading: confidenceOf(f), calc: formatCalculation(f) }
}
