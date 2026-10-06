import { useMemo, useRef, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import { AlertTriangle, CheckCircle2, Database, FileText, FileUp, Play, Plus, RotateCcw, Upload as UploadIcon } from 'lucide-react'
import { useStore } from '../../data/store'
import { Badge, Button, Card, CardHeader, Field, Modal, PageHeader, cx, inputCls } from '../../components/ui'
import { useToast } from '../../components/toast'
import { applyMapping, autoMap, KIND_ORDER, SCHEMAS, validateRows, type CsvKind, type ImportResult } from '../../data/importers'
import { downloadFile, num, plural, relative, toCsv } from '../../lib/format'
import { extractClauses, CLAUSE_LABELS } from '../../engine/contractTerms'
import { AddClientModal } from './Clients'

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

function Dropzone({ accept, onFile, label }: { accept: string; onFile: (f: File) => void; label: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => ref.current?.click()}
      className={cx('flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition', over ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong')}
    >
      <FileUp className="mb-3 size-6 text-ink-3" />
      <p className="text-body font-medium">{label}</p>
      <p className="mt-1 text-caption text-ink-3">Drag and drop, or click to browse</p>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function CsvImportModal({ kind, onClose }: { kind: CsvKind; onClose: () => void }) {
  const schema = SCHEMAS[kind]
  const { importCsv } = useStore()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [parseError, setParseError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)

  const onFile = (f: File) => {
    setParseError(null)
    if (!/\.(csv|txt)$/i.test(f.name) && f.type !== 'text/csv') return setParseError('Please choose a .csv file.')
    if (f.size > 25 * 1024 * 1024) return setParseError('This file is over 25 MB. Split it into smaller exports.')
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const hs = (res.meta.fields ?? []).filter(Boolean)
        if (!hs.length || !res.data.length) return setParseError('No rows found. Check the file has a header row and data.')
        setFile(f)
        setHeaders(hs)
        setRows(res.data)
        setMapping(autoMap(hs, kind))
      },
      error: (err) => setParseError(`Could not read the file: ${err.message}`),
    })
  }

  const mapped = useMemo(() => applyMapping(rows, mapping), [rows, mapping])
  const errors = useMemo(() => (rows.length ? validateRows(kind, mapped) : []), [kind, mapped, rows.length])
  const missingRequired = schema.fields.filter((f) => f.required && !mapping[f.key])

  const doImport = async () => {
    setImporting(true)
    try {
      const res = await importCsv(kind, file!.name, mapped, mapping)
      setResult(res)
      toast(`Imported ${plural(res.imported, 'row')} of ${schema.title.toLowerCase()}.`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Import failed.', 'error')
    } finally {
      setImporting(false)
    }
  }

  const step = result ? 3 : file ? 2 : 1
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`Import ${schema.title.toLowerCase()}`}
      footer={
        step === 2 ? (
          <>
            <Button variant="secondary" onClick={() => setFile(null)}>
              Choose another file
            </Button>
            <Button onClick={doImport} loading={importing} disabled={missingRequired.length > 0 || errors.length === rows.length}>
              Import {plural(rows.length - new Set(errors.map((e) => e.row)).size, 'row')}
            </Button>
          </>
        ) : step === 3 ? (
          <Button onClick={onClose}>Done</Button>
        ) : undefined
      }
    >
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-body text-ink-2">{schema.description}</p>
          <Dropzone accept=".csv,text/csv" onFile={onFile} label={`Upload ${schema.title} CSV`} />
          {parseError && <p className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">{parseError}</p>}
          <p className="text-caption text-ink-3">Column names don't need to match exactly. You'll map them on the next step.</p>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <p className="text-body text-ink-2">
            <span className="font-medium text-ink">{file!.name}</span> · {plural(rows.length, 'row')}, {plural(headers.length, 'column')}. Match your columns to the fields Headroom uses.
          </p>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-body">
              <thead>
                <tr className="bg-sunken text-left text-caption text-ink-3">
                  <th className="px-4 py-2 font-medium">Headroom field</th>
                  <th className="px-4 py-2 font-medium">Your column</th>
                  <th className="hidden px-4 py-2 font-medium sm:table-cell">Sample</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {schema.fields.map((fd) => (
                  <tr key={fd.key}>
                    <td className="px-4 py-2">
                      <span className="font-medium">{fd.label}</span>
                      {fd.required ? <span className="ml-1 text-danger">*</span> : <span className="ml-1.5 text-caption text-ink-3">optional</span>}
                      {fd.help && <span className="block text-caption text-ink-3">{fd.help}</span>}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className={cx(inputCls, 'h-8 text-small', fd.required && !mapping[fd.key] && 'border-danger-line')}
                        value={mapping[fd.key] ?? ''}
                        onChange={(e) => setMapping({ ...mapping, [fd.key]: e.target.value })}
                        aria-label={`Column for ${fd.label}`}
                      >
                        <option value="">— Not mapped —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="hidden max-w-[200px] truncate px-4 py-2 text-caption text-ink-3 sm:table-cell">{mapping[fd.key] ? rows.slice(0, 2).map((r) => r[mapping[fd.key]]).filter(Boolean).join(', ') : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {missingRequired.length > 0 && <p className="rounded-md bg-warning-soft px-3 py-2 text-body text-warning">Map the required fields: {missingRequired.map((f) => f.label).join(', ')}.</p>}
          {missingRequired.length === 0 && errors.length > 0 && (
            <div className="rounded-md bg-warning-soft px-3 py-2 text-body text-warning">
              <p className="font-medium">
                {plural(new Set(errors.map((e) => e.row)).size, 'row')} will be skipped:
              </p>
              <ul className="mt-1 list-disc pl-5 text-small">
                {errors.slice(0, 4).map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
                {errors.length > 4 && <li>and {errors.length - 4} more</li>}
              </ul>
            </div>
          )}
          {missingRequired.length === 0 && errors.length === 0 && (
            <p className="flex items-center gap-2 text-body text-success">
              <CheckCircle2 className="size-4" /> All {plural(rows.length, 'row')} look valid.
            </p>
          )}
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-3 text-body">
          <p className="flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="size-4" /> Imported {plural(result.imported, 'row')}.
          </p>
          {result.errors.length > 0 && <p className="text-ink-2">{plural(new Set(result.errors.map((e) => e.row)).size, 'row')} skipped because of errors.</p>}
          {result.warnings.map((w) => (
            <p key={w} className="flex gap-2 rounded-md bg-warning-soft px-3 py-2 text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {w}
            </p>
          ))}
          <p className="text-ink-2">Run the analysis when you've uploaded everything.</p>
        </div>
      )}
    </Modal>
  )
}

function ContractModal({ onClose }: { onClose: () => void }) {
  const { data, addContract } = useStore()
  const toast = useToast()
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [adding, setAdding] = useState(false)
  const clauses = useMemo(() => (text ? extractClauses(text) : []), [text])

  const onFile = async (f: File) => {
    setError(null)
    if (f.size > 20 * 1024 * 1024) return setError('This PDF is over 20 MB.')
    setExtracting(true)
    try {
      const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf'
      if (!isPdf && !/\.txt$/i.test(f.name)) throw new Error('Upload a PDF (or a .txt file).')
      const { extractPdfText } = await import('../../lib/pdf')
      const t = isPdf ? await extractPdfText(f) : await f.text()
      setText(t)
      setFile(f)
      if (!title) setTitle(f.name.replace(/\.(pdf|txt)$/i, '').replace(/[_-]+/g, ' '))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read this file.')
    } finally {
      setExtracting(false)
    }
  }

  const save = async () => {
    if (!clientId) return setError('Choose which client this contract belongs to.')
    if (text.trim().length < 40) return setError('The contract text is empty.')
    try {
      await addContract(clientId, title.trim() || 'Contract', text, file)
      toast('Contract saved. Re-run the analysis to check tickets against it.')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the contract.')
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="Upload contract, SOW or service agreement"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!text}>
            Save contract
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field label="Client">
                <select className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                  <option value="">Choose a client…</option>
                  {[...data.clients]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <Button variant="secondary" type="button" onClick={() => setAdding(true)} title="Add a new client" aria-label="Add a new client">
              <Plus className="size-4" />
            </Button>
          </div>
          <Field label="Title">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Managed Services Agreement" />
          </Field>
        </div>
        {!text ? (
          <>
            <Dropzone accept=".pdf,application/pdf,.txt" onFile={onFile} label={extracting ? 'Extracting text…' : 'Upload contract PDF'} />
            <p className="text-caption text-ink-3">We extract the text to check scope clauses such as company-owned devices only, project work exclusions and support hours. Original files are stored privately.</p>
          </>
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-small font-medium text-ink-2">Extracted text</span>
                <button className="text-caption text-ink-3 hover:text-ink" onClick={() => (setText(''), setFile(null))}>
                  Replace file
                </button>
              </div>
              <textarea className={cx(inputCls, 'h-48 py-2 font-mono text-caption leading-relaxed')} value={text} onChange={(e) => setText(e.target.value)} aria-label="Contract text" />
            </div>
            <div>
              <p className="mb-1.5 text-small font-medium text-ink-2">Scope clauses detected</p>
              {clauses.length ? (
                <ul className="space-y-1.5">
                  {clauses.map((c, i) => (
                    <li key={i} className="text-body">
                      <Badge tone="info">{CLAUSE_LABELS[c.type]}</Badge> <span className="text-ink-2">“{c.sentence}”</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body text-ink-3">No scope clauses detected. The contract will still be stored, and tickets will be checked for potentially billable work.</p>
              )}
            </div>
          </>
        )}
        {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">{error}</p>}
      </div>
      <AddClientModal open={adding} onClose={() => setAdding(false)} onCreated={setClientId} />
    </Modal>
  )
}

export default function DataPage() {
  const { data, analysis, runAnalysis, loadDemoData, resetData, workspace } = useStore()
  const toast = useToast()
  const nav = useNavigate()
  const [importKind, setImportKind] = useState<CsvKind | null>(null)
  const [contractOpen, setContractOpen] = useState(false)
  const [confirmDemo, setConfirmDemo] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const hasData = data.clients.length > 0 || data.tickets.length > 0
  const stale = analysis && data.uploads.some((u) => u.created_at > analysis.created_at)

  const run = async () => {
    try {
      await runAnalysis()
      toast('Analysis complete.')
      nav('/app')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Analysis failed.', 'error')
    }
  }

  const loadDemo = async () => {
    setConfirmDemo(false)
    try {
      await loadDemoData()
      toast('Demo MSP loaded and analysed.')
      nav('/app')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load demo data.', 'error')
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

  return (
    <>
      <PageHeader
        title="Data"
        subtitle="Upload exports from your PSA, RMM and billing system. No integrations needed."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => (hasData ? setConfirmDemo(true) : loadDemo())}>
              <Database className="size-3.5" /> Load demo data
            </Button>
            <Button size="sm" onClick={run} disabled={!data.clients.length} data-testid="run-analysis">
              <Play className="size-3.5" /> Run analysis
            </Button>
          </>
        }
      />

      <Card className={cx('mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between', stale && 'border-warning-line bg-warning-soft')}>
        <div>
          <p className="text-body font-medium">{analysis ? (stale ? 'New data since the last analysis' : 'Analysis up to date') : hasData ? 'Ready to analyse' : 'No data yet'}</p>
          <p className="text-small text-ink-3">
            {analysis
              ? `Last run ${relative(analysis.created_at)} on ${analysis.summary.period_label}.${stale ? ' Run it again to include your latest uploads.' : ''}`
              : hasData
                ? 'Upload anything else you have, then run the analysis.'
                : 'Start with Clients and Tickets. Time entries, users & devices, billing and contracts make the analysis more complete.'}
          </p>
        </div>
        {(stale || (!analysis && hasData)) && (
          <Button size="sm" onClick={run}>
            <Play className="size-3.5" /> Run analysis
          </Button>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {KIND_ORDER.map((kind) => {
          const s = SCHEMAS[kind]
          const count = data[COUNT_KEY[kind]].length
          return (
            <Card key={kind} className="flex flex-col">
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold">{s.title}</h3>
                  {count > 0 ? <Badge tone="success">{num(count)} rows</Badge> : <Badge>CSV</Badge>}
                </div>
                <p className="mt-1.5 text-small text-ink-3">{s.description}</p>
                <p className="mt-3 text-caption font-medium text-ink-3">Suggested columns</p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {s.fields.map((f) => (
                    <code key={f.key} className={cx('rounded-xs px-1.5 py-0.5 font-mono text-[11px]', f.required ? 'bg-raised text-ink ring-1 ring-inset ring-line-strong' : 'bg-raised text-ink-2')}>
                      {f.key}
                    </code>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-3">
                <Button size="sm" onClick={() => setImportKind(kind)} data-testid={`upload-${kind}`}>
                  <UploadIcon className="size-3.5" /> Upload CSV
                </Button>
                <button className="text-caption text-ink-3 hover:text-ink" onClick={() => template(kind, false)}>
                  Template
                </button>
                <span className="text-ink-4">·</span>
                <button className="text-caption text-ink-3 hover:text-ink" onClick={() => template(kind, true)}>
                  Demo file
                </button>
              </div>
            </Card>
          )
        })}
        <Card className="flex flex-col">
          <div className="flex-1 p-5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold">Contracts & SOWs</h3>
              {data.contracts.length > 0 ? <Badge tone="success">{plural(data.contracts.length, 'contract')}</Badge> : <Badge>PDF</Badge>}
            </div>
            <p className="mt-1.5 text-small text-ink-3">Client contracts, statements of work and service agreements. We read the scope and exclusions so tickets can be checked against them.</p>
            <p className="mt-3 text-caption text-ink-3">Looks for: company-owned devices only, hardware, project and onsite exclusions, support hours, included hours, third-party applications, new user and device setup.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-5 py-3">
            <Button size="sm" onClick={() => setContractOpen(true)} disabled={!data.clients.length} title={!data.clients.length ? 'Add a client first' : undefined}>
              <FileText className="size-3.5" /> Upload PDF
            </Button>
            <button className="text-caption text-ink-3 hover:text-ink" onClick={samplePdf}>
              Sample contract PDF
            </button>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Upload history" right={hasData && <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}><RotateCcw className="size-3.5" /> Clear all data</Button>} />
        {data.uploads.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-body">
              <tbody className="divide-y divide-line-soft">
                {[...data.uploads]
                  .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                  .map((u) => (
                    <tr key={u.id}>
                      <td className="px-5 py-3 font-medium">{u.file_name}</td>
                      <td className="px-3 py-3 text-ink-2">{u.kind === 'contract' ? 'Contract' : SCHEMAS[u.kind].title}</td>
                      <td className="tnum px-3 py-3 text-ink-2">{plural(u.row_count, u.kind === 'contract' ? 'document' : 'row')}</td>
                      <td className="px-3 py-3">{u.warnings.length ? <span title={u.warnings.join('\n')}><Badge tone="warning">{plural(u.warnings.length, 'warning')}</Badge></span> : <Badge tone="success">Imported</Badge>}</td>
                      <td className="px-5 py-3 text-right text-caption text-ink-3">{relative(u.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-6 text-body text-ink-3">Nothing uploaded yet.</p>
        )}
      </Card>

      {importKind && <CsvImportModal kind={importKind} onClose={() => setImportKind(null)} />}
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
        <p className="text-body text-ink-2">This clears everything in {workspace?.name} (clients, uploads, findings and actions) and loads Northlight IT, a fictional MSP with 15 clients.</p>
      </Modal>
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Clear all data?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setConfirmReset(false)
                await resetData()
                toast('All data cleared.')
              }}
            >
              Clear data
            </Button>
          </>
        }
      >
        <p className="text-body text-ink-2">This removes every client, upload, finding and action in {workspace?.name}. It can't be undone.</p>
      </Modal>
    </>
  )
}

