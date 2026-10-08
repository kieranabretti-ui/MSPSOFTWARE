import type { FindingDraft, FindingStatus } from '../engine/types'

// Stages the demo opens with, so the recovery queue shows the workflow in use:
// 35 New, 2 Reviewing, 2 Approved, 1 Actioned. Nothing is dismissed and ticket
// #18492 stays New, so the demo's totals are the engine's totals. Each staged
// opportunity carries the decision a person would have recorded: who owns it
// and a short note. days_ago dates the decision for the activity log.
export interface DemoStage {
  rule: string
  client: string
  status: FindingStatus
  owner: string
  note: string | null
  days_ago: number
}

export const DEMO_STAGES: DemoStage[] = [
  { rule: 'usage.over_allowance', client: 'Harbour Physio', status: 'reviewing', owner: 'Alex Morgan', note: 'Checking whether the August overage was invoiced separately.', days_ago: 2 },
  { rule: 'margin.below_target', client: 'ABC Ltd', status: 'reviewing', owner: 'Alex Morgan', note: null, days_ago: 3 },
  { rule: 'drift.user', client: 'Riverside Care Group', status: 'valid', owner: 'Alex Morgan', note: 'User list matches the Microsoft 365 export. Raise at the next account review.', days_ago: 4 },
  { rule: 'drift.device', client: 'Meridian Logistics', status: 'valid', owner: 'Alex Morgan', note: 'Device count confirmed against the RMM report.', days_ago: 5 },
  { rule: 'drift.user', client: 'Thames Valley Recruitment', status: 'resolved', owner: 'Alex Morgan', note: 'Agreement updated to the current user count from the next invoice.', days_ago: 6 },
]

const stageFor = (f: Pick<FindingDraft, 'client_id' | 'meta'>, clientName: (id: string) => string) => DEMO_STAGES.find((s) => s.rule === f.meta.rule && s.client === clientName(f.client_id))

// The demo stage for one finding, New unless listed above.
export function demoStageOf(f: Pick<FindingDraft, 'client_id' | 'meta'>, clientName: (id: string) => string): FindingStatus {
  return stageFor(f, clientName)?.status ?? 'open'
}

// The stage changes to apply to a freshly analysed demo workspace.
export function applyDemoStages(
  findings: (Pick<FindingDraft, 'client_id' | 'meta'> & { id: string })[],
  clientName: (id: string) => string,
): ({ id: string } & Omit<DemoStage, 'rule' | 'client'>)[] {
  return findings.flatMap((f) => {
    const s = stageFor(f, clientName)
    if (!s || s.status === 'open') return []
    const { rule: _r, client: _c, ...rest } = s
    return [{ id: f.id, ...rest }]
  })
}
