// One report model, rendered both on screen and as a PDF.
import type { Analysis, ClientMetrics, Finding, Workspace } from '../engine/types'
import type { WorkspaceData } from '../data/backend'
import { CATEGORY_META, HEALTH } from './labels'
import { money, pct, hours, plural } from './format'

export interface ReportModel {
  title: string
  workspace: string
  period: string
  generated: string
  isDemo: boolean
  total: number
  monthly: number
  annual: number
  findingCount: number
  executiveSummary: string[]
  breakdown: { label: string; count: number; value: number; share: number }[]
  riskClients: { name: string; leakage: number; margin: number; health: string; reason: string }[]
  sections: { key: 'OUT_OF_SCOPE' | 'AGREEMENT_DRIFT' | 'UNBILLED_TIME'; title: string; intro: string; rows: { client: string; title: string; detail: string; confidence: number; value: number }[] }[]
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
    .map((c) => ({ name: c.name, leakage: c.leakage, margin: c.margin, health: HEALTH[c.health].label, reason: c.reasons[0] ?? '' }))

  const section = (key: ReportModel['sections'][number]['key'], title: string, intro: string) => {
    const fs = live.filter((f) => f.category === key).sort((a, b) => b.estimated_value - a.estimated_value)
    return {
      key,
      title,
      intro: fs.length ? `${intro} ${plural(fs.length, 'finding')} worth ${money(fs.reduce((a, f) => a + f.estimated_value, 0))}.` : 'Nothing found in this period.',
      rows: fs.slice(0, 10).map((f) => ({
        client: clientName(f.client_id),
        title: f.title,
        detail: f.meta.ticket_ref ? `Ticket #${f.meta.ticket_ref}` : f.monthly_value ? `${money(f.monthly_value)}/month` : '',
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
  'All figures are estimates of potential revenue based on the data provided and the assumptions configured in MSP Leak. They are not guaranteed to be recoverable. Review each finding against the client agreement before taking action.'

export async function reportPdf(r: ReportModel): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 48
  let y = M
  const ink: [number, number, number] = [24, 24, 27]
  const muted: [number, number, number] = [113, 113, 122]
  const after = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const ensure = (h: number) => {
    if (y + h > doc.internal.pageSize.getHeight() - M) {
      doc.addPage()
      y = M
    }
  }
  const h2 = (t: string) => {
    ensure(60)
    y += 14
    doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(...ink).text(t, M, y)
    y += 16
  }
  const para = (t: string, size = 10) => {
    doc.setFont('helvetica', 'normal').setFontSize(size).setTextColor(...ink)
    for (const line of doc.splitTextToSize(t, W - M * 2) as string[]) {
      ensure(14)
      doc.text(line, M, y)
      y += size + 4
    }
    y += 4
  }
  const table = (head: string[], body: (string | number)[][], right: number[] = []) => {
    autoTable(doc, {
      startY: y,
      head: [head],
      body: body.map((r) => r.map(String)),
      margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 5, textColor: ink, lineColor: [228, 228, 231], lineWidth: 0 },
      headStyles: { fillColor: [244, 244, 245], textColor: muted, fontStyle: 'bold' },
      columnStyles: Object.fromEntries(right.map((i) => [i, { halign: 'right' }])),
      theme: 'plain',
      didDrawCell: (d) => {
        if (d.section === 'body') doc.setDrawColor(228, 228, 231).line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height)
      },
    })
    y = after() + 12
  }

  // header band
  doc.setFillColor(...ink).rect(0, 0, W, 6, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...muted).text(`${r.workspace.toUpperCase()}${r.isDemo ? '  ·  DEMO DATA' : ''}`, M, y)
  y += 24
  doc.setFontSize(22).setTextColor(...ink).text(r.title, M, y)
  y += 20
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...muted).text(`Period: ${r.period}   ·   Generated ${r.generated}`, M, y)
  y += 28

  // headline numbers
  const boxW = (W - M * 2 - 16) / 3
  ;[
    [money(r.total), 'Identified potential leakage'],
    [`${money(r.monthly)}/mo`, 'Monthly recurring opportunity'],
    [money(r.annual), 'Annualised opportunity'],
  ].forEach(([v, l], i) => {
    const x = M + i * (boxW + 8)
    doc.setDrawColor(228, 228, 231).setFillColor(250, 250, 250).roundedRect(x, y, boxW, 58, 6, 6, 'FD')
    doc.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...ink).text(v, x + 12, y + 26)
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...muted).text(l, x + 12, y + 44)
  })
  y += 76
  para(`We identified ${money(r.total)} of potential revenue leakage across your MSP.`, 11)

  h2('Executive summary')
  r.executiveSummary.forEach((p) => para(p))

  h2('Revenue leakage breakdown')
  table(['Category', 'Findings', 'Potential value', 'Share'], r.breakdown.map((b) => [b.label, b.count, money(b.value), pct(b.share)]), [1, 2, 3])

  h2('Highest risk clients')
  table(['Client', 'Leakage', 'Margin', 'Risk', 'Main reason'], r.riskClients.map((c) => [c.name, money(c.leakage), pct(c.margin), c.health, c.reason]), [1, 2])

  for (const s of r.sections) {
    h2(s.title)
    para(s.intro)
    if (s.rows.length) table(['Client', 'Finding', 'Reference', 'Confidence', 'Value'], s.rows.map((x) => [x.client, x.title, x.detail, `${x.confidence}%`, money(x.value)]), [3, 4])
  }

  h2('Client profitability')
  table(
    ['Client', 'MRR', 'Labour', 'Software', 'Contribution', 'Margin', 'Hours/mo'],
    r.profitability.map((c) => [c.name, money(c.mrr), money(c.labour_cost), money(c.software_cost), money(c.contribution), pct(c.margin), hours(c.avg_monthly_hours)]),
    [1, 2, 3, 4, 5, 6],
  )

  h2('Recommended actions')
  table(['Client', 'Action', 'Value'], r.actions.map((a) => [a.client, a.action, money(a.value)]), [2])

  h2('Estimated annual opportunity')
  para(`If the recurring items in this report are corrected, the estimated annual opportunity is ${money(r.annual)} (${money(r.monthly)} a month), in addition to the ${money(r.total)} identified in ${r.period}.`)

  y += 6
  doc.setFont('helvetica', 'italic').setFontSize(8).setTextColor(...muted)
  for (const line of doc.splitTextToSize(DISCLAIMER, W - M * 2) as string[]) {
    ensure(12)
    doc.text(line, M, y)
    y += 11
  }

  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...muted)
    doc.text(`MSP Leak · ${r.workspace} · ${r.period}`, M, doc.internal.pageSize.getHeight() - 24)
    doc.text(`${i} / ${pages}`, W - M, doc.internal.pageSize.getHeight() - 24, { align: 'right' })
  }
  return doc.output('blob')
}
