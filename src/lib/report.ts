// One report model, rendered both on screen and as a PDF.
import type { Analysis, ClientMetrics, Finding, Health, Workspace } from '../engine/types'
import type { WorkspaceData } from '../data/backend'
import { CATEGORY_META, HEALTH } from './labels'
import { money, pct, hours, plural } from './format'
import { color, paper, rgb, viz } from '../brand/tokens'

export interface ReportModel {
  title: string
  workspace: string
  period: string
  generated: string
  isDemo: boolean
  total: number
  monthly: number
  annual: number
  /** Agreement revenue over the analysed period: the billed side of the gap. */
  billed: number
  months: number
  findingCount: number
  executiveSummary: string[]
  breakdown: { label: string; count: number; value: number; share: number }[]
  riskClients: { name: string; leakage: number; margin: number; health: string; status: Health; reason: string }[]
  sections: { key: 'OUT_OF_SCOPE' | 'AGREEMENT_DRIFT' | 'UNBILLED_TIME'; title: string; intro: string; value: number; rows: { client: string; title: string; detail: string; confidence: number; value: number }[] }[]
  profitability: (ClientMetrics & { leakage: number })[]
  actions: { client: string; action: string; value: number }[]
  clientName: (id: string) => string
}

export function buildReport(ws: Workspace, analysis: Analysis, data: WorkspaceData): ReportModel {
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name ?? 'Unknown client'
  const live = data.findings.filter((f) => f.status !== 'dismissed')
  const total = live.reduce((a, f) => a + f.estimated_value, 0)
  const monthly = live.reduce((a, f) => a + f.monthly_value, 0)
  const s = analysis.summary
  const leak = new Map<string, number>()
  live.forEach((f) => leak.set(f.client_id, (leak.get(f.client_id) ?? 0) + f.estimated_value))

  const byCat = new Map<string, { count: number; value: number }>()
  live.forEach((f) => {
    const c = byCat.get(f.category) ?? { count: 0, value: 0 }
    c.count++
    c.value += f.estimated_value
    byCat.set(f.category, c)
  })
  const breakdown = [...byCat.entries()]
    .map(([k, v]) => ({ label: CATEGORY_META[k as Finding['category']].label, ...v, share: total ? v.value / total : 0 }))
    .sort((a, b) => b.value - a.value)

  const metrics = s.client_metrics.map((c) => ({ ...c, leakage: leak.get(c.client_id) ?? 0 }))
  const riskClients = [...metrics]
    .filter((c) => c.leakage > 0 || c.health === 'at_risk')
    .sort((a, b) => b.leakage - a.leakage)
    .slice(0, 6)
    .map((c) => ({ name: c.name, leakage: c.leakage, margin: c.margin, health: HEALTH[c.health].label, status: c.health, reason: c.reasons[0] ?? '' }))

  const section = (key: ReportModel['sections'][number]['key'], title: string, intro: string) => {
    const fs = live.filter((f) => f.category === key).sort((a, b) => b.estimated_value - a.estimated_value)
    const value = fs.reduce((a, f) => a + f.estimated_value, 0)
    return {
      key,
      title,
      intro: fs.length ? `${intro} ${plural(fs.length, 'finding')} worth ${money(value)}.` : 'Nothing found in this period.',
      value,
      rows: fs.slice(0, 10).map((f) => ({
        client: clientName(f.client_id),
        title: f.title,
        detail: f.meta.ticket_ref ? `Ticket #${f.meta.ticket_ref}` : f.monthly_value ? `${money(f.monthly_value)} a month` : '',
        confidence: f.confidence,
        value: f.estimated_value,
      })),
    }
  }

  const top = breakdown[0]
  const worst = [...metrics].sort((a, b) => a.margin - b.margin)[0]
  const executiveSummary = [
    `We analysed ${plural(s.data_counts.tickets, 'ticket')}, ${plural(s.data_counts.time_entries, 'time entry', 'time entries')} and ${plural(s.data_counts.clients, 'client agreement')} for ${s.period_label}, and identified ${money(total)} of potential revenue leakage across ${plural(live.length, 'finding')}.`,
    top ? `The largest source is ${top.label.toLowerCase()} (${money(top.value)}, ${pct(top.share)} of the total).` : '',
    monthly > 0 ? `${money(monthly)} a month is recurring: charges that will keep being missed until agreements or billing are updated. That is ${money(monthly * 12)} a year.` : '',
    worst && worst.margin < ws.settings.target_margin ? `${worst.name} has the weakest margin at ${pct(worst.margin)}, below the ${pct(ws.settings.target_margin)} target, with ${hours(worst.avg_monthly_hours)} of support a month.` : '',
  ].filter(Boolean)

  const actions = [...live]
    .filter((f) => f.status !== 'resolved')
    .sort((a, b) => b.estimated_value + b.annual_value - (a.estimated_value + a.annual_value))
    .slice(0, 8)
    .map((f) => ({ client: clientName(f.client_id), action: f.recommended_action, value: f.estimated_value }))

  return {
    title: 'MSP Revenue Leakage Report',
    workspace: ws.name,
    period: s.period_label,
    generated: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    isDemo: ws.is_demo,
    total,
    monthly,
    annual: monthly * 12,
    billed: s.client_metrics.reduce((a, c) => a + c.mrr, 0) * s.months.length,
    months: s.months.length,
    findingCount: live.length,
    executiveSummary,
    breakdown,
    riskClients,
    sections: [
      section('OUT_OF_SCOPE', 'Out-of-scope work', 'Work that client agreements exclude or make chargeable, delivered without a charge.'),
      section('AGREEMENT_DRIFT', 'Agreement drift', 'Users and devices supported beyond what agreements cover.'),
      section('UNBILLED_TIME', 'Unbilled work', 'Time logged as non-billable on work that appears billable.'),
    ],
    profitability: metrics.sort((a, b) => a.margin - b.margin),
    actions,
    clientName,
  }
}

export const DISCLAIMER =
  'All figures are estimates of potential revenue based on the data provided and the assumptions configured in Headroom. They are not guaranteed to be recoverable. Review each finding against the client agreement before taking action.'


type RGB = [number, number, number]
type Weight = 'normal' | 'bold'

// The PDF: an ink cover band in the product's own colours, then the report on
// paper. Lime only ever sits on ink; on white, money found takes the deep
// accent. Figures are tabular in Host Grotesk by default.
export async function reportPdf(r: ReportModel): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }, brand] = await Promise.all([import('jspdf'), import('jspdf-autotable'), import('./pdfBrand')])
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const F = brand.registerFonts(doc)
  doc.setProperties({ title: `${r.title}, ${r.workspace}, ${r.period}`, subject: 'Potential revenue leakage', author: 'Headroom', creator: 'Headroom' })

  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 48
  const CW = W - M * 2
  const FOOT = 64 // kept clear for the footer
  const MEASURE = 432 // prose line length, about 80 characters

  // Paper
  const ink = rgb(paper.text)
  const ink2 = rgb(paper.textSecondary)
  const muted = rgb(paper.muted)
  const rule = rgb(paper.border)
  const track = rgb(paper.borderMuted)
  const sunken = rgb(paper.surfaceSunken)
  const found = rgb(color.accentDeep)
  const HEALTH_INK: Record<Health, RGB> = { healthy: rgb(paper.success), watch: rgb(paper.warning), at_risk: rgb(paper.danger) }
  // Ink band
  const band = rgb(color.ink)
  const bone = rgb(color.bone)
  const bone2 = rgb(color.textSecondary)
  const boneMuted = rgb(color.muted)
  const hairline = rgb(color.border)
  const lime = rgb(color.accent)

  // y is the top of the next block.
  let y = M
  const type = (size: number, weight: Weight, c: RGB) => doc.setFont(F, weight).setFontSize(size).setTextColor(...c)
  const width = (t: string, size: number, weight: Weight = 'normal') => doc.setFont(F, weight).setFontSize(size).getTextWidth(t)
  const fit = (t: string, maxW: number, size: number, min: number, weight: Weight = 'bold') => {
    while (size > min && width(t, size, weight) > maxW) size -= 1
    return size
  }
  const after = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const ensure = (h: number) => {
    if (y + h > H - FOOT) {
      doc.addPage()
      y = M
    }
  }
  // Runs of differently styled text on one baseline, left or right aligned.
  const runs = (parts: { t: string; size: number; weight?: Weight; c: RGB }[], x: number, base: number, align: 'left' | 'right' = 'left') => {
    let cx = align === 'right' ? x - parts.reduce((a, p) => a + width(p.t, p.size, p.weight), 0) : x
    for (const p of parts) {
      const w = width(p.t, p.size, p.weight)
      doc.setTextColor(...p.c).text(p.t, cx, base)
      cx += w
    }
  }
  const para = (t: string, o: { size?: number; c?: RGB; w?: number; lead?: number; space?: number } = {}) => {
    const size = o.size ?? 10
    const lead = o.lead ?? size * 1.5
    type(size, 'normal', o.c ?? ink2)
    for (const ln of doc.splitTextToSize(t, o.w ?? MEASURE) as string[]) {
      ensure(lead)
      doc.text(ln, M, y + size * 0.78)
      y += lead
    }
    y += o.space ?? 5
  }
  // A sentence whose figures carry their own weight and colour, wrapped by word.
  const statement = (segs: { t: string; bold?: boolean; c?: RGB }[], size: number, lead: number, maxW: number) => {
    const words = segs.flatMap((s) => s.t.split(/(\s+)/).filter(Boolean).map((t) => ({ t, weight: (s.bold ? 'bold' : 'normal') as Weight, c: s.c ?? ink })))
    let x = M
    ensure(lead)
    for (const w of words) {
      const ww = width(w.t, size, w.weight)
      if (/^\s+$/.test(w.t)) {
        if (x > M) x += ww
        continue
      }
      if (x + ww > M + maxW && x > M) {
        y += lead
        ensure(lead)
        x = M
      }
      doc.setTextColor(...w.c).text(w.t, x, y + size * 0.78)
      x += ww
    }
    y += lead
  }
  // keep: the height to hold with the heading, so short tables never split.
  const h2 = (t: string, right?: string, keep = 0) => {
    if (y > M) y += 24
    ensure(Math.max(104, Math.min(keep, 380)))
    type(13, 'bold', ink).text(t, M, y + 10)
    if (right) type(10, 'bold', found).text(right, W - M, y + 10, { align: 'right' })
    y += 24
  }

  type Col = { head: string; right?: boolean; width?: number; c?: RGB; bold?: boolean; dot?: (row: number) => RGB }
  const PAD = { top: 5.5, bottom: 5.5, left: 0, right: 10 }
  const HEAD_PAD = { top: 0, bottom: 6, left: 0, right: 10 }
  const table = (cols: Col[], body: string[][], o: { foot?: string[]; size?: number; bar?: { col: number; share: (row: number) => number } } = {}) => {
    const size = o.size ?? 8.5
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: M, bottom: FOOT },
      head: [cols.map((c) => c.head.toUpperCase())],
      body,
      foot: o.foot ? [o.foot] : undefined,
      showFoot: 'lastPage',
      theme: 'plain',
      rowPageBreak: 'avoid',
      styles: { font: F, fontStyle: 'normal', fontSize: size, textColor: ink2, cellPadding: PAD, valign: 'top', overflow: 'linebreak', lineColor: rule, lineWidth: 0 },
      headStyles: { fontStyle: 'bold', fontSize: 6.5, textColor: muted, cellPadding: HEAD_PAD, valign: 'bottom', lineColor: ink, lineWidth: { bottom: 0.75 } },
      bodyStyles: { lineColor: rule, lineWidth: { bottom: 0.4 } },
      footStyles: { fontStyle: 'bold', textColor: ink, lineColor: ink, lineWidth: { top: 0.75 } },
      columnStyles: Object.fromEntries(cols.map((c, i) => [i, { cellWidth: c.width ?? (c.right ? 'wrap' : 'auto') }])),
      didParseCell: (d) => {
        const i = d.column.index
        const c = cols[i]
        const s = d.cell.styles
        if (c.right) s.halign = 'right'
        const pad = { ...(d.section === 'head' ? HEAD_PAD : PAD) }
        if (i === cols.length - 1) pad.right = 0
        if (c.dot && d.section === 'body') pad.left = 9
        s.cellPadding = pad
        if (c.width) s.cellWidth = c.width
        if (d.section === 'body') {
          s.textColor = c.dot ? c.dot(d.row.index) : (c.c ?? (i === 0 || c.right ? ink : ink2))
          if (c.bold) s.fontStyle = 'bold'
        }
      },
      didDrawCell: (d) => {
        if (d.section !== 'body') return
        const c = cols[d.column.index]
        const mid = d.cell.y + PAD.top + size * 0.5
        if (c.dot) doc.setFillColor(...c.dot(d.row.index)).circle(d.cell.x + 2.5, mid, 2, 'F')
        if (o.bar && d.column.index === o.bar.col) {
          const x0 = d.cell.x + 4
          const tw = d.cell.width - 4 - 34
          doc.setFillColor(...track).roundedRect(x0, mid - 1.5, tw, 3, 1.5, 1.5, 'F')
          const f = Math.max(0, Math.min(1, o.bar.share(d.row.index)))
          if (f > 0) doc.setFillColor(...muted).roundedRect(x0, mid - 1.5, Math.max(3, tw * f), 3, 1.5, 1.5, 'F')
        }
      },
    })
    y = after() + 4
  }

  // Measured: heading 24, label row 18, a one-line row 21.
  const ROW = 21
  const tableH = (rows: number, foot = false) => 24 + 18 + rows * ROW + (foot ? ROW : 0) + 4

  // Cover band
  const BAND = 326
  doc.setFillColor(...band).rect(0, 0, W, BAND, 'F')
  brand.drawMark(doc, M, 40, 22)
  type(14, 'bold', bone).text('Headroom', M + 31, 56)
  if (r.isDemo) {
    const label = 'Demo data'
    const pw = width(label, 8, 'bold') + 16
    doc.setDrawColor(...hairline).setLineWidth(0.75).roundedRect(W - M - pw, 42, pw, 18, 3, 3, 'S')
    type(8, 'bold', bone2).text(label, W - M - pw / 2, 53.8, { align: 'center' })
  }
  const titleSize = fit(r.title, CW, 28, 20)
  type(titleSize, 'bold', bone).text(r.title, M, 118, { charSpace: -titleSize * 0.02 })
  type(10, 'normal', bone2).text(`${r.workspace}  ·  ${r.period}  ·  Generated ${r.generated}`, M, 140)
  doc.setDrawColor(...hairline).setLineWidth(0.5).line(M, 166, W - M, 166)

  const LABEL = 192
  const BASE = 240
  const NOTE = 258
  const COL1 = M + CW * 0.54
  const COL2 = M + CW * 0.78
  type(9, 'normal', boneMuted).text('Potential revenue leakage identified', M, LABEL)
  const bigSize = fit(money(r.total), COL1 - M - 24, 48, 28)
  type(bigSize, 'bold', bone).text(money(r.total), M, BASE, { charSpace: -bigSize * 0.03 })
  type(9, 'normal', bone2).text(`${plural(r.findingCount, 'finding')} in ${r.period}`, M, NOTE)

  const stat = (x: number, maxW: number, label: string, value: string, c: RGB, unit: string | null, note: string) => {
    type(9, 'normal', boneMuted).text(label, x, LABEL)
    const size = fit(value, maxW, 22, 14)
    const vw = width(value, size, 'bold')
    const unitFits = !!unit && vw + 4 + width(unit, 9) <= maxW
    type(size, 'bold', c).text(value, x, BASE)
    if (unit && unitFits) type(9, 'normal', bone2).text(unit, x + vw + 4, BASE)
    type(8, 'normal', boneMuted).text(unit && !unitFits ? `${unit}, ${note.toLowerCase()}` : note, x, NOTE)
  }
  stat(COL1, COL2 - COL1 - 12, 'Recurring leakage', money(r.monthly), r.monthly > 0 ? lime : bone2, 'a month', 'Potential MRR to recover')
  stat(COL2, W - M - COL2, 'Annualised', money(r.annual), bone, null, 'If left uncorrected')

  // The gap: what the agreements billed, and the leakage on top.
  if (r.billed > 0) {
    const gy = 282
    const gh = 8
    const share = r.total / (r.billed + r.total)
    const gw = r.total > 0 ? Math.max(CW * share, CW * 0.015) : 0
    const bw = CW - (gw ? gw + 2 : 0)
    doc.setFillColor(...rgb(viz.series)).roundedRect(M, gy, bw, gh, 2, 2, 'F')
    if (gw) {
      doc.rect(M + bw - 2, gy, 2, gh, 'F')
      doc.setFillColor(...lime).roundedRect(W - M - gw, gy, gw, gh, 2, 2, 'F').rect(W - M - gw, gy, Math.min(2, gw), gh, 'F')
    }
    runs(
      [
        { t: 'Billed ', size: 8, c: boneMuted },
        { t: money(r.billed), size: 8, c: bone2 },
      ],
      M,
      gy + gh + 16,
    )
    runs(
      [
        { t: 'Unbilled ', size: 8, c: boneMuted },
        { t: money(r.total), size: 8, weight: 'bold', c: lime },
        { t: `   ${(share * 100).toFixed(1)}%`, size: 8, c: boneMuted },
      ],
      W - M,
      gy + gh + 16,
      'right',
    )
  }

  // The report, on paper
  y = BAND + 34
  statement(
    [{ t: 'We identified ' }, { t: money(r.total), bold: true, c: found }, { t: ' of potential revenue leakage across your MSP.' }],
    15,
    22,
    CW,
  )

  h2('Executive summary')
  r.executiveSummary.forEach((p) => para(p))

  h2('Revenue leakage breakdown', money(r.total), tableH(r.breakdown.length, true))
  const maxShare = Math.max(0.0001, ...r.breakdown.map((b) => b.share))
  table(
    [{ head: 'Category' }, { head: 'Findings', right: true, width: 56 }, { head: 'Potential value', right: true, width: 86 }, { head: 'Share', right: true, width: 120 }],
    r.breakdown.map((b) => [b.label, String(b.count), money(b.value), pct(b.share)]),
    { foot: ['Total', String(r.findingCount), money(r.total), r.total ? '100%' : '0%'], bar: { col: 3, share: (i) => r.breakdown[i].share / maxShare } },
  )

  h2('Highest risk clients', undefined, tableH(r.riskClients.length))
  table(
    [{ head: 'Client', width: 128 }, { head: 'Leakage', right: true }, { head: 'Margin', right: true }, { head: 'Status', width: 64, dot: (i) => HEALTH_INK[r.riskClients[i].status] }, { head: 'Main reason' }],
    r.riskClients.map((c) => [c.name, money(c.leakage), pct(c.margin), c.health, c.reason]),
  )

  for (const s of r.sections) {
    h2(s.title, s.value > 0 ? money(s.value) : undefined, tableH(s.rows.length) + 40)
    para(s.intro, { size: 9.5, space: 8 })
    if (s.rows.length)
      table(
        [{ head: 'Client', width: 128 }, { head: 'Finding' }, { head: 'Reference', width: 80, c: muted }, { head: 'Confidence', right: true }, { head: 'Value', right: true }],
        s.rows.map((x) => [x.client, x.title, x.detail, `${x.confidence}%`, money(x.value)]),
      )
  }

  h2('Client profitability')
  table(
    [
      { head: 'Client' },
      { head: 'MRR', right: true },
      { head: 'Labour', right: true },
      { head: 'Software', right: true },
      { head: 'Contribution', right: true },
      { head: 'Margin', right: true },
      { head: 'Hours/mo', right: true },
      { head: 'Status', width: 58, dot: (i) => HEALTH_INK[r.profitability[i].health] },
    ],
    r.profitability.map((c) => [c.name, money(c.mrr), money(c.labour_cost), money(c.software_cost), money(c.contribution), pct(c.margin), hours(c.avg_monthly_hours), HEALTH[c.health].label]),
    { size: 8 },
  )

  h2('Recommended actions')
  table(
    [{ head: '#', width: 18, c: muted }, { head: 'Client', width: 110 }, { head: 'Action' }, { head: 'Value', right: true }],
    r.actions.map((a, i) => [String(i + 1), a.client, a.action, money(a.value)]),
  )

  // Closing: the annual opportunity, set apart on a sunken panel.
  const sentence = `If the recurring items in this report are corrected, the estimated annual opportunity is ${money(r.annual)} (${money(r.monthly)} a month), in addition to the ${money(r.total)} identified in ${r.period}.`
  const PANEL = 20
  const LEFT = 168
  type(9.5, 'normal', ink2)
  const lines = doc.splitTextToSize(sentence, CW - PANEL * 2 - LEFT) as string[]
  const panelH = Math.max(84, PANEL * 2 + lines.length * 14.5)
  y += 30
  ensure(panelH + 60)
  doc.setFillColor(...sunken).roundedRect(M, y, CW, panelH, 6, 6, 'F')
  type(8.5, 'normal', muted).text('Estimated annual opportunity', M + PANEL, y + PANEL + 7)
  const annualSize = fit(money(r.annual), LEFT - 16, 24, 16)
  type(annualSize, 'bold', found).text(money(r.annual), M + PANEL, y + PANEL + 36, { charSpace: -annualSize * 0.02 })
  type(9.5, 'normal', ink2).text(lines, M + PANEL + LEFT, y + PANEL + 8, { lineHeightFactor: 1.53 })
  y += panelH + 18

  para(DISCLAIMER, { size: 7.5, c: muted, w: CW, lead: 11 })

  // Footer on every page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    const fy = H - 30
    doc.setDrawColor(...rule).setLineWidth(0.4).line(M, fy - 14, W - M, fy - 14)
    brand.drawMark(doc, M, fy - 7.4, 9, 'paper')
    type(7.5, 'normal', muted).text(`Headroom  ·  ${r.workspace}  ·  ${r.period}`, M + 15, fy)
    doc.text(`Page ${i} of ${pages}`, W - M, fy, { align: 'right' })
  }
  return doc.output('blob')
}
