import { useMemo, useState } from 'react'
import { FileText, Plus } from 'lucide-react'
import { useStore } from '../../../data/store'
import { Badge, Button, Field, Modal, cx, inputCls } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { extractClauses, CLAUSE_LABELS } from '../../../engine/contractTerms'
import { mapError } from '../../../lib/errors'
import { AddClientModal } from '../Clients'
import { Callout, Dropzone, Select } from './kit'
import { CONTRACT_CHECKS } from './sources'

// Words that stay lower case mid-title, and company suffixes that keep their
// usual form. Any other word of three letters or fewer reads as initials.
const MINOR = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with', '&'])
const SUFFIX: Record<string, string> = { ltd: 'Ltd', plc: 'Plc', llp: 'LLP', llc: 'LLC', inc: 'Inc', co: 'Co', cic: 'CIC' }

// A readable title from a file name: 'abc ltd.pdf' becomes 'ABC Ltd'.
function titleFromFileName(name: string) {
  const words = name
    .replace(/\.(pdf|txt)$/i, '')
    .replace(/[_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  return words
    .map((w, i) => {
      const lower = w.toLowerCase()
      if (SUFFIX[lower]) return SUFFIX[lower]
      if (i > 0 && MINOR.has(lower)) return lower
      const letters = w.replace(/[^a-z]/gi, '')
      if (letters.length > 0 && letters.length <= 3 && !MINOR.has(lower)) return w.toUpperCase()
      // Leave mixed case as typed (McKenzie, iPhone); capitalise the rest.
      if (/[a-z]/.test(w) && /[A-Z]/.test(w.slice(1))) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

export function ContractModal({ onClose }: { onClose: () => void }) {
  const { data, addContract, backend } = useStore()
  const toast = useToast()
  const [clientId, setClientId] = useState('')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const clauses = useMemo(() => (text ? extractClauses(text) : []), [text])

  const onFile = async (f: File) => {
    setError(null)
    if (f.size > 20 * 1024 * 1024) return setError('This PDF is over 20 MB. Upload a smaller copy or just the schedule that covers scope.')
    const isPdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf'
    if (!isPdf && !/\.txt$/i.test(f.name)) return setError('Upload the contract as a PDF, or as a .txt file.')
    setExtracting(true)
    try {
      const { extractPdfText } = await import('../../../lib/pdf')
      const t = isPdf ? await extractPdfText(f) : await f.text()
      // A scanned PDF is a picture of text, so there is nothing to read.
      if (t.trim().length < 40) return setError("We couldn't find any text in this file. If it's a scanned PDF, try a text-based PDF.")
      setText(t)
      setFile(f)
      if (!title) setTitle(titleFromFileName(f.name))
    } catch (e) {
      setError(mapError(e, 'contract'))
    } finally {
      setExtracting(false)
    }
  }

  const save = async () => {
    if (!clientId) return setError('Choose which client this contract belongs to.')
    if (text.trim().length < 40) return setError('The contract text is empty.')
    setSaving(true)
    try {
      await addContract(clientId, title.trim() || 'Contract', text, file)
      toast('Contract saved. Re-run the analysis to check tickets against it.')
      onClose()
    } catch (e) {
      setError(mapError(e, 'save'))
    } finally {
      setSaving(false)
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
          <Button onClick={save} disabled={!text} loading={saving}>
            Save contract
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Client">
                <Select value={clientId} onChange={(e) => setClientId(e.target.value)} invalid={error === 'Choose which client this contract belongs to.' && !clientId}>
                  <option value="">Choose a client…</option>
                  {[...data.clients]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </Select>
              </Field>
            </div>
            <Button variant="secondary" type="button" className="shrink-0" onClick={() => setAdding(true)} title="Add a new client" aria-label="Add a new client">
              <Plus className="size-4 shrink-0" aria-hidden />
            </Button>
          </div>
          <Field label="Title">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Managed Services Agreement" />
          </Field>
        </div>

        {!text ? (
          <div className="space-y-3">
            <Dropzone accept=".pdf,application/pdf,.txt" onFile={onFile} label="Upload contract PDF" busy={extracting} busyLabel="Extracting text…" hint="PDF or plain text, up to 20 MB" />
            <p className="text-caption text-ink-3">
              Headroom reads the scope and exclusions so tickets can be checked against them. It looks for: {CONTRACT_CHECKS.charAt(0).toLowerCase() + CONTRACT_CHECKS.slice(1)}{' '}
              {backend.mode === 'supabase' ? "The original PDF is kept in your workspace's private storage." : 'Only the extracted text is kept, in this browser.'}
            </p>
          </div>
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2 text-small font-medium text-ink-2">
                  <FileText className="size-4 shrink-0 text-ink-3" aria-hidden />
                  <span className="truncate">{file ? file.name : 'Extracted text'}</span>
                </span>
                <button
                  type="button"
                  className="shrink-0 rounded-sm px-1 text-caption font-medium text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline"
                  onClick={() => (setText(''), setFile(null))}
                >
                  Replace file
                </button>
              </div>
              <textarea className={cx(inputCls, 'h-44 resize-y py-2.5 text-small leading-relaxed')} value={text} onChange={(e) => setText(e.target.value)} aria-label="Contract text" />
              <p className="mt-1.5 text-caption text-ink-3">Check the extracted text and correct anything the PDF reader missed. Clauses update as you edit.</p>
            </div>
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h3 className="text-small font-medium text-ink-2">Scope clauses detected</h3>
                <span className="tnum text-caption text-ink-3">{clauses.length}</span>
              </div>
              {clauses.length ? (
                <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line">
                  {clauses.map((c, i) => (
                    <li key={i} className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
                      <span className="shrink-0 sm:w-56">
                        <Badge tone="info">{CLAUSE_LABELS[c.type]}</Badge>
                      </span>
                      <span className="text-small text-ink-2">“{c.sentence}”</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg border border-line px-4 py-3 text-small text-ink-3">No scope clauses detected. The contract will still be stored, and tickets will be checked for potentially billable work.</p>
              )}
            </div>
          </>
        )}
        {error && (
          <Callout tone="danger" alert>
            {error}
          </Callout>
        )}
      </div>
      <AddClientModal open={adding} onClose={() => setAdding(false)} onCreated={setClientId} />
    </Modal>
  )
}
