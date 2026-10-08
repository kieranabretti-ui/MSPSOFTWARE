import type { AnalysisSummary } from '../../../engine/types'
import { plural } from '../../../lib/format'

// "Nothing found" is a statement about the data checked, never a clean bill of
// health: say what the rules ran over, so low coverage reads as low coverage.
export function coverageLine(s: Pick<AnalysisSummary, 'data_counts' | 'coverage'>): string {
  const d = s.data_counts
  const parts = [plural(d.tickets, 'ticket'), plural(d.time_entries, 'time entry', 'time entries'), plural(d.billing_items, 'billing line')]
  const contracts = s.coverage ? `contracts for ${s.coverage.clients_with_contract} of ${plural(s.coverage.clients, 'client')}` : plural(d.contracts, 'contract')
  return `No opportunity met the rules for the data provided: ${parts.join(', ')} and ${contracts}. Add more months of exports, or the missing contracts, to widen the check.`
}
