import type { Analysis, Upload } from '../../../engine/types'
import type { WorkspaceData } from '../../../data/backend'
import { SCHEMAS } from '../../../data/importers'
import { plural } from '../../../lib/format'

// What each deletion control removes and what it leaves, in words, for its
// confirmation dialog. Kept in one place so Analyses and Settings say the same
// thing, and so the text follows what the backends actually do
// (src/data/localBackend.ts and the delete_* functions in
// supabase/migrations/20261008000000_evidence_and_audit.sql).

export type Mode = 'local' | 'supabase'

export interface DeletionCopy {
  title: string
  intro?: string
  removes: string[]
  keeps: string[]
  confirm: string
}

const DOWNLOADS = 'Files you have already downloaded, such as PDF reports and CSV exports'
const BACKUPS = "Copies in the hosting provider's backups, until they expire on its schedule"
const LOG_KEPT = 'The activity log entry for this deletion (counts only, no client data)'

export function uploadDeletion(u: Upload, mode: Mode, data: Pick<WorkspaceData, 'analyses'>): DeletionCopy {
  const contract = u.kind === 'contract'
  const what = u.kind === 'contract' ? 'contract' : `${SCHEMAS[u.kind].title.toLowerCase()} file`
  const removes = contract
    ? ['The contract text and its upload record', ...(mode === 'supabase' && u.storage_path ? ['The original file in private storage'] : [])]
    : [
        `The upload record for ${u.file_name}`,
        `The records this file imported (${plural(u.row_count, 'row')}). A record a later file re-imported belongs to that file and stays.`,
      ]
  if (!contract)
    removes.push('Clients this file created that have nothing else: no other records, contract, task or decided opportunity')
  return {
    title: `Delete this ${what}?`,
    intro: u.file_name,
    removes,
    keeps: [
      'Every other upload and its records',
      data.analyses.length
        ? 'Current opportunities, until you run the analysis again (opportunities on a removed client go with it)'
        : 'Your settings and the rest of the workspace',
      'Decisions, notes and owners on opportunities',
      LOG_KEPT,
      ...(mode === 'supabase' ? [BACKUPS] : []),
    ],
    confirm: contract ? 'Delete contract' : 'Delete file and records',
  }
}

export function analysisDeletion(a: Analysis, latest: boolean, data: Pick<WorkspaceData, 'findings' | 'stale_findings' | 'reports'>, mode: Mode): DeletionCopy {
  const findings = [...data.findings, ...data.stale_findings].filter((f) => f.analysis_id === a.id)
  const decided = findings.filter((f) => f.status !== 'open' || !!f.decision_note || !!f.owner).length
  const reports = data.reports.filter((r) => r.analysis_id === a.id).length
  const removes = [
    'This analysis and the figures it recorded',
    findings.length
      ? `${plural(findings.length, 'opportunity', 'opportunities')} it produced${decided ? `, including ${plural(decided, 'decision')} recorded on them (stage, note, owner)` : ''}`
      : 'No opportunities: none belong to this run any more',
    ...(reports ? [`The record of ${plural(reports, 'report')} downloaded from it`] : []),
  ]
  return {
    title: latest ? 'Delete the latest analysis?' : 'Delete this analysis?',
    intro: latest ? 'Opportunities belong to the latest analysis. Until you run the analysis again, none are shown and the overview uses the previous run.' : undefined,
    removes,
    keeps: [
      'Your uploaded data, so you can run the analysis again',
      'Other analyses',
      'Tasks, unlinked from deleted opportunities',
      LOG_KEPT,
      DOWNLOADS,
      ...(mode === 'supabase' ? [BACKUPS] : []),
    ],
    confirm: 'Delete analysis',
  }
}

export function clearDeletion(workspaceName: string, mode: Mode): DeletionCopy {
  return {
    title: 'Clear all data?',
    intro: `Empties ${workspaceName} so you can start again.`,
    removes: [
      'Every client, ticket, time entry, user, device and billing line',
      'Every contract and upload record',
      ...(mode === 'supabase' ? ['Every original file in private storage'] : []),
      'Every analysis, opportunity, decision, task and report record',
    ],
    keeps: ['Your account and the workspace, with its name and settings', 'The activity log, with an entry for this clear', DOWNLOADS, ...(mode === 'supabase' ? [BACKUPS] : [])],
    confirm: 'Clear data',
  }
}

export function workspaceDeletion(workspaceName: string, mode: Mode): DeletionCopy {
  return {
    title: 'Delete this workspace?',
    removes: [
      `${workspaceName}, its settings and everything in it: data, uploads, analyses, opportunities, decisions, tasks and reports`,
      ...(mode === 'supabase' ? ['Every original file in private storage'] : []),
      'The activity log for this workspace',
    ],
    keeps: [mode === 'supabase' ? 'Your account. You can create a new workspace afterwards.' : 'Your sign-in in this browser. You can create a new workspace afterwards.', DOWNLOADS, ...(mode === 'supabase' ? [BACKUPS] : [])],
    confirm: 'Delete workspace',
  }
}

export function accountDeletion(workspaceName: string, mode: Mode): DeletionCopy {
  return {
    title: 'Delete your account?',
    removes:
      mode === 'supabase'
        ? [
            `Your workspace ${workspaceName} and everything in it, original files included`,
            'Its activity log',
            'Your account: name, email address and sign-in',
          ]
        : [`Your workspace ${workspaceName} and everything in it`, 'Its activity log', 'Your account record and session in this browser'],
    keeps:
      mode === 'supabase'
        ? [DOWNLOADS, "Records the hosting provider keeps for its own operation, such as backups and access logs, until they expire on its schedule"]
        : [DOWNLOADS, 'Nothing is held on a server: this data was only ever in this browser'],
    confirm: 'Delete account',
  }
}
