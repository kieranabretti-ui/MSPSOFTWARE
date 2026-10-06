import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { Check, CheckCircle2, Download, FileSpreadsheet, Minus } from 'lucide-react'
import { useStore } from '../../../data/store'
import { Button, Modal, cx } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { applyMapping, autoMap, SCHEMAS, validateRows, type CsvKind, type ImportResult } from '../../../data/importers'
import { plural } from '../../../lib/format'
import { ICONS } from '../../../brand/icons'
import { Callout, Dropzone, Select, Steps } from './kit'
import { SOURCES } from './sources'

const STEPS = ['Choose file', 'Map columns', 'Imported']

export function CsvImportModal({ kind, onClose, onTemplate }: { kind: CsvKind; onClose: () => void; onTemplate: (kind: CsvKind) => void }) {
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
  const skipped = new Set(errors.map((e) => e.row)).size
  const mappedCount = schema.fields.filter((f) => mapping[f.key]).length

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
            <Button onClick={doImport} loading={importing} disabled={missingRequired.length > 0 || errors.length === rows.length}>
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
          <Dropzone accept=".csv,text/csv" onFile={onFile} label={`Upload ${schema.title} CSV`} hint="CSV with a header row, up to 25 MB" />
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
            <p className="tnum shrink-0 text-small text-ink-3">
              <span className="font-medium text-ink">{mappedCount}</span> of {schema.fields.length} fields mapped
            </p>
          </div>

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
                        <p className="hidden text-caption text-ink-4 sm:block">{col ? 'Empty in the first rows' : 'No column chosen'}</p>
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
        </div>
      )}

      {step === 3 && result && (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success-soft text-success ring-1 ring-inset ring-success-line">
              <Check className="size-4 shrink-0" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-h3 text-ink">Imported {plural(result.imported, 'row')}.</p>
              <p className="mt-0.5 truncate text-small text-ink-3">
                From {file?.name} into {schema.title.toLowerCase()}
              </p>
            </div>
          </div>
          {result.errors.length > 0 && <p className="tnum text-small text-ink-2">{plural(new Set(result.errors.map((e) => e.row)).size, 'row')} skipped because of errors.</p>}
          {result.warnings.map((w) => (
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
