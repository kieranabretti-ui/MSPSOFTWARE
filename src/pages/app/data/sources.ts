import type { CsvKind } from '../../../data/importers'

// What each export is, where an MSP gets it, and what the analysis uses it
// for. The "finds" lines follow the rules in src/engine/analyse.ts; keep them
// in step if a rule changes which data it reads.
export type SourceKind = CsvKind | 'contracts'

export const SOURCES: Record<SourceKind, { from: string; finds: string; need?: 'Required' | 'Recommended' }> = {
  clients: { from: 'From your PSA or billing system', finds: 'The baseline every opportunity is checked against', need: 'Required' },
  tickets: { from: 'From your PSA', finds: 'Finds out-of-scope and unbilled work', need: 'Recommended' },
  time_entries: { from: 'From your PSA', finds: 'Finds unbilled time and support over allowance' },
  assets: { from: 'From your RMM or Microsoft 365', finds: 'Finds agreement drift and unbilled licences' },
  billing: { from: 'From your billing or accounting system', finds: 'Finds billing mismatches and unbilled licences' },
  contracts: { from: 'Signed agreements, SOWs and service schedules', finds: 'Finds work the agreement excludes' },
}

// The clauses the contract reader looks for, in plain words. Kept apart from
// the clause labels shown after extraction so the two never read the same.
export const CONTRACT_CHECKS = 'Device ownership, hardware, project and onsite exclusions, support hours, included hours, third-party apps, and new user or device setup.'
