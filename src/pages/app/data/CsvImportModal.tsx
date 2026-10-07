import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { Check, CheckCircle2, Download, FileSpreadsheet, Minus } from 'lucide-react'
import { useStore } from '../../../data/store'
import { Button, Modal, cx } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { applyMapping, autoMap, SCHEMAS, suggestKind, validateRows, type CsvKind, type ImportResult } from '../../../data/importers'
import { mapError } from '../../../lib/errors'
import { num, plural } from '../../../lib/format'
import { ICONS } from '../../../brand/icons'
import { Callout, Dropzone, Select, Steps } from './kit'
import { SOURCES } from './sources'

const STEPS = ['Choose file', 'Map columns', 'Imported']
const MAX_BYTES = 25 * 1024 * 1024
// Local mode keeps everything in browser storage, which runs out well before a
// server would. Roughly what fits for one export.
const LOCAL_ROW_LIMIT = 6000

// A CSV is text. A NUL byte, or more than one byte in ten that isn't printable
// (tabs and line breaks aside), means a spreadsheet, PDF or other binary file.
// Bytes from 0x80 up are UTF-8 (a £ sign, say), so they count as text.
function looksBinary(head: Uint8Array) {
  if (!head.length) return false
  let odd = 0
  for (const b of head) {
    if (b === 0) return true
    if ((b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) || b === 0x7f) odd++
  }
  return odd / head.length > 0.1
}

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export function CsvImportModal({
  kind,
  onClose,
  onTemplate,
  onSwitchKind,
  initialFile,
}: {
  kind: CsvKind
  onClose: () => void
  onTemplate: (kind: CsvKind) => void
  // Restart the import as another kind, keeping the chosen file.
  onSwitchKind?: (kind: CsvKind, file: File) => void
  initialFile?: File
}) {
  const schema = SCHEMAS[kind]
  const { importCsv, data, backend } = useStore()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [remembered, setRemembered] = useState(false)
  const [suggest, setSuggest] = useState<CsvKind | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)

  // The newest earlier upload of this kind, for its column choices.
  const lastMapping = [...data.uploads].filter((u) => u.kind === kind && u.mapping).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0]?.mapping

  const onFile = async (f: File) => {
    setParseError(null)
    setImportError(null)
    setSuggest(null)
    if (/\.xlsx?$/i.test(f.name)) return setParseError("Excel files aren't supported yet. In Excel choose File › Save As › CSV (UTF-8), then upload that file.")
    if (!/\.(csv|txt)$/i.test(f.name) && f.type !== 'text/csv') return setParseError("This doesn't look like a CSV export. Export the report as CSV from your PSA and try again.")
    if (f.size > MAX_BYTES) return setParseError('This file is over 25 MB. Split it into smaller exports.')
    try {
      if (looksBinary(new Uint8Array(await f.slice(0, 1024).arrayBuffer())))
        return setParseError("This doesn't look like a CSV export. Export the report as CSV from your PSA and try again.")
    } catch (e) {
      return setParseError(mapError(e, 'import'))
    }
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const hs = (res.meta.fields ?? []).filter(Boolean)
        if (!hs.length || !res.data.length) return setParseError('No rows found. Check the file has a header row and data.')
        const auto = autoMap(hs, kind)
        // Columns chosen last time win where the file still has them, so a
        // monthly export maps itself.
        const next = { ...auto }
        let reused = false
        const keys = new Set(schema.fields.map((x) => x.key))
        for (const [field, col] of Object.entries(lastMapping ?? {})) {
          if (!col || !keys.has(field) || !hs.includes(col)) continue
          for (const [other, c] of Object.entries(next)) if (c === col && other !== field) delete next[other]
          if (next[field] !== col) reused = true
          next[field] = col
        }
        setFile(f)
        setHeaders(hs)
        setRows(res.data)
        setMapping(next)
        setRemembered(reused)
        // A file in the wrong slot: another export's columns match it better.
        setSuggest(suggestKind(hs, kind))
      },
      error: (err) => setParseError(mapError(err, 'import')),
    })
  }

  // A file handed over from another slot is read straight away.
  const handed = useRef(false)
  useEffect(() => {
    if (!initialFile || handed.current) return
    handed.current = true
    void onFile(initialFile)
  })

  const mapped = useMemo(() => applyMapping(rows, mapping), [rows, mapping])
  const errors = useMemo(() => (rows.length ? validateRows(kind, mapped) : []), [kind, mapped, rows.length])
  const missingRequired = schema.fields.filter((f) => f.required && !mapping[f.key])
  const skipped = new Set(errors.map((e) => e.row)).size
  const mappedCount = schema.fields.filter((f) => mapping[f.key]).length

  const existing = { clients: data.clients, tickets: data.tickets, time_entries: data.time_entries, assets: data.assets, billing: data.billing_items }[kind].length
  const overLimit = backend.mode === 'local' && rows.length + existing > LOCAL_ROW_LIMIT
  const previous = file ? [...data.uploads].filter((u) => u.kind === kind && u.file_name === file.name).sort((a, b) => (a.created_at < b.created_at ? 1 : -1))[0] : undefined

  const doImport = async () => {
    setImporting(true)
    setImportError(null)
    try {
      const res = await importCsv(kind, file!.name, mapped, mapping)
      setResult(res)
      const what = schema.title.toLowerCase()
      toast(
        res.updated === 0
          ? `Imported ${plural(res.imported, 'row')} of ${what}.`
          : res.added === 0
            ? `Updated ${plural(res.updated, 'row')} of ${what}. Nothing was duplicated.`
            : `Imported ${plural(res.imported, 'row')} of ${what}, ${num(res.updated)} of them updates.`,
      )
    } catch (e) {
      const message = mapError(e, 'import')
      setImportError(message)
      toast(message, 'error')
    } finally {
      setImporting(false)
    }
  }

  const step = result ? 3 : file ? 2 : 1
  const required = schema.fields.filter((f) => f.required)
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
            <Button onClick={doImport} loading={importing} disabled={missingRequired.length > 0 || errors.length === rows.length || overLimit}>
              Import {plural(rows.length - skipped, 'row')}
            </Button>
          </>
        ) : step === 3 ? (
          <Button onClick={onClose}>Done</Button>
        ) : undefined
      }
    >
      <div className="mb-6">
        <Steps steps={STEPS} current={step} />
      </div>

      {step === 1 && (
        <div className="space-y-5">
          <div>
            <p className="text-body text-ink-2">{schema.description}</p>
            <p className="mt-1 text-small text-ink-3">{SOURCES[kind].from}.</p>
          </div>
          <Dropzone
            accept=".csv,text/csv"
            onFile={(f) => void onFile(f)}
            label={`Upload ${schema.title} CSV`}
            hint={backend.mode === 'supabase' ? 'CSV with a header row, up to 25 MB' : 'CSV with a header row'}
          />
          {parseError && (
            <Callout tone="danger" alert>
              {parseError}
            </Callout>
          )}
          <div className="flex flex-col gap-3 border-t border-line-soft pt-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-small text-ink-2">
                Needs {required.length === 1 ? 'a column' : 'columns'} for{' '}
                {required.map((f, i) => (
                  <span key={f.key}>
                    {i > 0 && (i === required.length - 1 ? ' and ' : ', ')}
                    <span className="font-medium text-ink">{f.label}</span>
                  </span>
                ))}
                .
              </p>
              <p className="mt-1 text-caption text-ink-3">Column names don't need to match exactly. You'll map them on the next step.</p>
            </div>
            <Button variant="ghost" size="sm" className="-ml-2 self-start sm:ml-0" onClick={() => onTemplate(kind)}>
              <Download className="size-4 shrink-0" aria-hidden /> Download template
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-raised text-ink-2">
                <FileSpreadsheet className="size-4 shrink-0" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-body font-medium text-ink">{file!.name}</p>
                <p className="tnum text-caption text-ink-3">
                  {plural(rows.length, 'row')}, {plural(headers.length, 'column')}
                </p>
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="tnum text-small text-ink-3">
                <span className="font-medium text-ink">{mappedCount}</span> of {schema.fields.length} fields mapped
              </p>
              {remembered && <p className="mt-0.5 text-caption text-ink-3">Columns matched as in your last upload</p>}
            </div>
          </div>

          {suggest && onSwitchKind && (
            <Callout tone="info" title={`This looks like a ${SCHEMAS[suggest].title} export.`}>
              <p>Its columns match the {SCHEMAS[suggest].title.toLowerCase()} export better than {schema.title.toLowerCase()}.</p>
              <Button size="sm" variant="secondary" className="mt-2.5" onClick={() => onSwitchKind(suggest, file!)}>
                Import as {SCHEMAS[suggest].title.toLowerCase()}
              </Button>
            </Callout>
          )}
          {previous && (
            <Callout tone="info">
              You uploaded {previous.file_name} on {day(previous.created_at)}. Rows already imported will be updated, not duplicated.
            </Callout>
          )}

          <div className="overflow-hidden rounded-lg border border-line">
            <div className="hidden grid-cols-[1.25rem_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-x-4 border-b border-line-soft bg-sunken px-4 py-2 sm:grid" aria-hidden>
              <span />
              <span className="text-label uppercase text-ink-3">Headroom field</span>
              <span className="text-label uppercase text-ink-3">Your column</span>
              <span className="text-label uppercase text-ink-3">Preview</span>
            </div>
            <ul className="divide-y divide-line-soft">
              {schema.fields.map((fd) => {
                const col = mapping[fd.key]
                const missing = fd.required && !col
                const samples = col ? rows.slice(0, 3).map((r) => r[col]).filter(Boolean) : []
                return (
                  <li key={fd.key} className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[1.25rem_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)] sm:items-center sm:gap-x-4">
                    <span className="flex h-5 items-center sm:h-auto" aria-hidden>
                      {col ? <Check className="size-4 text-success" /> : missing ? <ICONS.alerts className="size-4 text-warning" /> : <Minus className="size-4 text-ink-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-small font-medium text-ink">
                        {fd.label}
                        <span className={cx('ml-2 text-caption font-normal', missing ? 'text-warning' : 'text-ink-3')}>{fd.required ? 'Required' : 'Optional'}</span>
                      </p>
                      {fd.help && <p className="mt-0.5 text-caption text-ink-3">{fd.help}</p>}
                    </div>
                    <Select
                      className="col-start-2 sm:col-start-auto"
                      value={col ?? ''}
                      invalid={missing}
                      onChange={(e) => setMapping({ ...mapping, [fd.key]: e.target.value })}
                      aria-label={`Column for ${fd.label}`}
                    >
                      <option value="">Not mapped</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </Select>
                    <div className="col-start-2 min-w-0 sm:col-start-auto">
                      {samples.length ? (
                        <p className="truncate text-caption text-ink-2" title={samples.join(', ')}>
                          {samples.map((v, i) => (
                            <span key={i}>
                              {i > 0 && <span className="text-ink-4">, </span>}
                              <span className="tnum">{v}</span>
                            </span>
                          ))}
                        </p>
                      ) : (
                        <p className="hidden text-caption text-ink-3 sm:block">{col ? 'Empty in the first rows' : 'No column chosen'}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {missingRequired.length > 0 && (
            <Callout tone="warning" title={<>Map the required fields: {missingRequired.map((f) => f.label).join(', ')}.</>}>
              Choose the column in your file that holds each one. Rows can't be imported without them.
            </Callout>
          )}
          {missingRequired.length === 0 && errors.length > 0 && (
            <Callout tone="warning" title={<>{plural(skipped, 'row')} will be skipped:</>}>
              <ul className="space-y-0.5">
                {errors.slice(0, 4).map((e, i) => (
                  <li key={i}>
                    <span className="tnum text-ink-2">Row {e.row}:</span> {e.message}
                  </li>
                ))}
                {errors.length > 4 && <li className="text-ink-2">and {errors.length - 4} more</li>}
              </ul>
            </Callout>
          )}
          {missingRequired.length === 0 && errors.length === 0 && (
            <p className="flex items-center gap-2 text-small font-medium text-success">
              <CheckCircle2 className="size-4 shrink-0" aria-hidden /> All {plural(rows.length, 'row')} look valid.
            </p>
          )}
          {overLimit && (
            <Callout tone="danger" alert>
              This browser can hold about {num(LOCAL_ROW_LIMIT)} rows of each export in evaluation mode. Use an account to analyse larger exports.
            </Callout>
          )}
          {importError && (
            <Callout tone="danger" alert>
              {importError}
            </Callout>
          )}
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success ring-1 ring-inset ring-success-line">
              <Check className="size-4 shrink-0" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-h3 text-ink">
                {result.updated === 0
                  ? `Imported ${plural(result.imported, 'row')}.`
                  : `Imported ${plural(result.imported, 'row')} (${num(result.updated)} already imported ${result.updated === 1 ? 'was' : 'were'} updated).`}
              </p>
              <p className="mt-0.5 truncate text-small text-ink-3">
                From {file?.name} into {schema.title.toLowerCase()}
              </p>
            </div>
          </div>
          {result.errors.length > 0 && <p className="tnum text-small text-ink-2">{plural(new Set(result.errors.map((e) => e.row)).size, 'row')} skipped because of errors.</p>}
          {result.warnings
            .filter((w) => !/already imported/.test(w))
            .map((w) => (
            <Callout key={w} tone="warning">
              {w}
            </Callout>
          ))}
          <p className="border-t border-line-soft pt-4 text-small text-ink-3">Upload anything else you have, then run the analysis.</p>
        </div>
      )}
    </Modal>
  )
}
