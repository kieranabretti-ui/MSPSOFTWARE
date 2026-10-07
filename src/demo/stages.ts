import type { FindingDraft, FindingStatus } from '../engine/types'

// Stages the demo opens with, so the recovery queue shows the workflow in use:
// 35 New, 2 Reviewing, 2 Approved, 1 Actioned. Nothing is dismissed and ticket
// #18492 stays New, so the demo's totals are the engine's totals.
export const DEMO_STAGES: { rule: string; client: string; status: FindingStatus }[] = [
  { rule: 'usage.over_allowance', client: 'Harbour Physio', status: 'reviewing' },
  { rule: 'margin.below_target', client: 'ABC Ltd', status: 'reviewing' },
  { rule: 'drift.user', client: 'Riverside Care Group', status: 'valid' },
  { rule: 'drift.device', client: 'Meridian Logistics', status: 'valid' },
  { rule: 'drift.user', client: 'Thames Valley Recruitment', status: 'resolved' },
]

// The demo stage for one finding, New unless listed above.
export function demoStageOf(f: Pick<FindingDraft, 'client_id' | 'meta'>, clientName: (id: string) => string): FindingStatus {
  return DEMO_STAGES.find((s) => s.rule === f.meta.rule && s.client === clientName(f.client_id))?.status ?? 'open'
}

// The stage changes to apply to a freshly analysed demo workspace.
export function applyDemoStages(findings: (Pick<FindingDraft, 'client_id' | 'meta'> & { id: string })[], clientName: (id: string) => string): { id: string; status: FindingStatus }[] {
  return findings.flatMap((f) => {
    const status = demoStageOf(f, clientName)
    return status === 'open' ? [] : [{ id: f.id, status }]
  })
}
