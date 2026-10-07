// One report model, rendered both on screen and as a PDF.
import type { Analysis, ClientMetrics, ConfidenceLevel, Finding, Health, Workspace } from '../engine/types'
import { DEFAULT_SETTINGS } from '../engine/types'
import { liveClientHealth } from '../engine/health'
import type { WorkspaceData } from '../data/backend'
import { CATEGORY_META, CONFIDENCE, FINDING_STATUS, HEALTH, LEVEL_ORDER, recurringKind } from './labels'
import { confidenceOf } from './confidence'
import { money, pct, hours, plural } from './format'
import { overlapOf } from './overlap'
import { stripJoiners } from '../engine/format'
import { color, paper, rgb, viz } from '../brand/tokens'

const opportunities = (n: number) => plural(n, 'opportunity', 'opportunities')

export interface ReportModel {
  title: string
  workspace: string
  period: string
  generated: string
  isDemo: boolean
  total: number
  monthly: number
  /** The recurring part from agreement and billing gaps, and from pricing below target. */
  recurringAgreement: number
  recurringPricing: number
  annual: number
  /** Agreement revenue over the analysed period: the billed side of the gap. */
  billed: number
  months: number
  findingCount: number
  /** The workspace's target gross margin, so margins below it can be marked. */
  targetMargin: number
  executiveSummary: string[]
  breakdown: { label: string; count: number; value: number; share: number }[]
  /** Opportunities by confidence level, for the "How to read confidence" box. */
  levels: { level: ConfidenceLevel; count: number; value: number }[]
  /** health and status are live: they follow the opportunities still counted. known is false without MRR. */
  riskClients: { name: string; leakage: number; margin: number; known: boolean; health: string; status: Health; reason: string }[]
  sections: {
    key: 'OUT_OF_SCOPE' | 'AGREEMENT_DRIFT' | 'UNBILLED_TIME'
    title: string
    intro: string
    value: number
    rows: { client: string; title: string; detail: string; level: ConfidenceLevel; value: number }[]
    /** the opportunities past the listed rows, so the table still adds up to its heading */
    more: { count: number; value: number } | null
  }[]
  profitability: (ClientMetrics & { leakage: number; known: boolean })[]
  /** largest value first; note says when an action covers the same money as another */
  actions: { client: string; action: string; value: number; note?: string }[]
  /** money counted under two opportunities at once, disclosed and not netted */
  overlap: { value: number; monthly: number; clients: string[] }
  clientName: (id: string) => string
}

export function buildReport(ws: Workspace, analysis: Analysis, data: WorkspaceData): ReportModel {
  const clientName = (id: string) => data.clients.find((c) => c.id === id)?.name ?? 'Unknown client'
  const live = data.findings.filter((f) => f.status !== 'dismissed')
  const total = live.reduce((a, f) => a + f.estimated_value, 0)
  const monthly = live.reduce((a, f) => a + f.monthly_value, 0)
  const s = analysis.summary
  // The settings the analysis ran with, so targets match its opportunities.
  const settings = { ...DEFAULT_SETTINGS, ...ws.settings, ...s.settings }
  const leak = new Map<string, number>()
  const liveByClient = new Map<string, Finding[]>()
  live.forEach((f) => {
    leak.set(f.client_id, (leak.get(f.client_id) ?? 0) + f.estimated_value)
    liveByClient.set(f.client_id, [...(liveByClient.get(f.client_id) ?? []), f])
  })

  // Recurring money splits into gaps billing can close and pricing below target.
  let recurringAgreement = 0
  let recurringPricing = 0
  const pricedBelow = new Set<string>()
  for (const f of live) {
    if (!f.monthly_value) continue
    if (recurringKind(f.category) === 'pricing') {
      recurringPricing += f.monthly_value
      pricedBelow.add(f.client_id)
    } else recurringAgreement += f.monthly_value
  }

  const byLevel = new Map<ConfidenceLevel, { count: number; value: number }>(LEVEL_ORDER.map((l) => [l, { count: 0, value: 0 }]))
  for (const f of live) {
    const l = byLevel.get(confidenceOf(f).level)!
    l.count++
    l.value += f.estimated_value
  }
  const levels = LEVEL_ORDER.map((level) => ({ level, ...byLevel.get(level)! }))

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

  // Health, reasons and margin follow the opportunities still counted, as on
  // screen. A client without MRR has no margin to measure.
  const metrics = s.client_metrics.map((c) => {
    const h = liveClientHealth(c, liveByClient.get(c.client_id) ?? [], settings, s.average_monthly_hours, s.months.length)
    return { ...c, leakage: leak.get(c.client_id) ?? 0, health: h.health, reasons: h.reasons, recommendation: h.recommendation, known: c.margin_known ?? c.mrr > 0 }
  })
  const riskClients = [...metrics]
    .filter((c) => c.leakage > 0 || c.health === 'at_risk')
    .sort((a, b) => b.leakage - a.leakage)
    .slice(0, 6)
    .map((c) => ({ name: c.name, leakage: c.leakage, margin: c.margin, known: c.known, health: c.known ? HEALTH[c.health].label : 'Needs MRR', status: c.health, reason: c.reasons[0] ?? '' }))

  const section = (key: ReportModel['sections'][number]['key'], title: string, intro: string) => {
    const fs = live.filter((f) => f.category === key).sort((a, b) => b.estimated_value - a.estimated_value)
    const value = fs.reduce((a, f) => a + f.estimated_value, 0)
    return {
      key,
      title,
      intro: fs.length ? `${intro} ${opportunities(fs.length)} worth ${money(value)}.` : 'Nothing found in this period.',
      value,
      more: fs.length > SECTION_ROWS ? { count: fs.length - SECTION_ROWS, value: fs.slice(SECTION_ROWS).reduce((a, f) => a + f.estimated_value, 0) } : null,
      rows: fs.slice(0, SECTION_ROWS).map((f) => ({
        client: clientName(f.client_id),
        title: f.title,
        detail: f.meta.ticket_ref ? `Ticket #${f.meta.ticket_ref}` : f.monthly_value ? `${money(f.monthly_value)} a month` : '',
        level: confidenceOf(f).level,
        value: f.estimated_value,
      })),
    }
  }

  const top = breakdown[0]
  const worst = metrics.filter((c) => c.known).sort((a, b) => a.margin - b.margin)[0]
  const target = settings.target_margin
  // What recurs, and why: gaps that billing can close, and pricing below target.
  const recurs = [
    recurringAgreement > 0 ? `${money(recurringAgreement)} a month from agreement and billing gaps that will continue until agreements or billing are updated` : '',
    recurringPricing > 0 ? `${money(recurringPricing)} a month from ${plural(pricedBelow.size, 'client')} priced below your target margin` : '',
  ].filter(Boolean)
  // Overlaps are disclosed, never netted: say where the same money is counted twice.
  const ov = overlapOf(data.findings)
  const overlap = { value: ov.value, monthly: ov.monthly, clients: ov.clients.map(clientName) }
  const overlapNames = overlap.clients.join(' and ')
  // Out-of-scope checks need a contract: say how many clients had one.
  const withContract = s.coverage?.clients_with_contract
  const agreements =
    withContract != null && withContract < s.data_counts.clients
      ? `${plural(s.data_counts.clients, 'client')} (contracts uploaded for ${withContract})`
      : plural(s.data_counts.clients, 'client agreement')
  const executiveSummary = [
    `We analysed ${plural(s.data_counts.tickets, 'ticket')}, ${plural(s.data_counts.time_entries, 'time entry', 'time entries')} and ${agreements} for ${s.period_label}, and identified ${money(total)} of potential revenue leakage across ${opportunities(live.length)}.`,
    top ? `The largest source is ${top.label.toLowerCase()} (${money(top.value)}, ${pct(top.share)} of the total).` : '',
    monthly > 0 ? `${money(monthly)} a month recurs: ${recurs.join(', and ')}. That is ${money(monthly * 12)} a year.` : '',
    worst && worst.margin < target ? `${worst.name} has the weakest margin at ${pct(worst.margin)}, below the ${pct(target)} target, with ${hours(worst.avg_monthly_hours)} of support a month.` : '',
    overlap.value > 0
      ? `These totals include ${money(overlap.value)} at ${overlapNames} (${money(overlap.monthly)} a month) that overlaps with ${overlap.clients.length === 1 ? 'its' : 'their'} agreement gaps: billing those would restore the target margin on its own, so don't count both.`
      : '',
  ].filter(Boolean)

  // Largest value in the period first, as each row shows it.
  const open = [...live].filter((f) => f.status !== 'resolved').sort((a, b) => b.estimated_value - a.estimated_value)
  const listed = open.slice(0, 8)
  const actions = listed.map((f) => {
    const covered = live.filter((o) => o.id !== f.id && f.meta.overlaps?.includes(o.finding_key))
    const settled = covered.find((o) => o.status === 'resolved' || o.status === 'valid')
    const at = covered.map((o) => listed.indexOf(o)).find((i) => i >= 0)
    const note = !covered.length
      ? undefined
      : settled
        ? `Overlaps with its agreement gaps, already ${FINDING_STATUS[settled.status].toLowerCase()}. Billing those should restore the target margin, so check this again after the next analysis.`
        : at != null
          ? `Overlaps with action ${at + 1}: billing that alone restores the ${pct(target)} target margin, so don't count both.`
          : `Overlaps with its agreement gaps: billing those alone restores the ${pct(target)} target margin, so don't count both.`
    return { client: clientName(f.client_id), action: f.recommended_action, value: f.estimated_value, note }
  })

  return {
    title: 'MSP Revenue Leakage Report',
    workspace: ws.name,
    period: s.period_label,
    generated: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    isDemo: ws.is_demo,
    total,
    monthly,
    recurringAgreement,
    recurringPricing,
    annual: monthly * 12,
    billed: s.client_metrics.reduce((a, c) => a + c.mrr, 0) * s.months.length,
    months: s.months.length,
    findingCount: live.length,
    targetMargin: target,
    executiveSummary,
    breakdown,
    levels,
    riskClients,
    sections: [
      section('OUT_OF_SCOPE', 'Out-of-scope work', 'Work that client agreements exclude or make chargeable, delivered without a charge.'),
      section('AGREEMENT_DRIFT', 'Agreement drift', 'Users and devices supported beyond what agreements cover.'),
      section('UNBILLED_TIME', 'Unbilled work', 'Time logged as non-billable on work that appears billable.'),
    ],
    // Weakest margin first; clients without MRR go last.
    profitability: metrics.sort((a, b) => Number(b.known) - Number(a.known) || a.margin - b.margin),
    actions,
    overlap,
    clientName,
  }
}

// Each category table lists its largest opportunities, then one line for the rest.
const SECTION_ROWS = 10

// The closing line, on screen and in the PDF.
export function annualSentence(r: ReportModel): string {
  const base = `If the recurring items in this report are corrected, the estimated annual opportunity is ${money(r.annual)} (${money(r.monthly)} a month), in addition to the ${money(r.total)} identified in ${r.period}.`
  return r.overlap.monthly > 0 ? `${base} Up to ${money(r.overlap.monthly * 12)} a year of it overlaps at ${r.overlap.clients.join(' and ')}.` : base
}

export const DISCLAIMER =
  'All figures are estimates of potential revenue based on the data provided and the assumptions configured in Headroom. They are not guaranteed to be recoverable. Review each opportunity against the client agreement before taking action.'


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
  // Health, calm as on screen: one danger dot for At risk beside a neutral
  // label, a hollow ring for Watch, no mark for Healthy.
  const danger = rgb(paper.danger)
  const HEALTH_MARK: Record<Health, { text: RGB; mark: 'dot' | 'ring' | null }> = {
    at_risk: { text: ink2, mark: 'dot' },
    watch: { text: muted, mark: 'ring' },
    healthy: { text: muted, mark: null },
  }
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

  // health: the column is a client's health label. flag: the row's figure is
  // below target, so it is set bold with a small danger dot before it.
  type Col = { head: string; right?: boolean; width?: number; c?: RGB; bold?: boolean; health?: (row: number) => Health; flag?: (row: number) => boolean }
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
        if (c.health && d.section === 'body') pad.left = 9
        s.cellPadding = pad
        if (c.width) s.cellWidth = c.width
        if (d.section === 'body') {
          s.textColor = c.health ? HEALTH_MARK[c.health(d.row.index)].text : (c.c ?? (i === 0 || c.right ? ink : ink2))
          if (c.bold || c.flag?.(d.row.index)) s.fontStyle = 'bold'
        }
      },
      didDrawCell: (d) => {
        if (d.section !== 'body') return
        const c = cols[d.column.index]
        const mid = d.cell.y + PAD.top + size * 0.5
        if (c.health) {
          const mark = HEALTH_MARK[c.health(d.row.index)].mark
          if (mark === 'dot') doc.setFillColor(...danger).circle(d.cell.x + 2.5, mid, 2, 'F')
          if (mark === 'ring') doc.setDrawColor(...muted).setLineWidth(0.6).circle(d.cell.x + 2.5, mid, 1.7, 'S')
        }
        if (c.flag?.(d.row.index)) {
          const text = String(d.cell.raw ?? '')
          const right = d.cell.x + d.cell.width - (d.column.index === cols.length - 1 ? 0 : PAD.right)
          const x = c.right ? right - width(text, size, 'bold') - 5 : d.cell.x + PAD.left - 5
          doc.setFillColor(...danger).circle(x, mid, 1.6, 'F')
        }
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

  // Cover band. The notes under its figures wrap inside their own columns, so
  // they are measured before anything is drawn: the gap bar and the foot of
  // the band move down to clear the longest.
  const LABEL = 192
  const BASE = 240
  const NOTE = 258
  const COL1 = M + CW * 0.54
  const COL2 = M + CW * 0.78
  const wrap = (t: string, size: number, maxW: number) => doc.setFont(F, 'normal').setFontSize(size).splitTextToSize(t, maxW) as string[]
  const leadNote = wrap(`${opportunities(r.findingCount)} in ${r.period}`, 9, COL1 - M - 24)
  const recurringNote =
    r.recurringAgreement > 0 && r.recurringPricing > 0 ? `${money(r.recurringAgreement)} agreement and billing, ${money(r.recurringPricing)} pricing` : r.recurringPricing > 0 ? 'Pricing below target margin' : 'Agreement and billing gaps'
  const stats = [
    { x: COL1, maxW: COL2 - COL1 - 12, label: 'Recurring leakage', value: money(r.monthly), c: r.monthly > 0 ? lime : bone2, unit: 'a month', note: recurringNote },
    { x: COL2, maxW: W - M - COL2, label: 'Annualised', value: money(r.annual), c: bone, unit: null, note: 'If left uncorrected' },
  ].map((st) => {
    const size = fit(st.value, st.maxW, 22, 14)
    const vw = width(st.value, size, 'bold')
    const unitFits = !!st.unit && vw + 4 + width(st.unit, 9) <= st.maxW
    return { ...st, size, vw, unitFits, lines: wrap(st.unit && !unitFits ? `${st.unit}, ${st.note.toLowerCase()}` : st.note, 8, st.maxW) }
  })
  // Line heights: 11 for the 9pt note, 10 for the 8pt ones.
  const noteFoot = Math.max(NOTE + (leadNote.length - 1) * 11, ...stats.map((st) => NOTE + (st.lines.length - 1) * 10))
  const GAP = Math.max(280, noteFoot + 16) // top of the gap bar
  const BAND = GAP + 46
  doc.setFillColor(...band).rect(0, 0, W, BAND, 'F')
  brand.drawMark(doc, M, 56 - 15, 15)
  type(15, 'bold', bone).text('Headroom', M + brand.markAdvance(15), 56, { charSpace: -0.3 })
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

  type(9, 'normal', boneMuted).text('Potential revenue leakage identified', M, LABEL)
  const bigSize = fit(money(r.total), COL1 - M - 24, 48, 28)
  type(bigSize, 'bold', bone).text(money(r.total), M, BASE, { charSpace: -bigSize * 0.03 })
  type(9, 'normal', bone2).text(leadNote, M, NOTE, { lineHeightFactor: 11 / 9 })
  for (const st of stats) {
    type(9, 'normal', boneMuted).text(st.label, st.x, LABEL)
    type(st.size, 'bold', st.c).text(st.value, st.x, BASE)
    if (st.unit && st.unitFits) type(9, 'normal', bone2).text(st.unit, st.x + st.vw + 4, BASE)
    type(8, 'normal', boneMuted).text(st.lines, st.x, NOTE, { lineHeightFactor: 10 / 8 })
  }

  // The gap: what the agreements billed, and the leakage on top, with a
  // hairline tick at the junction as on screen.
  if (r.billed > 0) {
    const gy = GAP
    const gh = 12
    const share = r.total / (r.billed + r.total)
    const gw = r.total > 0 ? Math.max(CW * share, CW * 0.015) : 0
    const bw = CW - (gw ? gw + 2 : 0)
    doc.setFillColor(...rgb(viz.series)).roundedRect(M, gy, bw, gh, 2, 2, 'F')
    if (gw) {
      doc.rect(M + bw - 2, gy, 2, gh, 'F')
      doc.setFillColor(...lime).roundedRect(W - M - gw, gy, gw, gh, 2, 2, 'F').rect(W - M - gw, gy, Math.min(2, gw), gh, 'F')
      doc.setDrawColor(...bone2).setLineWidth(0.6).line(M + bw + 1, gy - 4, M + bw + 1, gy + gh + 4)
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
        { t: 'Potential leakage ', size: 8, c: boneMuted },
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
    [{ head: 'Category' }, { head: 'Opportunities', right: true, width: 72 }, { head: 'Potential value', right: true, width: 86 }, { head: 'Share', right: true, width: 120 }],
    r.breakdown.map((b) => [b.label, String(b.count), money(b.value), pct(b.share)]),
    { foot: ['Total', String(r.findingCount), money(r.total), r.total ? '100%' : '0%'], bar: { col: 3, share: (i) => r.breakdown[i].share / maxShare } },
  )

  // How to read confidence: each level's marks, word and definition, with
  // how many opportunities sit at it, on a sunken panel as on screen.
  {
    const PX = 16
    const ROW = 17
    const boxH = 22 + 12 + r.levels.length * ROW + 6
    y += 12
    ensure(boxH + 8)
    doc.setFillColor(...sunken).roundedRect(M, y, CW, boxH, 6, 6, 'F')
    type(9.5, 'bold', ink).text('How to read confidence', M + PX, y + 22)
    let base = y + 22 + 12 + 9
    for (const l of r.levels) {
      const c = CONFIDENCE[l.level]
      for (let i = 0; i < 3; i++) doc.setFillColor(...(i < c.marks ? ink2 : rule)).circle(M + PX + 2 + i * 5.5, base - 2.8, 1.7, 'F')
      type(8.5, 'bold', ink).text(c.short, M + PX + 22, base)
      type(8.5, 'normal', ink2).text(c.definition, M + PX + 68, base)
      type(8.5, 'normal', muted).text(`${opportunities(l.count)}  ·  ${money(l.value)}`, W - M - PX, base, { align: 'right' })
      base += ROW
    }
    y += boxH + 4
  }

  h2('Highest risk clients', undefined, tableH(r.riskClients.length))
  table(
    [
      { head: 'Client', width: 128 },
      { head: 'Leakage', right: true },
      { head: 'Margin', right: true, flag: (i) => r.riskClients[i].known && r.riskClients[i].margin < r.targetMargin },
      { head: 'Status', width: 64, health: (i) => (r.riskClients[i].known ? r.riskClients[i].status : 'healthy') },
      { head: 'Main reason' },
    ],
    r.riskClients.map((c) => [c.name, money(c.leakage), c.known ? pct(c.margin) : '—', c.health, c.reason]),
  )

  for (const s of r.sections) {
    h2(s.title, s.value > 0 ? money(s.value) : undefined, tableH(s.rows.length) + 40)
    para(s.intro, { size: 9.5, space: 8 })
    if (s.rows.length)
      table(
        [{ head: 'Client', width: 128 }, { head: 'Opportunity' }, { head: 'Reference', width: 80, c: muted }, { head: 'Confidence', right: true }, { head: 'Value', right: true }],
        [
          ...s.rows.map((x) => [x.client, x.title, x.detail, CONFIDENCE[x.level].short, money(x.value)]),
          ...(s.more ? [['', `+ ${s.more.count} more ${s.more.count === 1 ? 'opportunity' : 'opportunities'}`, '', '', money(s.more.value)]] : []),
        ],
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
      { head: 'Margin', right: true, flag: (i) => r.profitability[i].known && r.profitability[i].margin < r.targetMargin },
      { head: 'Hours/mo', right: true },
      { head: 'Status', width: 58, health: (i) => (r.profitability[i].known ? r.profitability[i].health : 'healthy') },
    ],
    r.profitability.map((c) => [
      c.name,
      money(c.mrr),
      money(c.labour_cost),
      money(c.software_cost),
      money(c.contribution),
      c.known ? pct(c.margin) : '—',
      hours(c.avg_monthly_hours),
      c.known ? HEALTH[c.health].label : 'Needs MRR',
    ]),
    { size: 8 },
  )

  h2('Recommended actions')
  table(
    [{ head: '#', width: 18, c: muted }, { head: 'Client', width: 110 }, { head: 'Action' }, { head: 'Value', right: true }],
    r.actions.map((a, i) => [String(i + 1), a.client, stripJoiners(a.note ? `${a.action} ${a.note}` : a.action), money(a.value)]),
  )

  // Closing: the annual opportunity, set apart on a sunken panel.
  const sentence = `${annualSentence(r)}`
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
    brand.drawMark(doc, M, fy - 7.5, 7.5, 'paper')
    type(7.5, 'normal', muted).text(`Headroom  ·  ${r.workspace}  ·  ${r.period}`, M + brand.markAdvance(7.5), fy)
    doc.text(`Page ${i} of ${pages}`, W - M, fy, { align: 'right' })
  }
  return doc.output('blob')
}
