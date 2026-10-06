import { useMemo, useState, type ReactNode } from 'react'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Button, Card, HealthDot, PageHeader, cx } from '../../components/ui'
import { useToast } from '../../components/toast'
import { GetStarted } from './Overview'
import { findingsCsv } from './Findings'
import { buildReport, reportPdf, DISCLAIMER } from '../../lib/report'
import { downloadFile, hours, money, pct, relative } from '../../lib/format'

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-10 text-lg font-semibold tracking-tight text-zinc-900 print:break-after-avoid">{children}</h2>
}

function T({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500">
            {head.map((h, i) => (
              <th key={h} className={cx('py-2 pr-4 font-medium', right.includes(i) && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((r, i) => (
            <tr key={i} className="align-top">
              {r.map((c, j) => (
                <td key={j} className={cx('tnum py-2 pr-4', right.includes(j) && 'text-right', j === 0 && 'font-medium')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Reports() {
  const { workspace, analysis, data, recordReport } = useStore()
  const m = useMetrics()
  const toast = useToast()
  const [pdfBusy, setPdfBusy] = useState(false)
  const r = useMemo(() => (workspace && analysis ? buildReport(workspace, analysis, data) : null), [workspace, analysis, data])

  if (!r)
    return (
      <>
        <PageHeader title="Reports" />
        <GetStarted />
      </>
    )

  const slug = `${r.workspace}-${r.period}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const pdf = async () => {
    setPdfBusy(true)
    try {
      downloadFile(`msp-leak-report-${slug}.pdf`, await reportPdf(r), 'application/pdf')
      await recordReport()
      toast('Report downloaded.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not generate the PDF.', 'error')
    } finally {
      setPdfBusy(false)
    }
  }
  const csv = () => {
    downloadFile(`msp-leak-findings-${slug}.csv`, findingsCsv(data.findings.filter((f) => f.status !== 'dismissed'), m.clientName), 'text/csv')
    toast('Findings CSV downloaded.')
  }

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Reports"
          subtitle={data.reports[0] ? `Last downloaded ${relative(data.reports[0].created_at)}` : 'A management-ready summary of this analysis'}
          actions={
            <>
              <Button variant="secondary" size="sm" onClick={() => window.print()}>
                <Printer className="size-3.5" /> Print
              </Button>
              <Button variant="secondary" size="sm" onClick={csv}>
                <FileSpreadsheet className="size-3.5" /> Download CSV
              </Button>
              <Button size="sm" onClick={pdf} loading={pdfBusy} data-testid="download-pdf">
                <Download className="size-3.5" /> Download PDF
              </Button>
            </>
          }
        />
      </div>

      <Card className="mx-auto max-w-[880px] px-6 py-10 shadow-sm sm:px-12 sm:py-14 print:border-0 print:shadow-none">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
          {r.workspace}
          {r.isDemo && <span className="ml-2 text-orange-600">· Demo data</span>}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{r.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Period: <span className="font-medium text-zinc-800">{r.period}</span> · Generated {r.generated}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            [money(r.total), 'Identified potential leakage'],
            [`${money(r.monthly)}/month`, 'Monthly recurring opportunity'],
            [money(r.annual), 'Annualised opportunity'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
              <p className="tnum text-2xl font-semibold tracking-tight">{v}</p>
              <p className="mt-1 text-xs text-zinc-500">{l}</p>
            </div>
          ))}
        </div>
        <blockquote className="mt-6 border-l-2 border-orange-500 pl-4 text-lg font-medium text-zinc-900">We identified {money(r.total)} of potential revenue leakage across your MSP.</blockquote>

        <H2>Executive summary</H2>
        <div className="space-y-3 text-[15px] leading-relaxed text-zinc-700">
          {r.executiveSummary.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <H2>Revenue leakage breakdown</H2>
        <T head={['Category', 'Findings', 'Potential value', 'Share']} right={[1, 2, 3]} rows={r.breakdown.map((b) => [b.label, b.count, money(b.value), pct(b.share)])} />

        <H2>Highest risk clients</H2>
        <T
          head={['Client', 'Leakage', 'Margin', 'Main reason']}
          right={[1, 2]}
          rows={r.riskClients.map((c) => [c.name, money(c.leakage), pct(c.margin), <span className="font-normal text-zinc-600">{c.reason}</span>])}
        />

        {r.sections.map((s) => (
          <section key={s.key}>
            <H2>{s.title}</H2>
            <p className="mb-3 text-sm text-zinc-600">{s.intro}</p>
            {s.rows.length > 0 && <T head={['Client', 'Finding', 'Reference', 'Confidence', 'Value']} right={[3, 4]} rows={s.rows.map((x) => [x.client, <span className="font-normal">{x.title}</span>, <span className="text-zinc-500">{x.detail}</span>, `${x.confidence}%`, money(x.value)])} />}
          </section>
        ))}

        <H2>Client profitability</H2>
        <T
          head={['Client', 'MRR', 'Labour', 'Contribution', 'Margin', 'Hours / mo', 'Status']}
          right={[1, 2, 3, 4, 5]}
          rows={r.profitability.map((c) => [c.name, money(c.mrr), money(c.labour_cost), money(c.contribution), pct(c.margin), hours(c.avg_monthly_hours), <HealthDot health={c.health} />])}
        />

        <H2>Recommended actions</H2>
        <ol className="space-y-3">
          {r.actions.map((a, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="tnum mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-white">{i + 1}</span>
              <span className="flex-1 text-zinc-700">
                <span className="font-medium text-zinc-900">{a.client}.</span> {a.action}
              </span>
              <span className="tnum font-semibold">{money(a.value)}</span>
            </li>
          ))}
        </ol>

        <H2>Estimated annual opportunity</H2>
        <p className="text-[15px] leading-relaxed text-zinc-700">
          If the recurring items in this report are corrected, the estimated annual opportunity is <strong className="tnum">{money(r.annual)}</strong> ({money(r.monthly)} a month), in addition to the{' '}
          <strong className="tnum">{money(r.total)}</strong> identified in {r.period}.
        </p>

        <p className="mt-10 border-t border-zinc-100 pt-5 text-xs leading-relaxed text-zinc-500">{DISCLAIMER}</p>
      </Card>
    </>
  )
}
