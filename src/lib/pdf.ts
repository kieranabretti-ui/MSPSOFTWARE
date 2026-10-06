// PDF text extraction (contracts / SOWs) and simple PDF generation for the
// sample contract download. Both libraries are loaded on demand.

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(
      content.items
        .map((it) => ('str' in it ? it.str + (it.hasEOL ? '\n' : ' ') : ''))
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/[ \t]{2,}/g, ' '),
    )
  }
  const text = pages.join('\n\n').trim()
  if (text.replace(/\s/g, '').length < 40) throw new Error('No selectable text found in this PDF. It may be a scanned image; export it as a text PDF or paste the text instead.')
  return text
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
