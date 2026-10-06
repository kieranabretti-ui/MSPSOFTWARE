// Brand pieces for jsPDF documents: the Host Grotesk faces and the Headroom
// mark drawn as vectors. Loaded on demand by the report builder, so the fonts
// stay out of the app bundle until someone downloads a PDF.
import type { jsPDF } from 'jspdf'
import regularTtf from '../assets/fonts/HostGrotesk-400.ttf?inline'
import boldTtf from '../assets/fonts/HostGrotesk-600.ttf?inline'
import { color, rgb } from '../brand/tokens'

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

// The Headroom mark, drawn from the placeholder LogoMark in src/brand/Logo.tsx
// (a 32-unit square). `on` is the ground it sits on: on ink the tile is bone,
// on paper it inverts to an ink tile. The recovery chip is lime in both, as it
// always sits on ink or a bar, never on white. Replace the body of this
// function when the final mark lands; callers only pass position and size.
export function drawMark(doc: jsPDF, x: number, y: number, size: number, on: 'ink' | 'paper' = 'ink') {
  const s = size / 32
  const tile = rgb(on === 'ink' ? color.bone : color.ink)
  const bar = rgb(on === 'ink' ? color.ink : color.bone)
  const chip = rgb(color.accent)
  doc.saveGraphicsState()
  doc.setFillColor(...tile).roundedRect(x, y, size, size, 8 * s, 8 * s, 'F')
  doc.setFillColor(...bar)
  doc.roundedRect(x + 8 * s, y + 9 * s, 16 * s, 4 * s, s, s, 'F')
  doc.roundedRect(x + 8 * s, y + 19 * s, 9 * s, 4 * s, s, s, 'F')
  doc.setFillColor(...chip).setDrawColor(...bar).setLineWidth(1.2 * s)
  doc.roundedRect(x + 19 * s, y + 19 * s, 5 * s, 4 * s, s, s, 'FD')
  doc.restoreGraphicsState()
}
