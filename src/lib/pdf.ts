// PDF text extraction (contracts / SOWs) and simple PDF generation for the
// sample contract download. Both libraries are loaded on demand.
import { AppError } from './errors'

// Contract upload limits, enforced here so every caller gets them. The
// hosted bucket enforces the same size and types server-side (migration
// 20261008000100); the contracts table caps stored text at 1,000,000
// characters.
export const CONTRACT_MAX_BYTES = 20 * 1024 * 1024
export const CONTRACT_MAX_PAGES = 500
export const CONTRACT_MAX_CHARS = 1_000_000

// A file the contract screen may read: a PDF (checked by its first bytes, not
// its name) or plain text, within the size limit. Returns the kind, or throws
// an AppError whose message is safe to show.
export async function checkContractFile(file: File): Promise<'pdf' | 'text'> {
  if (file.size === 0) throw new AppError('This file is empty.', { code: 'file_empty' })
  if (file.size > CONTRACT_MAX_BYTES) throw new AppError('This file is over 20 MB. Upload a smaller copy or just the schedule that covers scope.', { code: 'file_too_large', status: 413 })
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  // "%PDF-" may follow a little junk at the start; readers allow 1 KB.
  const isPdf = new TextDecoder('latin1').decode(head).includes('%PDF-')
  if (isPdf) return 'pdf'
  const namedPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
  if (namedPdf) throw new AppError("This file is named as a PDF but isn't one. Export the contract as a PDF again, or paste its text.", { code: 'not_pdf' })
  const namedText = /\.txt$/i.test(file.name) || file.type === 'text/plain'
  if (!namedText || head.includes(0)) throw new AppError('Upload the contract as a PDF, or as a .txt file.', { code: 'unsupported_type' })
  return 'text'
}

// Reads the text of a contract file (PDF or .txt) after checking it.
export async function readContractFile(file: File): Promise<string> {
  const kind = await checkContractFile(file)
  const text = kind === 'pdf' ? await extractPdfText(file) : await file.text()
  return limitText(text)
}

const TOO_LONG = () =>
  new AppError('This contract has more text than Headroom can store (about 500 pages). Upload just the schedules that cover scope and pricing.', { code: 'text_too_long' })

function limitText(text: string): string {
  if (text.length > CONTRACT_MAX_CHARS) throw TOO_LONG()
  return text
}

export async function extractPdfText(file: File): Promise<string> {
  if (file.size > CONTRACT_MAX_BYTES) throw new AppError('This file is over 20 MB. Upload a smaller copy or just the schedule that covers scope.', { code: 'file_too_large', status: 413 })
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  // pdf.js 6 no longer compiles font code with eval (the CVE-2024-4367 class
  // of bug), and the site's Content Security Policy would block it anyway.
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), enableXfa: false })
  const doc = await task.promise
  try {
    if (doc.numPages > CONTRACT_MAX_PAGES) throw new AppError(`This PDF has ${doc.numPages} pages. Upload just the schedules that cover scope and pricing (up to ${CONTRACT_MAX_PAGES} pages).`, { code: 'too_many_pages' })
    const pages: string[] = []
    let chars = 0
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      const text = content.items
        .map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : ''))
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
      chars += text.length
      if (chars > CONTRACT_MAX_CHARS) throw TOO_LONG()
      pages.push(text)
    }
    const text = pages.join('\n\n').trim()
    if (text.replace(/\s/g, '').length < 40) throw new AppError("We couldn't find any text in this PDF. It may be a scanned image; export it as a text PDF or paste the text instead.", { code: 'no_text' })
    return text
  } finally {
    void task.destroy()
  }
}

export async function textToPdf(title: string, text: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margin = 56
  const width = doc.internal.pageSize.getWidth() - margin * 2
  let y = margin
  doc.setFont('helvetica', 'bold').setFontSize(14).text(title, margin, y)
  y += 28
  doc.setFont('helvetica', 'normal').setFontSize(10)
  for (const para of text.split(/\n{2,}/)) {
    const isHeading = /^(\d+\.\s+[A-Z][a-z]+|[A-Z ]{6,})$/.test(para.trim())
    doc.setFont('helvetica', isHeading ? 'bold' : 'normal')
    for (const line of doc.splitTextToSize(para, width) as string[]) {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage()
        y = margin
      }
      doc.text(line, margin, y)
      y += 14
    }
    y += 8
  }
  return doc.output('blob')
}
