import { describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import { jsPDF } from 'jspdf'
import { extractPdfText, readContractFile } from './pdf'
import { normaliseContractText } from '../data/store'
import { clauseCitation, extractClauses } from '../engine/contractTerms'

// In the browser Vite serves pdf.js's worker by URL. Under Node, use pdf.js's
// Node build and point the same import at its worker file on disk; the page
// joining under test is Headroom's own code either way.
vi.mock('pdfjs-dist', () => import('pdfjs-dist/legacy/build/pdf.mjs'))
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: fileURLToPath(import.meta.resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')) }))

// A two-page agreement: the exclusion is on page 2.
function twoPagePdf(): File {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  doc.text('1. Scope', 56, 60)
  doc.text('1.1 Remote support is provided for the Client.', 56, 80)
  doc.addPage()
  doc.text('2. Exclusions', 56, 60)
  doc.text('2.3 Personal devices are excluded.', 56, 80)
  const bytes = doc.output('arraybuffer')
  return new File([bytes], 'agreement.pdf', { type: 'application/pdf' })
}

describe('PDF contract text keeps page numbers end to end', () => {
  it('joins pages with a form feed', async () => {
    const text = await extractPdfText(twoPagePdf())
    expect(text.split('\f')).toHaveLength(2)
    expect(text.split('\f')[1]).toContain('Personal devices are excluded')
  })

  it('cites the clause by section and page after the store normalises the text', async () => {
    const stored = normaliseContractText(await readContractFile(twoPagePdf()))
    expect(stored).toContain('\f')
    const clause = extractClauses(stored, { id: 'c1', title: 'Managed Services Agreement' }).find((c) => c.type === 'company_devices_only')!
    expect(clause).toMatchObject({ section: '2.3', page: 2 })
    expect(clauseCitation(clause)).toBe('Managed Services Agreement, section 2.3, page 2')
  })
})
