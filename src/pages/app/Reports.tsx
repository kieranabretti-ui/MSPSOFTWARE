import { useMemo, useState, type ReactNode } from 'react'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Badge, Button, ButtonLink, Card, EmptyState, Figure, Logo, LogoMark, PageHeader, cx } from '../../components/ui'
import { GapBar } from '../../components/bars'
import { ConfidenceLevel } from '../../components/ConfidenceLevel'
import { useToast } from '../../components/toast'
import { findingsCsv } from './findings/csv'
import { buildReport, reportPdf, DISCLAIMER, type ReportModel } from '../../lib/report'
import { downloadFile, hours, money, pct, plural, relative } from '../../lib/format'
import { IS_PREVIEW } from '../../lib/env'
import { CONFIDENCE } from '../../lib/labels'
import { mapError } from '../../lib/errors'
import { track } from '../../lib/track'
import { ClientHealth, MarginValue } from './clients/parts'

const opportunities = (n: number) => plural(n, 'opportunity', 'opportunities')

function Section({ id, title, figure, intro, children }: { id: string; title: string; figure?: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-14 print:mt-10">
      <div className="flex items-baseline justify-between gap-4 print:break-after-avoid">
        <h3 id={id} className="text-h2 text-ink">
          {title}
        </h3>
        {figure && <span className="tnum shrink-0 text-data-md text-accent">{figure}</span>}
      </div>
      {intro && <p className="mt-1.5 max-w-[68ch] text-body text-ink-3">{intro}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

// A report table: label row on a firm rule, hairlines between rows, figures
// right-aligned and tabular. `wide` columns drop out below the sm breakpoint;
// rows carry that detail on a second line instead.
interface Col {
  label: string
  num?: boolean
  wide?: boolean
  // a fixed width from sm up, so sibling tables share their columns
  w?: string
}

function Ledger({ caption, cols, rows, foot, fixed }: { caption: string; cols: Col[]; rows: ReactNode[][]; foot?: ReactNode[]; fixed?: boolean }) {
  // The last column on screen carries no trailing padding, on phones as well
  // as on wider screens where the wide columns return.
  const lastOnPhone = (i: number) => cols.slice(i + 1).every((c) => c.wide)
  const cell = (c: Col, i: number) => cx(c.num ? 'text-right' : 'text-left', c.wide && 'hidden sm:table-cell', i < cols.length - 1 && 'pr-4 sm:pr-6', lastOnPhone(i) && 'max-sm:pr-0')
  return (
    <table className={cx('w-full text-small', fixed && 'sm:table-fixed')}>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-line-strong">
          {cols.map((c, i) => (
            <th key={c.label} scope="col" className={cx('pb-2.5 align-bottom text-label uppercase text-ink-3', cell(c, i), c.w)}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft">
        {rows.map((r, i) => (
          <tr key={i} className="align-top print:break-inside-avoid">
            {r.map((v, j) => (
              <td key={j} className={cx('py-3', cell(cols[j], j), cols[j].num ? 'tnum text-ink' : j === 0 ? 'font-medium text-ink' : 'text-ink-2')}>
                {v}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {foot && (
        <tfoot>
          <tr className="border-t border-line-strong">
            {foot.map((v, j) => (
              <td key={j} className={cx('pt-3 font-semibold text-ink', cell(cols[j], j), cols[j].num && 'tnum')}>
                {v}
              </td>
            ))}
          </tr>
        </tfoot>
      )}
    </table>
  )
}

function Share({ share, max }: { share: number; max: number }) {
  return (
    <span className="flex items-center justify-end gap-3">
      <span className="hidden h-1 w-20 overflow-hidden rounded-full bg-line-soft sm:block" aria-hidden>
        <span className="block h-full rounded-full bg-viz-series-strong" style={{ width: `${max > 0 ? (share / max) * 100 : 0}%` }} />
      </span>
      <span className="w-9">{pct(share)}</span>
    </span>
  )
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="border-y border-line-soft py-4 text-body text-ink-3">{children}</p>
}

// What each confidence level means, and how many opportunities sit at it. The
// PDF draws the same box after its breakdown.
function ReadingConfidence({ levels }: { levels: ReportModel['levels'] }) {
  return (
    <div className="mt-8 rounded-lg bg-sunken px-5 py-4 sm:px-6 print:break-inside-avoid">
      <h4 className="text-small font-semibold text-ink">How to read confidence</h4>
      <dl className="mt-2 divide-y divide-line-soft">
        {levels.map((l) => (
          <div key={l.level} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[6.5rem_minmax(0,1fr)_auto]">
            <dt>
              <ConfidenceLevel level={l.level} short />
            </dt>
            <dd className="col-span-2 row-start-2 text-small text-ink-2 sm:col-span-1 sm:row-start-auto">{CONFIDENCE[l.level].definition}</dd>
            <dd className="tnum whitespace-nowrap text-right text-small text-ink-3">
              {opportunities(l.count)} · {money(l.value)}
            </dd>
          </div>
        ))}
      </dl>
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
        <Card>
          <EmptyState
            title="No report yet"
            body="Run your first analysis and the report is written from it: the leakage found, the clients most at risk and what to do first, ready to download as PDF."
            action={
              <ButtonLink to="/app/analyses" variant="accent">
                Start analysis
              </ButtonLink>
            }
          />
        </Card>
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
      toast(mapError(e, 'report'), 'error')
    } finally {
      setPdfBusy(false)
    }
  }
  const csv = () => {
    if (downloadFile(`headroom-opportunities-${slug}.csv`, findingsCsv(data.findings.filter((f) => f.status !== 'dismissed'), m.clientName), 'text/csv')) {
      track('report_downloaded', { format: 'csv' })
      toast('Opportunities CSV downloaded.')
    }
  }
  const print = () => {
    track('report_downloaded', { format: 'print' })
    window.print()
  }

  const maxShare = Math.max(0, ...r.breakdown.map((b) => b.share))

  return (
    <>
      <div className="no-print max-w-[880px]">
        <PageHeader
          title="Reports"
          subtitle={
            <span className="tnum">
              {r.period} · {data.reports[0] ? `Last downloaded ${relative(data.reports[0].created_at)}` : 'Ready to download and share'}
            </span>
          }
          actions={
            <>
              {!IS_PREVIEW && (
                <Button variant="ghost" size="sm" onClick={print}>
                  <Printer className="size-4" /> Print
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={csv}>
                <FileSpreadsheet className="size-4" /> Download CSV
              </Button>
              <Button size="sm" onClick={pdf} loading={pdfBusy} data-testid="download-pdf">
                {!pdfBusy && <Download className="size-4" />} Download PDF
              </Button>
            </>
          }
        />
      </div>

      {/* The preview is the document: the PDF's ink cover band, then the report
          on paper, drawn with the same paper tokens the PDF and print use. */}
      <article aria-labelledby="report-title" className="max-w-[880px] overflow-hidden rounded-xl border border-line print:max-w-none print:rounded-none print:border-0">
        <header className="bg-canvas px-5 pb-8 pt-5 sm:px-12 sm:pb-10 sm:pt-8 print:px-0">
          <div className="flex items-center justify-between gap-4">
            <Logo />
            {r.isDemo && <Badge>Demo data</Badge>}
          </div>
          <h2 id="report-title" className="mt-12 text-balance text-[clamp(1.875rem,4.4vw,2.625rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-ink sm:mt-16">
            {r.title}
          </h2>
          <p className="tnum mt-3 text-body text-ink-3">
            {r.workspace} · {r.period} · Generated {r.generated}
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line-soft pt-7 sm:mt-10 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] sm:grid-rows-[auto_auto_auto] sm:gap-y-0 sm:pt-8">
            <div className="col-span-2 sm:col-span-1 sm:row-span-3 sm:grid sm:grid-rows-subgrid">
              <dt className="text-small text-ink-3">Potential revenue leakage identified</dt>
              <dd className="mt-2 sm:self-end">
                <Figure size="xl">{money(r.total)}</Figure>
              </dd>
              <dd className="tnum mt-2.5 text-small text-ink-3">
                {opportunities(r.findingCount)} in {r.period}
              </dd>
            </div>
            <div className="sm:row-span-3 sm:grid sm:grid-rows-subgrid">
              <dt className="text-small text-ink-3">Recurring leakage</dt>
              <dd className="mt-2 flex flex-wrap items-baseline gap-x-1.5 sm:self-end">
                <Figure tone={r.monthly > 0 ? 'accent' : 'muted'}>{money(r.monthly)}</Figure>
                <span className="text-small text-ink-3">a month</span>
              </dd>
              <dd className="tnum mt-2.5 text-caption text-ink-3">
                {r.recurringAgreement > 0 && r.recurringPricing > 0 ? (
                  <>
                    <span className="block">{money(r.recurringAgreement)} agreement and billing</span>
                    <span className="block">{money(r.recurringPricing)} pricing below target</span>
                  </>
                ) : (
                  'Potential MRR to recover'
                )}
              </dd>
            </div>
            <div className="sm:row-span-3 sm:grid sm:grid-rows-subgrid">
              <dt className="text-small text-ink-3">Annualised</dt>
              <dd className="mt-2 sm:self-end">
                <Figure>{money(r.annual)}</Figure>
              </dd>
              <dd className="mt-2.5 text-caption text-ink-3">If left uncorrected</dd>
            </div>
          </dl>

          {r.billed > 0 && <GapBar billed={r.billed} gap={r.total} height={14} className="mt-8" />}
        </header>

        <div data-surface="paper" className="bg-surface text-ink">
          <div className="px-5 py-10 sm:px-12 sm:py-12 print:px-0">
            <p className="max-w-[34ch] text-balance text-[clamp(1.25rem,2.6vw,1.5rem)] font-medium leading-[1.35] tracking-[-0.015em] text-ink">
              We identified <span className="tnum font-semibold text-accent">{money(r.total)}</span> of potential revenue leakage across your MSP.
            </p>

            <Section id="rp-summary" title="Executive summary">
              <div className="max-w-[68ch] space-y-3 text-body leading-[1.7] text-ink-2">
                {r.executiveSummary.map((p) => (
                  <p key={p} className="tnum">
                    {p}
                  </p>
                ))}
              </div>
            </Section>

            <Section id="rp-breakdown" title="Revenue leakage breakdown" figure={money(r.total)}>
              <Ledger
                caption="Revenue leakage by category"
                cols={[{ label: 'Category' }, { label: 'Opportunities', num: true, wide: true }, { label: 'Potential value', num: true }, { label: 'Share', num: true }]}
                rows={r.breakdown.map((b) => [
                  <>
                    {b.label}
                    <span className="tnum mt-0.5 block text-caption font-normal text-ink-3 sm:hidden">{opportunities(b.count)}</span>
                  </>,
                  b.count,
                  money(b.value),
                  <Share share={b.share} max={maxShare} />,
                ])}
                foot={['Total', r.findingCount, money(r.total), r.total > 0 ? '100%' : '0%']}
              />
              {r.findingCount > 0 && <ReadingConfidence levels={r.levels} />}
            </Section>

            <Section id="rp-risk" title="Highest risk clients">
              {r.riskClients.length > 0 ? (
                <Ledger
                  caption="Highest risk clients"
                  cols={[{ label: 'Client' }, { label: 'Leakage', num: true }, { label: 'Margin', num: true }, { label: 'Status', wide: true }, { label: 'Main reason', wide: true }]}
                  rows={r.riskClients.map((c) => [
                    <>
                      {c.name}
                      <span className="mt-1 block sm:hidden">
                        <ClientHealth health={c.status} known={c.known} />
                      </span>
                      {c.reason && <span className="mt-1 block text-caption font-normal text-ink-3 sm:hidden">{c.reason}</span>}
                    </>,
                    money(c.leakage),
                    <MarginValue margin={c.margin} target={r.targetMargin} known={c.known} />,
                    <ClientHealth health={c.status} known={c.known} />,
                    c.reason,
                  ])}
                />
              ) : (
                <Quiet>No client is carrying leakage or sitting below target margin.</Quiet>
              )}
            </Section>

            {r.sections.map((s) => (
              <Section key={s.key} id={`rp-${s.key}`} title={s.title} figure={s.value > 0 ? money(s.value) : undefined} intro={<span className="tnum">{s.intro}</span>}>
                {s.rows.length > 0 && (
                  <Ledger
                    caption={s.title}
                    fixed
                    cols={[
                      { label: 'Client', wide: true, w: 'sm:w-44' },
                      { label: 'Opportunity' },
                      { label: 'Confidence', wide: true, w: 'sm:w-28' },
                      { label: 'Value', num: true, w: 'sm:w-20' },
                    ]}
                    rows={[
                      ...s.rows.map((x) => [
                      x.client,
                      <>
                        <span className="block text-ink">{x.title}</span>
                        <span className="tnum mt-0.5 block text-caption text-ink-3 sm:hidden">{[x.client, x.detail].filter(Boolean).join(' · ')}</span>
                        <span className="mt-1 block sm:hidden">
                          <ConfidenceLevel level={x.level} short />
                        </span>
                        {x.detail && <span className="tnum mt-0.5 hidden text-caption text-ink-3 sm:block">{x.detail}</span>}
                      </>,
                      <ConfidenceLevel level={x.level} short />,
                      money(x.value),
                    ]),
                      ...(s.more
                        ? [
                            [
                              '',
                              <span className="tnum text-ink-3">+ {s.more.count} more {s.more.count === 1 ? 'opportunity' : 'opportunities'}</span>,
                              '',
                              <span className="text-ink-2">{money(s.more.value)}</span>,
                            ],
                          ]
                        : []),
                    ]}
                  />
                )}
              </Section>
            ))}

            <Section id="rp-profitability" title="Client profitability" intro="Average month in the period, weakest margin first.">
              <Ledger
                caption="Client profitability"
                cols={[
                  { label: 'Client' },
                  { label: 'MRR', num: true, wide: true },
                  { label: 'Labour', num: true, wide: true },
                  { label: 'Software', num: true, wide: true },
                  { label: 'Contribution', num: true },
                  { label: 'Margin', num: true },
                  { label: 'Hours / mo', num: true, wide: true },
                  { label: 'Status', wide: true },
                ]}
                rows={r.profitability.map((c) => [
                  <>
                    {c.name}
                    <span className="mt-1 block sm:hidden">
                      <ClientHealth health={c.health} known={c.known} />
                    </span>
                  </>,
                  money(c.mrr),
                  money(c.labour_cost),
                  money(c.software_cost),
                  money(c.contribution),
                  <MarginValue margin={c.margin} target={r.targetMargin} known={c.known} />,
                  hours(c.avg_monthly_hours),
                  <ClientHealth health={c.health} known={c.known} />,
                ])}
              />
            </Section>

            <Section id="rp-actions" title="Recommended actions" intro="Opportunities not yet actioned, largest first.">
              {r.actions.length > 0 ? (
                <ol className="divide-y divide-line-soft border-y border-line-soft">
                  {r.actions.map((a, i) => (
                    <li key={i} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-3 py-3.5 text-body print:break-inside-avoid sm:gap-x-4">
                      <span className="tnum text-small leading-[1.55rem] text-ink-3">{i + 1}</span>
                      <div className="tnum text-ink-2">
                        <p>
                          <span className="font-medium text-ink">{a.client}.</span> {a.action}
                        </p>
                        {a.note && <p className="mt-1 text-small text-ink-3">{a.note}</p>}
                      </div>
                      <span className="tnum text-right font-semibold text-ink">{money(a.value)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <Quiet>Every opportunity in this report has been actioned. Run a new analysis when fresh exports arrive.</Quiet>
              )}
            </Section>

            <section aria-labelledby="rp-annual" className="mt-14 grid grid-cols-1 gap-x-8 gap-y-3 rounded-lg bg-sunken px-5 py-5 sm:grid-cols-[11rem_minmax(0,1fr)] sm:px-6 print:mt-10 print:break-inside-avoid">
              <div>
                <h3 id="rp-annual" className="text-small text-ink-3">
                  Estimated annual opportunity
                </h3>
                <p className="mt-1.5">
                  <Figure tone="accent">{money(r.annual)}</Figure>
                </p>
              </div>
              <p className="tnum max-w-[60ch] text-body leading-[1.7] text-ink-2 sm:pt-0.5">
                If the recurring items in this report are corrected, the estimated annual opportunity is <strong className="font-semibold text-ink">{money(r.annual)}</strong> ({money(r.monthly)} a month), in addition to the{' '}
                <strong className="font-semibold text-ink">{money(r.total)}</strong> identified in {r.period}.
                {r.overlap.monthly > 0 && ` Up to ${money(r.overlap.monthly * 12)} a year of it overlaps at ${r.overlap.clients.join(' and ')}.`}
              </p>
            </section>
          </div>

          <footer className="border-t border-line-soft px-5 py-6 sm:px-12 print:px-0">
            <p className="max-w-[78ch] text-caption leading-relaxed text-ink-3">{DISCLAIMER}</p>
            <p className="tnum mt-4 flex items-center gap-2 text-caption text-ink-3">
              <LogoMark className="h-3 w-auto" />
              Headroom · {r.workspace} · {r.period}
            </p>
          </footer>
        </div>
      </article>
    </>
  )
}
