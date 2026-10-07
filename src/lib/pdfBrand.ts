// Brand pieces for jsPDF documents: the Host Grotesk faces and the Headroom
// mark drawn as vectors. Loaded on demand by the report builder, so the fonts
// stay out of the app bundle until someone downloads a PDF.
import type { jsPDF } from 'jspdf'
import regularTtf from '../assets/fonts/HostGrotesk-400.ttf?inline'
import boldTtf from '../assets/fonts/HostGrotesk-600.ttf?inline'
import { color, paper, rgb } from '../brand/tokens'

export const PDF_FONT = 'HostGrotesk'

const base64 = (dataUrl: string) => dataUrl.slice(dataUrl.indexOf(',') + 1)

// Registers Host Grotesk as PDF_FONT ('normal' is 400, 'bold' is 600) and
// returns the family to use. Falls back to Helvetica if the faces cannot be
// read, so a PDF is always produced.
export function registerFonts(doc: jsPDF): string {
  try {
    doc.addFileToVFS('HostGrotesk-400.ttf', base64(regularTtf))
    doc.addFont('HostGrotesk-400.ttf', PDF_FONT, 'normal')
    doc.addFileToVFS('HostGrotesk-600.ttf', base64(boldTtf))
    doc.addFont('HostGrotesk-600.ttf', PDF_FONT, 'bold')
    doc.setFont(PDF_FONT, 'normal')
    return PDF_FONT
  } catch {
    doc.setFont('helvetica', 'normal')
    return 'helvetica'
  }
}

// The Headroom mark as vectors, from the same geometry as LogoMark in
// src/brand/Logo.tsx: a square on a 32-unit grid with its top-right quarter
// lifted clear. Each outline is a list of straight runs ('L') and quarter
// arcs ('A', given by the corner they round and the point they end on).
type Step = ['L', number, number] | ['A', number, number, number, number]
const BODY: { from: [number, number]; steps: Step[] } = {
  from: [9, 8],
  steps: [['L', 13, 8], ['A', 14, 8, 14, 9], ['L', 14, 19], ['A', 14, 20, 15, 20], ['L', 25, 20], ['A', 26, 20, 26, 21], ['L', 26, 25], ['A', 26, 28, 23, 28], ['L', 9, 28], ['A', 6, 28, 6, 25], ['L', 6, 11], ['A', 6, 8, 9, 8]],
}
const PIECE: { from: [number, number]; steps: Step[] } = {
  from: [17, 4],
  steps: [['L', 23, 4], ['A', 26, 4, 26, 7], ['L', 26, 13], ['A', 26, 14, 25, 14], ['L', 17, 14], ['A', 16, 14, 16, 13], ['L', 16, 5], ['A', 16, 4, 17, 4]],
}
// Control-point distance for a quarter circle drawn as one cubic Bézier.
const K = 0.5523

function outline(doc: jsPDF, shape: typeof BODY, x: number, y: number, s: number) {
  let [px, py] = shape.from
  const segs: number[][] = []
  for (const step of shape.steps) {
    if (step[0] === 'L') {
      segs.push([(step[1] - px) * s, (step[2] - py) * s])
      ;[px, py] = [step[1], step[2]]
    } else {
      const [, cx, cy, ex, ey] = step
      const c1 = [px + K * (cx - px), py + K * (cy - py)]
      const c2 = [ex + K * (cx - ex), ey + K * (cy - ey)]
      segs.push([(c1[0] - px) * s, (c1[1] - py) * s, (c2[0] - px) * s, (c2[1] - py) * s, (ex - px) * s, (ey - py) * s])
      ;[px, py] = [ex, ey]
    }
  }
  doc.lines(segs, x + (shape.from[0] - 6) * s, y + (shape.from[1] - 4) * s, [1, 1], 'F', true)
}

// Draws the bare mark with its top-left at (x, y), `height` tall and 5/6 as
// wide. Set `height` to the wordmark's font size and the mark's foot to its
// baseline, with a gap of 0.3 × the font size, to match the lockup. `on` is
// the ground: on ink the body is bone and the piece lime; on paper the body
// is ink and the piece the deeper paper lime.
export function drawMark(doc: jsPDF, x: number, y: number, height: number, on: 'ink' | 'paper' = 'ink') {
  const s = height / 24
  doc.saveGraphicsState()
  doc.setFillColor(...rgb(on === 'ink' ? color.bone : paper.mark))
  outline(doc, BODY, x, y, s)
  doc.setFillColor(...rgb(on === 'ink' ? color.accent : paper.markAccent))
  outline(doc, PIECE, x, y, s)
  doc.restoreGraphicsState()
}

// Width of the mark plus the lockup gap, for placing the wordmark after it.
export const markAdvance = (height: number) => height * (20 / 24) + height * 0.3
