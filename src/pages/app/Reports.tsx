import { useMemo, useState, type ReactNode } from 'react'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Button, Card, HealthDot, PageHeader, cx } from '../../components/ui'
import { useToast } from '../../components/toast'
import { GetStarted } from './Overview'
import { findingsCsv } from './Findings'
import { buildReport, reportPdf, DISCLAIMER } from '../../lib/report'
import { downloadFile, hours, money, pct, relative } from '../../lib/format'
import { IS_PREVIEW } from '../../lib/env'

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-10 text-lg font-semibold tracking-tight text-ink print:break-after-avoid">{children}</h2>
}

function T({ head, rows, right = [] }: { head: string[]; rows: ReactNode[][]; right?: number[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-body">
        <thead>
          <tr className="border-b border-line text-left text-caption text-ink-3">
            {head.map((h, i) => (
              <th key={h} className={cx('py-2 pr-4 font-medium', right.includes(i) && 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
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
      if (downloadFile(`headroom-report-${slug}.pdf`, await reportPdf(r), 'application/pdf')) {
        await recordReport()
        toast('Report downloaded.')
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not generate the PDF.', 'error')
    } finally {
      setPdfBusy(false)
    }
  }
  const csv = () => {
    if (downloadFile(`headroom-findings-${slug}.csv`, findingsCsv(data.findings.filter((f) => f.status !== 'dismissed'), m.clientName), 'text/csv')) toast('Findings CSV downloaded.')
  }

  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Reports"
          subtitle={data.reports[0] ? `Last downloaded ${relative(data.reports[0].created_at)}` : 'A management-ready summary of this analysis'}
          actions={
            <>
              {!IS_PREVIEW && (
                <Button variant="secondary" size="sm" onClick={() => window.print()}>
                  <Printer className="size-3.5" /> Print
                </Button>
              )}
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

      <Card className="mx-auto max-w-[880px] px-6 py-10 sm:px-12 sm:py-14 print:border-0 print:shadow-none">
        <p className="text-caption font-semibold uppercase tracking-[0.14em] text-ink-3">
          {r.workspace}
          {r.isDemo && <span className="ml-2 text-ink-3">· Demo data</span>}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{r.title}</h1>
        <p className="mt-2 text-body text-ink-3">
          Period: <span className="font-medium text-ink">{r.period}</span> · Generated {r.generated}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            [money(r.total), 'Identified potential leakage'],
            [`${money(r.monthly)}/month`, 'Monthly recurring opportunity'],
            [money(r.annual), 'Annualised opportunity'],
          ].map(([v, l]) => (
            <div key={l} className="rounded-lg border border-line bg-sunken p-4">
              <p className="tnum text-2xl font-semibold tracking-tight">{v}</p>
              <p className="mt-1 text-caption text-ink-3">{l}</p>
            </div>
          ))}
        </div>
        <blockquote className="mt-6 pl-0 text-lg font-medium text-ink">We identified {money(r.total)} of potential revenue leakage across your MSP.</blockquote>

        <H2>Executive summary</H2>
        <div className="space-y-3 text-[15px] leading-relaxed text-ink-2">
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
          rows={r.riskClients.map((c) => [c.name, money(c.leakage), pct(c.margin), <span className="font-normal text-ink-2">{c.reason}</span>])}
        />

        {r.sections.map((s) => (
          <section key={s.key}>
            <H2>{s.title}</H2>
            <p className="mb-3 text-body text-ink-2">{s.intro}</p>
            {s.rows.length > 0 && <T head={['Client', 'Finding', 'Reference', 'Confidence', 'Value']} right={[3, 4]} rows={s.rows.map((x) => [x.client, <span className="font-normal">{x.title}</span>, <span className="text-ink-3">{x.detail}</span>, `${x.confidence}%`, money(x.value)])} />}
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
            <li key={i} className="flex gap-3 text-body">
              <span className="tnum mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-ink">{i + 1}</span>
              <span className="flex-1 text-ink-2">
                <span className="font-medium text-ink">{a.client}.</span> {a.action}
              </span>
              <span className="tnum font-semibold">{money(a.value)}</span>
            </li>
          ))}
        </ol>

        <H2>Estimated annual opportunity</H2>
        <p className="text-[15px] leading-relaxed text-ink-2">
          If the recurring items in this report are corrected, the estimated annual opportunity is <strong className="tnum">{money(r.annual)}</strong> ({money(r.monthly)} a month), in addition to the{' '}
          <strong className="tnum">{money(r.total)}</strong> identified in {r.period}.
        </p>

        <p className="mt-10 border-t border-line-soft pt-5 text-caption leading-relaxed text-ink-3">{DISCLAIMER}</p>
      </Card>
    </>
  )
}
