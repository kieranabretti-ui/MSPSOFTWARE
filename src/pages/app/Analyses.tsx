import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, FileText, Play, Upload as UploadIcon } from 'lucide-react'
import type { AnalysisSummary } from '../../engine/types'
import { useStore } from '../../data/store'
import { Button, Card, CardHeader, Modal, PageHeader, cx } from '../../components/ui'
import { useToast } from '../../components/toast'
import { KIND_ORDER, SCHEMAS, type CsvKind } from '../../data/importers'
import { downloadFile, num, plural, relative, toCsv } from '../../lib/format'
import { mapError } from '../../lib/errors'
import { ICONS } from '../../brand/icons'
import { CsvImportModal } from './data/CsvImportModal'
import { ContractModal } from './data/ContractModal'
import { SourceRow } from './data/SourceRow'
import { UploadHistory } from './data/UploadHistory'
import { Callout } from './data/kit'
import { CONTRACT_CHECKS } from './data/sources'
import { AnalysisProgress } from './analyses/AnalysisProgress'
import { AnalysisResult } from './analyses/AnalysisResult'
import { AnalysisHistory } from './analyses/AnalysisHistory'

const COUNT_KEY: Record<CsvKind, 'clients' | 'tickets' | 'time_entries' | 'assets' | 'billing_items'> = {
  clients: 'clients',
  tickets: 'tickets',
  time_entries: 'time_entries',
  assets: 'assets',
  billing: 'billing_items',
}

async function demoRows(kind: CsvKind) {
  const { generateDemo } = await import('../../demo/generate')
  const raw = generateDemo()
  return kind === 'billing' ? raw.billing : raw[kind]
}

const linkBtn = 'inline-flex items-center gap-1 rounded-sm text-caption font-medium text-ink-3 underline-offset-4 transition-colors duration-150 hover:text-ink hover:underline'

// Where data comes in and analyses go out: the run and its result, the exports
// it reads, and every past run with what it found.
export default function AnalysesPage() {
  const { data, analysis, loadDemoData, resetData, workspace, backend } = useStore()
  const toast = useToast()
  const nav = useNavigate()
  // A file that arrived in the wrong slot travels with it to the right one.
  const [importing, setImporting] = useState<{ kind: CsvKind; file?: File } | null>(null)
  const [contractOpen, setContractOpen] = useState(false)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [clearing, setClearing] = useState(false)
  // The run replaces the status panel: its progress, then its result.
  const [run, setRun] = useState<'running' | AnalysisSummary | null>(null)
  const hasData = data.clients.length > 0 || data.tickets.length > 0
  const stale = analysis && data.uploads.some((u) => u.created_at > analysis.created_at)

  const loadDemo = async () => {
    setConfirmDemo(false)
    try {
      await loadDemoData()
      toast('Demo MSP loaded and analysed.')
      nav('/app')
    } catch (e) {
      toast(mapError(e, 'demo'), 'error')
    }
  }

  const clearAll = async () => {
    setClearing(true)
    try {
      await resetData()
      setRun(null)
      setConfirmReset(false)
      toast('All data cleared.')
    } catch (e) {
      setConfirmReset(false)
      toast(mapError(e, 'save'), 'error')
    } finally {
      setClearing(false)
    }
  }

  const template = async (kind: CsvKind, full: boolean) => {
    const rows = await demoRows(kind)
    const keys = SCHEMAS[kind].fields.map((f) => f.key)
    const out = (full ? rows : rows.slice(0, 3)).map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? ''])))
    downloadFile(`${full ? 'demo' : 'template'}-${kind.replace('_', '-')}.csv`, toCsv(out), 'text/csv')
  }

  const samplePdf = async () => {
    const { generateDemo } = await import('../../demo/generate')
    const { textToPdf } = await import('../../lib/pdf')
    const c = generateDemo().contracts.find((x) => x.client === 'Bramley Homes')!
    downloadFile('sample-contract-bramley-homes.pdf', await textToPdf(c.title, c.text), 'application/pdf')
  }

  const lastUpload = (kind: CsvKind | 'contract') => {
    const ts = data.uploads.filter((u) => u.kind === kind).map((u) => u.created_at)
    return ts.length ? relative(ts.sort()[ts.length - 1]) : null
  }

  // The next export to ask for: the first essential one still missing.
  const next: CsvKind | null = !data.clients.length ? 'clients' : !data.tickets.length ? 'tickets' : null
  const loadedCount = KIND_ORDER.filter((k) => data[COUNT_KEY[k]].length > 0).length + (data.contracts.length > 0 ? 1 : 0)
  const totalSources = KIND_ORDER.length + 1

  const state = analysis ? (stale ? 'stale' : 'current') : hasData ? 'ready' : 'empty'
  const STATUS = {
    empty: { dot: 'bg-ink-4', title: 'No data yet', body: 'Start with Clients and Tickets. Time entries, users and devices, billing and contracts make the analysis more complete.' },
    ready: { dot: 'bg-ink-2', title: 'Ready to analyse', body: 'Upload anything else you have, then run the analysis.' },
    current: { dot: 'bg-success', title: 'Analysis up to date', body: analysis ? `Last run ${relative(analysis.created_at)} on ${analysis.summary.period_label}.` : '' },
    stale: { dot: 'bg-warning', title: 'New data since the last analysis', body: analysis ? `Last run ${relative(analysis.created_at)} on ${analysis.summary.period_label}. Run it again to include your latest uploads.` : '' },
  }[state]

  const Demo = ICONS.data
  return (
    <>
      <PageHeader
        title="Analyses"
        subtitle="Upload the exports you already have, run the analysis, and see every past run."
        actions={
          <Button variant="secondary" size="sm" onClick={() => (hasData ? setConfirmDemo(true) : loadDemo())}>
            <Demo className="size-4 shrink-0" aria-hidden /> Load demo data
          </Button>
        }
      />

      {backend.mode === 'local' && workspace && !workspace.is_demo && (
        <Callout tone="warning" className="mb-6">
          <strong className="font-semibold">Evaluation mode:</strong> data stays in this browser and isn't protected by a server login. Don't upload client data here.
        </Callout>
      )}

      <div className="mb-6">
        {run === 'running' ? (
          <AnalysisProgress source="manual" onDone={setRun} onCancel={() => setRun(null)} />
        ) : run ? (
          <AnalysisResult summary={run} onClose={() => setRun(null)} onUploadContracts={() => setContractOpen(true)} />
        ) : (
          <section
            aria-label="Analysis status"
            className={cx(
              'flex flex-col gap-4 rounded-lg border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5',
              state === 'stale' ? 'border-warning-line bg-warning-soft' : 'border-line bg-surface',
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className={cx('mt-[7px] size-2 shrink-0 rounded-full', STATUS.dot)} aria-hidden />
              <div className="min-w-0">
                <p className={cx('text-body font-medium', state === 'stale' ? 'text-warning' : 'text-ink')}>{STATUS.title}</p>
                <p className={cx('tnum mt-0.5 text-small', state === 'stale' ? 'text-ink' : 'text-ink-3')}>{STATUS.body}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-4 pl-5 sm:pl-0">
              {!data.clients.length && <span className="text-caption text-ink-3">Upload clients first</span>}
              <Button variant={state === 'ready' || state === 'stale' ? 'accent' : 'secondary'} onClick={() => setRun('running')} disabled={!data.clients.length} data-testid="run-analysis">
                <Play className="size-4 shrink-0" aria-hidden /> {analysis ? 'Run analysis again' : 'Run analysis'}
              </Button>
            </div>
          </section>
        )}
      </div>

      {/* Once there are runs, the history sits with the run; before then the
          sources come first, since uploading is the next step. */}
      {data.analyses.length > 0 && <AnalysisHistory analyses={data.analyses} className="mb-6" />}

      <Card className="mb-6">
        <CardHeader
          title="Sources"
          subtitle="Clients are required. Every other export makes the analysis more complete. Column names don't need to match."
          right={
            <span className="tnum shrink-0 whitespace-nowrap pt-0.5 text-small text-ink-3">
              <span className="font-semibold text-ink">{loadedCount}</span> of {totalSources} loaded
            </span>
          }
        />
        <ul className="divide-y divide-line-soft">
          {KIND_ORDER.map((kind) => {
            const s = SCHEMAS[kind]
            const count = data[COUNT_KEY[kind]].length
            return (
              <SourceRow
                key={kind}
                kind={kind}
                title={s.title}
                description={s.description}
                fields={s.fields}
                count={count > 0 ? `${num(count)} ${count === 1 ? 'row' : 'rows'}` : null}
                updated={count > 0 ? lastUpload(kind) : null}
                actions={
                  <>
                    <Button size="sm" variant={next === kind ? 'primary' : 'secondary'} className="lg:w-full" onClick={() => setImporting({ kind })} data-testid={`upload-${kind}`}>
                      <UploadIcon className="size-4 shrink-0" aria-hidden /> Upload CSV
                    </Button>
                    <span className="flex items-center gap-2">
                      <button type="button" className={linkBtn} onClick={() => template(kind, false)} aria-label={`Download ${s.title.toLowerCase()} template`}>
                        <Download className="size-3.5 shrink-0" aria-hidden /> Template
                      </button>
                      <span className="text-ink-4" aria-hidden>
                        ·
                      </span>
                      <button type="button" className={linkBtn} onClick={() => template(kind, true)} aria-label={`Download ${s.title.toLowerCase()} demo file`}>
                        Demo file
                      </button>
                    </span>
                  </>
                }
              />
            )
          })}
          <SourceRow
            kind="contracts"
            title="Contracts & SOWs"
            description="Client contracts, statements of work and service agreements, as PDF. Headroom reads the scope and exclusions so tickets can be checked against them."
            checks={CONTRACT_CHECKS}
            count={data.contracts.length > 0 ? plural(data.contracts.length, 'contract') : null}
            updated={data.contracts.length > 0 ? lastUpload('contract') : null}
            actions={
              <>
                <Button size="sm" variant="secondary" className="lg:w-full" onClick={() => setContractOpen(true)} disabled={!data.clients.length} title={!data.clients.length ? 'Add a client first' : undefined}>
                  <FileText className="size-4 shrink-0" aria-hidden /> Upload PDF
                </Button>
                <button type="button" className={linkBtn} onClick={samplePdf}>
                  <Download className="size-3.5 shrink-0" aria-hidden /> Sample contract PDF
                </button>
              </>
            }
          />
        </ul>
      </Card>

      {!data.analyses.length && <AnalysisHistory analyses={data.analyses} className="mb-6" />}

      <UploadHistory uploads={data.uploads} onClear={hasData ? () => setConfirmReset(true) : undefined} />

      {importing && (
        <CsvImportModal
          key={importing.kind}
          kind={importing.kind}
          initialFile={importing.file}
          onClose={() => setImporting(null)}
          onTemplate={(k) => template(k, false)}
          onSwitchKind={(kind, file) => setImporting({ kind, file })}
        />
      )}
      {contractOpen && <ContractModal onClose={() => setContractOpen(false)} />}
      <Modal
        open={confirmDemo}
        onClose={() => setConfirmDemo(false)}
        title="Replace your data with the demo MSP?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDemo(false)}>
              Cancel
            </Button>
            <Button onClick={loadDemo}>Load demo data</Button>
          </>
        }
      >
        <p className="text-body text-ink-2">This clears everything in {workspace?.name} (clients, uploads, opportunities and tasks) and loads Northlight IT, a fictional MSP with 15 clients.</p>
      </Modal>
      <Modal
        open={confirmReset}
        onClose={() => !clearing && setConfirmReset(false)}
        title="Clear all data?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)} disabled={clearing}>
              Cancel
            </Button>
            <Button variant="danger" onClick={clearAll} loading={clearing}>
              Clear data
            </Button>
          </>
        }
      >
        <p className="text-body text-ink-2">
          This removes every client, upload, opportunity, task and report in {workspace?.name}, and any stored contract files. It can't be undone.
        </p>
      </Modal>
    </>
  )
}
