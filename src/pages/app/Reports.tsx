import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Link } from 'react-router-dom'
import { Download, FileSpreadsheet, Printer } from 'lucide-react'
import { useMetrics, useStore } from '../../data/store'
import { Badge, Button, ButtonLink, Card, EmptyState, Figure, Logo, LogoMark, PageHeader, cx } from '../../components/ui'
import { GapBar } from '../../components/bars'
import { ConfidenceLevel } from '../../components/ConfidenceLevel'
import { useToast } from '../../components/toast'
import { findingsCsv } from './findings/csv'
import { DECISION_LINE, DISCLAIMER, METHODOLOGY, aiSentence, annualSentence, buildReport, companyLine, currentAiExplanations, headlineSentence, reportPdf, type EvidenceRow, type ReportModel } from '../../lib/report'
import { downloadFile, hours, money, pct, plural, relative } from '../../lib/format'
import { IS_PREVIEW } from '../../lib/env'
import { CLASSIFICATION, CONFIDENCE_NOTE, FINDING_STATUS } from '../../lib/labels'
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

// What each confidence level and classification means, and how many
// opportunities sit at each. The PDF draws the same box after its breakdown.
function ReadingConfidence({ levels, classes }: { levels: ReportModel['levels']; classes: ReportModel['classes'] }) {
  const row = 'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 py-2.5 sm:grid-cols-[8.5rem_minmax(0,1fr)_auto]'
  const def = 'col-span-2 row-start-2 text-small text-ink-2 sm:col-span-1 sm:row-start-auto'
  const count = 'tnum whitespace-nowrap text-right text-small text-ink-3'
  return (
    <div className="mt-8 rounded-lg bg-sunken px-5 py-4 sm:px-6 print:break-inside-avoid">
      <h4 className="text-small font-semibold text-ink">How to read confidence</h4>
      <dl className="mt-2 divide-y divide-line-soft">
        {levels.map((l) => (
          <div key={l.level} className={row}>
            <dt>
              <ConfidenceLevel level={l.level} short />
            </dt>
            <dd className={def}>{l.definition}</dd>
            <dd className={count}>
              {opportunities(l.count)} · {money(l.value)}
            </dd>
          </div>
        ))}
      </dl>
      <h4 className="mt-5 text-small font-semibold text-ink">Classification</h4>
      <dl className="mt-2 divide-y divide-line-soft">
        {classes.map((c) => (
          <div key={c.classification} className={row}>
            <dt className="text-caption font-medium text-ink-2">{CLASSIFICATION[c.classification].short}</dt>
            <dd className={def}>{c.definition}</dd>
            <dd className={count}>
              {opportunities(c.count)} · {money(c.value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-caption text-ink-3">{CONFIDENCE_NOTE}</p>
    </div>
  )
}

function Tags({ e }: { e: EvidenceRow }) {
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-3">
      <ConfidenceLevel level={e.level} />
      <span>{CLASSIFICATION[e.classification].label}</span>
      <span>
        Stage: <span className="font-medium text-ink-2">{FINDING_STATUS[e.status]}</span>
      </span>
    </span>
  )
}

// One opportunity with its evidence, as the PDF prints it: what was found, the
// records it rests on, the calculation, the confidence basis, the stage and the
// recommendation. AI text appears only when written for this evidence, labelled.
function EvidenceItem({ e }: { e: EvidenceRow }) {
  const label = 'text-caption text-ink-3 sm:pt-px'
  return (
    <article aria-labelledby={`ev-${e.ref}`} className="border-b border-line-soft py-5 first:pt-1 print:break-inside-avoid">
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-x-3">
        <span className="tnum text-caption font-medium text-ink-3">{e.ref}</span>
        <h4 id={`ev-${e.ref}`} className="text-body font-semibold text-ink">
          <Link to={`/app/opportunities/${e.id}`} className="underline-offset-4 hover:underline">
            {e.title}
          </Link>
        </h4>
        <span className="tnum text-body font-semibold text-ink">{money(e.value)}</span>
      </div>
      <div className="mt-1 sm:pl-[3rem]">
        <p className="tnum text-small text-ink-3">
          {e.client} · {e.categoryLabel} · {e.result}
        </p>
        <div className="mt-2">
          <Tags e={e} />
        </div>
        <dl className="mt-3.5 grid gap-x-5 gap-y-1 text-small sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-y-3">
          <dt className={label}>Calculation</dt>
          <dd className="tnum mb-2.5 text-ink-2 sm:mb-0">
            {e.calc.length ? (
              <ul className="space-y-0.5">
                {e.calc.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
            ) : (
              e.result
            )}
            {e.calcNote && <p className="mt-1 text-caption text-ink-3">{e.calcNote}</p>}
          </dd>
          <dt className={label}>Source</dt>
          <dd className="tnum mb-2.5 min-w-0 break-words text-ink-2 sm:mb-0">
            {e.sources.length ? (
              <ul className="space-y-0.5">
                {e.sources.map((s, i) => (
                  <li key={i}>
                    <span className="text-ink-3">{s.source}:</span> {s.detail}
                  </li>
                ))}
              </ul>
            ) : (
              'No source records were saved with this opportunity.'
            )}
          </dd>
          <dt className={label}>Confidence basis</dt>
          <dd className="mb-2.5 text-ink-2 sm:mb-0">{e.basis}</dd>
          <dt className={label}>Recommendation</dt>
          <dd className="tnum text-ink-2">{e.action}</dd>
          {e.ai && (
            <>
              <dt className={cx(label, 'mt-2.5 sm:mt-0')}>AI-assisted explanation</dt>
              <dd className="text-ink-2">
                <p>{e.ai.text}</p>
                <p className="mt-1 text-caption text-ink-3">
                  {[e.ai.model ? `Model ${e.ai.model}` : null, e.ai.generated ? `written ${e.ai.generated}` : null].filter(Boolean).join(', ')}. Wording only: no figure here comes from AI.
                </p>
              </dd>
            </>
          )}
        </dl>
      </div>
    </article>
  )
}

function Pairs({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <dl className="divide-y divide-line-soft border-y border-line-soft text-small">
      {rows.map((x) => (
        <div key={x.label} className="grid gap-x-5 gap-y-0.5 py-2.5 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <dt className="text-ink-3">{x.label}</dt>
          <dd className="tnum text-ink-2">{x.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function Reports() {
  const { workspace, analysis, data, recordReport, logExport } = useStore()
  const m = useMetrics()
  const toast = useToast()
  const [pdfBusy, setPdfBusy] = useState(false)
  const [showAll, setShowAll] = useState(false)
  // AI explanations go into the report only when written for the evidence the
  // finding carries now; checked asynchronously, so none show until it is done.
  const [aiCurrent, setAiCurrent] = useState<Set<string>>(() => new Set())
  useEffect(() => {
    let live = true
    currentAiExplanations(data.findings).then((s) => live && setAiCurrent(s))
    return () => {
      live = false
    }
  }, [data.findings])
  // Printing from the browser menu still prints the whole appendix.
  useEffect(() => {
    const open = () => flushSync(() => setShowAll(true))
    window.addEventListener('beforeprint', open)
    return () => window.removeEventListener('beforeprint', open)
  }, [])
  const r = useMemo(() => (workspace && analysis ? buildReport(workspace, analysis, data, { aiCurrent }) : null), [workspace, analysis, data, aiCurrent])

  if (!r)
    return (
      <>
        <PageHeader title="Reports" />
        <Card>
          <EmptyState
            title="No report yet"
            body="Run your first analysis and the report is written from it: each opportunity with its evidence and calculation, high confidence shown apart from what needs review, ready to download as PDF."
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
        // Writes the report record and the export.pdf audit event.
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
    const rows = data.findings.filter((f) => f.status !== 'dismissed')
    if (downloadFile(`headroom-opportunities-${slug}.csv`, findingsCsv(rows, m.clientName), 'text/csv')) {
      track('report_downloaded', { format: 'csv' })
      logExport('csv', { rows: rows.length, scope: 'report' }).catch(() => {})
      toast('Opportunities CSV downloaded.')
    }
  }
  const print = () => {
    track('report_downloaded', { format: 'print' })
    // The audit log has no print format yet: printing is recorded as a report export.
    logExport('pdf', { rows: r.findingCount, scope: 'report' }).catch(() => {})
    flushSync(() => setShowAll(true))
    window.print()
  }

  const maxShare = Math.max(0, ...r.breakdown.map((b) => b.share))
  const highShown = r.split.high.count > 0

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

      {/* The preview is the document: the PDF's cover, then the report on
          paper, drawn with the same paper tokens the PDF and print use. */}
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

          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line-soft pt-7 sm:mt-10 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] sm:grid-rows-[auto_auto_auto] sm:gap-y-0 sm:pt-8">
            <div className="col-span-2 sm:col-span-1 sm:row-span-3 sm:grid sm:grid-rows-subgrid">
              <dt className="text-small text-ink-3">High confidence</dt>
              <dd className="mt-2 sm:self-end">
                <Figure size="xl" tone={highShown ? 'accent' : 'muted'} testId="report-high">
                  {money(r.split.high.value)}
                </Figure>
              </dd>
              <dd className="tnum mt-2.5 text-small text-ink-3">
                {opportunities(r.split.high.count)}
                {r.split.high.monthly > 0 && `, ${money(r.split.high.monthly)} a month recurring`}
              </dd>
            </div>
            <div className="sm:row-span-3 sm:grid sm:grid-rows-subgrid">
              <dt className="text-small text-ink-3">Requires review</dt>
              <dd className="mt-2 sm:self-end">
                <Figure>{money(r.split.review.value)}</Figure>
              </dd>
              <dd className="tnum mt-2.5 text-caption text-ink-3">
                {opportunities(r.split.review.count)}
                {r.split.review.monthly > 0 && `, ${money(r.split.review.monthly)} a month recurring`}
              </dd>
            </div>
            <div className="sm:row-span-3 sm:grid sm:grid-rows-subgrid">
              <dt className="text-small text-ink-3">Total potential</dt>
              <dd className="mt-2 sm:self-end">
                <Figure testId="report-total">{money(r.total)}</Figure>
              </dd>
              <dd className="tnum mt-2.5 text-caption text-ink-3">High confidence plus requires review, {opportunities(r.findingCount)}</dd>
            </div>
          </dl>

          {r.agreementValue > 0 && (
            <>
              <GapBar billed={r.agreementValue} gap={r.total} billedLabel="Agreement value over the period" label={false} height={14} className="mt-8" />
              {/* Captioned here rather than by the bar, so lime stays on the high-confidence figure alone. */}
              <p className="tnum mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-caption text-ink-3">
                <span>
                  Agreement value over the period <span className="text-ink-2">{money(r.agreementValue)}</span>
                </span>
                <span>
                  Total potential <span className="font-semibold text-ink">{money(r.total)}</span> · {((r.total / (r.agreementValue + r.total)) * 100).toFixed(1)}%
                </span>
              </p>
            </>
          )}
        </header>

        <div data-surface="paper" className="bg-surface text-ink">
          <div className="px-5 py-10 sm:px-12 sm:py-12 print:px-0">
            <p className="max-w-[40ch] text-balance text-[clamp(1.125rem,2.4vw,1.375rem)] font-medium leading-[1.4] tracking-[-0.015em] text-ink">
              {r.split.high.count && r.split.review.count ? (
                <>
                  <span className="tnum font-semibold text-accent">{money(r.split.high.value)}</span> is high-confidence opportunity, the strongest evidence in your data, still subject to your review. A further{' '}
                  <span className="tnum font-semibold">{money(r.split.review.value)}</span> requires review before action.
                </>
              ) : (
                headlineSentence(r)
              )}
            </p>
            {r.monthly > 0 && (
              <p className="tnum mt-4 flex flex-wrap gap-x-6 gap-y-1 text-small text-ink-3">
                <span>
                  Recurring <span className="font-semibold text-ink">{money(r.monthly)} a month</span> ({money(r.split.high.monthly)} high confidence)
                </span>
                <span>
                  Annualised <span className="font-semibold text-ink">{money(r.annual)}</span> ({money(r.split.high.monthly * 12)} high confidence)
                </span>
              </p>
            )}
            <p className="mt-2 text-small text-ink-3">{DECISION_LINE}</p>

            <Section id="rp-summary" title="Executive summary">
              <div className="max-w-[68ch] space-y-3 text-body leading-[1.7] text-ink-2">
                {r.executiveSummary.map((p) => (
                  <p key={p} className="tnum">
                    {p}
                  </p>
                ))}
              </div>
            </Section>

            <Section id="rp-breakdown" title="Potential opportunity by type" figure={money(r.total)}>
              <Ledger
                caption="Potential opportunity by type"
                cols={[{ label: 'Type' }, { label: 'Opportunities', num: true, wide: true }, { label: 'High confidence', num: true, wide: true }, { label: 'Potential value', num: true }, { label: 'Share', num: true }]}
                rows={r.breakdown.map((b) => [
                  <>
                    {b.label}
                    <span className="tnum mt-0.5 block text-caption font-normal text-ink-3 sm:hidden">
                      {opportunities(b.count)} · {money(b.high)} high confidence
                    </span>
                  </>,
                  b.count,
                  money(b.high),
                  money(b.value),
                  <Share share={b.share} max={maxShare} />,
                ])}
                foot={['Total', r.findingCount, money(r.split.high.value), money(r.total), r.total > 0 ? '100%' : '0%']}
              />
              {r.findingCount > 0 && <ReadingConfidence levels={r.levels} classes={r.classes} />}
            </Section>

            <Section id="rp-stages" title="Review status" intro="Every opportunity starts as New. Approved means you have checked it; Actioned means it has been billed or the agreement updated. Dismissed opportunities are left out of this report.">
              <Ledger
                caption="Opportunities by review stage"
                cols={[{ label: 'Stage' }, { label: 'Opportunities', num: true }, { label: 'Potential value', num: true }]}
                rows={r.stages.map((st) => [st.label, st.count, money(st.value)])}
                foot={['Total', r.findingCount, money(r.total)]}
              />
            </Section>

            {r.top.length > 0 && (
              <Section id="rp-top" title="Largest opportunities, with evidence" intro="Each with the records it rests on and the calculation behind its value. The appendix shows the same for every opportunity.">
                <div className="border-t border-line-strong">
                  {r.top.map((e) => (
                    <EvidenceItem key={e.id} e={e} />
                  ))}
                </div>
              </Section>
            )}

            <Section id="rp-risk" title="Highest risk clients">
              {r.riskClients.length > 0 ? (
                <Ledger
                  caption="Highest risk clients"
                  cols={[{ label: 'Client' }, { label: 'Potential', num: true }, { label: 'Margin', num: true }, { label: 'Status', wide: true }, { label: 'Main reason', wide: true }]}
                  rows={r.riskClients.map((c) => [
                    <>
                      {c.name}
                      <span className="mt-1 block sm:hidden">
                        <ClientHealth health={c.status} known={c.known} />
                      </span>
                      {c.reason && <span className="mt-1 block text-caption font-normal text-ink-3 sm:hidden">{c.reason}</span>}
                    </>,
                    money(c.potential),
                    <MarginValue margin={c.margin} target={r.targetMargin} known={c.known} />,
                    <ClientHealth health={c.status} known={c.known} />,
                    c.reason,
                  ])}
                />
              ) : (
                <Quiet>No client carries a potential opportunity or sits below target margin.</Quiet>
              )}
            </Section>

            {r.sections.map((s) => (
              <Section key={s.key} id={`rp-${s.key}`} title={s.title} figure={money(s.value)} intro={<span className="tnum">{s.intro}</span>}>
                <Ledger
                  caption={s.title}
                  fixed
                  cols={[
                    { label: 'Ref', w: 'w-10 sm:w-12' },
                    { label: 'Client', wide: true, w: 'sm:w-40' },
                    { label: 'Opportunity' },
                    { label: 'Confidence', wide: true, w: 'sm:w-24' },
                    { label: 'Stage', wide: true, w: 'sm:w-24' },
                    { label: 'Value', num: true, w: 'w-20' },
                  ]}
                  rows={[
                    ...s.rows.map((x) => [
                      <span className="tnum font-normal text-ink-3">{x.ref}</span>,
                      x.client,
                      <>
                        <span className="block text-ink">{x.title}</span>
                        <span className="tnum mt-0.5 block text-caption text-ink-3 sm:hidden">
                          {x.client} · {x.result}
                        </span>
                        <span className="tnum mt-0.5 hidden text-caption text-ink-3 sm:block">{x.result}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-3 sm:hidden">
                          <ConfidenceLevel level={x.level} short />
                          <span className="text-caption text-ink-3">{FINDING_STATUS[x.status]}</span>
                        </span>
                      </>,
                      <ConfidenceLevel level={x.level} short />,
                      <span className="text-caption text-ink-2">{FINDING_STATUS[x.status]}</span>,
                      money(x.value),
                    ]),
                    ...(s.more
                      ? [
                          [
                            '',
                            '',
                            <span className="tnum text-ink-3">
                              + {opportunities(s.more.count)} more ({s.more.from} to {s.more.to} in the appendix)
                            </span>,
                            '',
                            '',
                            <span className="text-ink-2">{money(s.more.value)}</span>,
                          ],
                        ]
                      : []),
                  ]}
                />
              </Section>
            ))}

            <Section id="rp-profitability" title="Client profitability" intro="Average month in the period, weakest margin first. Margins are modelled from your labour and software cost settings, not read from your accounts.">
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

            <Section id="rp-actions" title="Recommended actions" intro="Opportunities not yet actioned, largest first. Each needs your review before you bill or change an agreement.">
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
                        <p className="mt-1 text-caption text-ink-3">Evidence: {a.ref}</p>
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
                  <Figure>{money(r.annual)}</Figure>
                </p>
                <p className="tnum mt-1 text-caption text-ink-3">{money(r.split.high.monthly * 12)} high confidence</p>
              </div>
              <p className="tnum max-w-[60ch] text-body leading-[1.7] text-ink-2 sm:pt-0.5">{annualSentence(r)}</p>
            </section>

            <Section id="rp-method" title="Methodology">
              <div className="max-w-[68ch] space-y-3 text-body leading-[1.7] text-ink-2">
                {METHODOLOGY.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              <h4 className="mt-8 text-small font-semibold text-ink">AI</h4>
              <p className="mt-1.5 max-w-[68ch] text-body leading-[1.7] text-ink-2">{aiSentence(r)}</p>
              <h4 className="mt-8 text-small font-semibold text-ink">Data analysed</h4>
              <div className="mt-2">
                <Pairs rows={r.inputs} />
              </div>
              <h4 className="mt-8 text-small font-semibold text-ink">Settings used</h4>
              <p className="mt-1 text-small text-ink-3">Used only where the records give no value. Each opportunity that relies on one says so in its source and confidence basis.</p>
              <div className="mt-2">
                <Pairs rows={r.assumptions} />
              </div>
              <h4 className="mt-8 text-small font-semibold text-ink">Agreement value</h4>
              <p className="tnum mt-1.5 max-w-[68ch] text-body leading-[1.7] text-ink-2">
                The agreement value of {money(r.agreementValue)} on the cover is the monthly agreement value (MRR) in your clients file multiplied by the {plural(r.months, 'month')} analysed. It is not taken from invoices, so it may differ from your
                accounts.
              </p>
            </Section>

            {r.evidence.length > 0 && (
              <Section id="rp-appendix" title="Appendix: evidence for every opportunity" intro={`${opportunities(r.evidence.length)}, grouped by type and largest first. Each shows the records it rests on, the calculation, what its confidence is based on, its stage and the recommendation.`}>
                {showAll ? (
                  r.sections.map((s) => (
                    <div key={s.key} className="mt-8 first:mt-0">
                      <div className="flex items-baseline justify-between gap-4 border-b border-line-strong pb-2.5">
                        <h4 className="text-small font-semibold text-ink">{s.title}</h4>
                        <span className="tnum text-small text-ink-2">{money(s.value)}</span>
                      </div>
                      {r.evidence
                        .filter((e) => e.category === s.key)
                        .map((e) => (
                          <EvidenceItem key={e.id} e={e} />
                        ))}
                    </div>
                  ))
                ) : (
                  <div className="no-print">
                    <Button variant="secondary" size="sm" onClick={() => setShowAll(true)}>
                      Show evidence for all {opportunities(r.evidence.length)}
                    </Button>
                    <p className="mt-2 text-caption text-ink-3">The PDF and printed report always include it.</p>
                  </div>
                )}
              </Section>
            )}
          </div>

          <footer className="border-t border-line-soft px-5 py-6 sm:px-12 print:px-0">
            <p className="max-w-[78ch] text-caption leading-relaxed text-ink-3">{DISCLAIMER}</p>
            {companyLine() && <p className="mt-2 max-w-[78ch] text-caption leading-relaxed text-ink-3">{companyLine()}</p>}
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
