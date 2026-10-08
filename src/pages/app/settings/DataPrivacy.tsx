import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useMetrics, useStore } from '../../../data/store'
import { LOCAL_ANALYSIS_CAP, LOCAL_AUDIT_CAP } from '../../../data/localBackend'
import { Badge, Button, ButtonLink, TextLink } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { COMPANY } from '../../../brand/brand'
import { downloadFile, num, plural } from '../../../lib/format'
import { mapError } from '../../../lib/errors'
import { findingsCsv } from '../findings/csv'
import { ConfirmDelete } from '../data/kit'
import { FactList, Section } from './Section'
import { accountDeletion, clearDeletion, workspaceDeletion, type DeletionCopy } from './deletion'

// The newest audit events the hosted backend loads with the workspace
// (src/data/supabaseBackend.ts). Older ones stay in the log.
const HOSTED_AUDIT_LOAD = 1000

type Pending = 'clear' | 'workspace' | 'account'

const linkCls = 'font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink-3'

// What Headroom stores for this workspace, where, for how long, and the
// controls to export or delete it. Every statement depends on the backend
// mode, because local (evaluation) mode and the hosted service differ.
export function DataPrivacy() {
  const { backend, workspace, user, data, isDemoSession, resetData, deleteWorkspace, deleteAccount, logExport } = useStore()
  const m = useMetrics()
  const toast = useToast()
  const nav = useNavigate()
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hosted = backend.mode === 'supabase'
  const name = workspace?.name ?? 'this workspace'
  const region = COMPANY.hostingRegion

  const records = data.clients.length + data.tickets.length + data.time_entries.length + data.assets.length + data.billing_items.length + data.contracts.length
  const hasData = records > 0 || data.uploads.length > 0 || data.analyses.length > 0

  const copy: Record<Pending, DeletionCopy> = {
    clear: clearDeletion(name, backend.mode),
    workspace: workspaceDeletion(name, backend.mode),
    account: accountDeletion(name, backend.mode),
  }

  const close = () => {
    if (busy) return
    setPending(null)
    setError(null)
  }

  const confirm = async () => {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      if (pending === 'clear') {
        await resetData()
        toast('All data cleared. Your settings and the activity log are kept.')
        setPending(null)
      } else if (pending === 'workspace') {
        await deleteWorkspace()
        nav('/onboarding', { replace: true })
      } else {
        await deleteAccount()
        nav('/', { replace: true })
      }
    } catch (e) {
      setError(mapError(e, 'save'))
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = async () => {
    const rows = data.findings
    if (!downloadFile('headroom-opportunities.csv', findingsCsv(rows, m.clientName), 'text/csv')) return
    try {
      await logExport('csv', { rows: rows.length, scope: 'opportunities' })
    } catch {
      /* the download happened; the log entry is best effort */
    }
  }

  const where = hosted
    ? `Supabase (database, sign-in and file storage)${region ? `, hosted in ${region}` : ''}.`
    : isDemoSession
      ? 'The demo sandbox in this browser. Nothing is sent to a server.'
      : 'Local storage in this browser, on this device. Nothing is sent to a server.'

  return (
    <>
      <Section
        id="data"
        title="What is stored"
        body={
          <>
            What Headroom keeps for {name}, and why. See also the{' '}
            <Link to="/trust" className={linkCls}>
              Trust Centre
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className={linkCls}>
              Privacy Policy
            </Link>
            .
          </>
        }
      >
        <FactList
          items={[
            {
              term: 'Your uploads',
              detail: (
                <>
                  Clients, tickets, time entries, users and devices, billing lines and contract text{hosted ? ', plus the original contract files' : ' (only the extracted text of a contract, not the file)'}. Used to run the analysis and to show the evidence for each opportunity.{' '}
                  <span className="tnum text-ink-3">
                    Now: {plural(data.uploads.length, 'upload')}, {plural(records, 'record')}.
                  </span>
                </>
              ),
            },
            {
              term: 'Analyses',
              detail: (
                <>
                  Each run's figures, its opportunities and the evidence behind them, and your decisions on them (stage, dismiss reason, note, owner).{' '}
                  <span className="tnum text-ink-3">Now: {plural(data.analyses.length, 'analysis', 'analyses')}.</span>
                </>
              ),
            },
            {
              term: 'Activity log',
              detail: (
                <>
                  Who did what and when: uploads, runs, decisions, exports and deletions. It records ids, counts and stage names, never client data values.{' '}
                  <span className="tnum text-ink-3">Now: {plural(data.audit_log.length, 'event')}{hosted && data.audit_log.length >= HOSTED_AUDIT_LOAD ? ' shown' : ''}.</span>
                </>
              ),
            },
            {
              term: 'Your account',
              detail: hosted ? `Your name and email address (${user?.email ?? 'not signed in'}), and your sign-in, handled by Supabase Auth.` : `Your name and email address, kept in this browser. Local mode has no server login.`,
            },
          ]}
        />
      </Section>

      <Section title="Where and who can see it" body="Depends on how this workspace is run.">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-body text-ink-2">Stored in</span>
            {hosted ? <Badge tone="success">Hosted workspace</Badge> : isDemoSession ? <Badge>Demo sandbox</Badge> : <Badge tone="warning">This browser only</Badge>}
          </div>
          <FactList
            items={[
              { term: 'Location', detail: where },
              {
                term: 'Access',
                detail: hosted
                  ? 'Row-level security limits every table and stored file to members of this workspace. One user per workspace.'
                  : "No server login protects it. The data isn't encrypted, so anyone using this browser profile can read it. Use sample or anonymised data in this mode.",
              },
              {
                term: 'AI',
                detail: hosted
                  ? "Only when you choose Explain on one opportunity: that opportunity's evidence is sent to Anthropic (in the US) and the reply is checked before it is stored. AI assists with interpretation. Financial calculations are deterministic."
                  : 'Not used. AI explanations are only available in a hosted workspace.',
              },
            ]}
          />
          {/* Setup help for developers only; production builds drop this branch. */}
          {import.meta.env.DEV && !hosted && !isDemoSession && (
            <p className="max-w-[68ch] text-caption text-ink-3">Development build: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to store workspaces with accounts.</p>
          )}
        </div>
      </Section>

      <Section title="How long it is kept" body="There is no automatic deletion schedule yet. Data stays until you delete it.">
        <FactList
          items={
            hosted
              ? [
                  { term: 'Uploads and opportunities', detail: 'Kept until you delete them, clear the data, or delete the workspace or account.' },
                  { term: 'Analyses', detail: 'Every analysis is kept until you delete it.' },
                  { term: 'Activity log', detail: `Kept for the life of the workspace. This page shows the newest ${num(HOSTED_AUDIT_LOAD)} events; older ones stay in the log.` },
                  { term: 'Backups', detail: "Copies in the hosting provider's backups expire on its schedule." },
                ]
              : [
                  { term: 'Uploads and opportunities', detail: "Kept until you delete them, clear the data, or clear this browser's site data." },
                  { term: 'Analyses', detail: `The newest ${num(LOCAL_ANALYSIS_CAP)} are kept. Older ones are removed automatically, with their report records.` },
                  { term: 'Activity log', detail: `The newest ${num(LOCAL_AUDIT_CAP)} events are kept.` },
                ]
          }
        />
      </Section>

      <Section title="Export" body="Take your opportunities with you. Exports are recorded in the activity log.">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!data.findings.length}>
            <Download className="size-4 shrink-0" aria-hidden /> Opportunities (CSV)
          </Button>
          <ButtonLink to="/app/reports" variant="ghost" size="sm">
            PDF report
          </ButtonLink>
        </div>
        <p className="tnum mt-2 text-caption text-ink-3">
          {data.findings.length ? `The CSV holds ${plural(data.findings.length, 'opportunity', 'opportunities')} in every stage, dismissed included, with the evidence, calculation, confidence and decision for each. The PDF report leaves dismissed opportunities out.` : 'Nothing to export until you run an analysis.'}
        </p>
      </Section>

      <Section id="delete" title="Delete" body="Each option says exactly what it removes and what it keeps before anything is deleted." last>
        <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line">
          <DeleteRow title="One source file" detail={`Delete an upload and the records it imported. ${plural(data.uploads.length, 'upload')} in this workspace.`}>
            <ButtonLink to="/app/analyses#uploads" variant="secondary" size="sm">
              Upload history
            </ButtonLink>
          </DeleteRow>
          <DeleteRow title="One analysis" detail={`Delete a run and the opportunities it produced. Your uploads stay. ${plural(data.analyses.length, 'analysis', 'analyses')} kept.`}>
            <ButtonLink to="/app/analyses" variant="secondary" size="sm">
              Past analyses
            </ButtonLink>
          </DeleteRow>
          <DeleteRow title="Clear all data" detail="Remove every upload, analysis and opportunity. The workspace, settings and activity log stay.">
            <Button variant="secondary" size="sm" onClick={() => setPending('clear')} disabled={!hasData}>
              Clear data
            </Button>
          </DeleteRow>
          <DeleteRow title="Delete workspace" detail="Remove the workspace and everything in it, its activity log included. Your account stays.">
            <Button variant="danger" size="sm" onClick={() => setPending('workspace')}>
              Delete workspace
            </Button>
          </DeleteRow>
          <DeleteRow title="Delete account" detail={hosted ? 'Remove your account, your workspace and everything in it.' : "Remove your account and workspace from this browser."}>
            <Button variant="danger" size="sm" onClick={() => setPending('account')}>
              Delete account
            </Button>
          </DeleteRow>
        </ul>
        <p className="mt-2 text-caption text-ink-3">
          Questions about your data? See the <TextLink to="/trust">Trust Centre</TextLink>.
        </p>
      </Section>

      {pending && (
        <ConfirmDelete
          open
          onClose={close}
          onConfirm={confirm}
          title={copy[pending].title}
          intro={copy[pending].intro}
          removes={copy[pending].removes}
          keeps={copy[pending].keeps}
          confirmLabel={copy[pending].confirm}
          typeToConfirm={pending === 'clear' ? undefined : name}
          busy={busy}
          error={error}
        />
      )}
    </>
  )
}

function DeleteRow({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-small font-medium text-ink">{title}</p>
        <p className="tnum mt-0.5 text-small text-ink-3">{detail}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </li>
  )
}
