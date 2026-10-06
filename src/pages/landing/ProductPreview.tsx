import type { ReactNode } from 'react'
import { ArrowDown, Clock } from 'lucide-react'
import { Badge, Confidence, Figure, SeverityBadge, cx } from '../../components/ui'
import { ICONS } from '../../brand/icons'
import { money, plural } from '../../lib/format'
import { CATEGORY_META } from '../../lib/labels'
import { DEMO } from './demoSnapshot'
import { Highlighted, Section, SectionIntro, shortDate } from './primitives'

// The product, drawn with the app's own components and the demo's own rows:
// the out-of-scope findings list and the evidence behind one of them.

const TH = 'py-2.5 text-left text-label uppercase text-ink-3'

function EvidenceRow({ icon, name, source, children }: { icon: ReactNode; name: ReactNode; source?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-x-5 gap-y-2.5 border-t border-line-soft py-4 first:border-t-0 first:pt-0 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-small font-medium text-ink">
          <span className="text-ink-3" aria-hidden>
            {icon}
          </span>
          <span className="tnum min-w-0">{name}</span>
        </p>
        {source && <p className="mt-0.5 text-caption text-ink-3 sm:pl-6">{source}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function ProductPreview() {
  const oos = DEMO.outOfScope
  const sp = DEMO.spotlight
  const f = sp.finding
  const selected = (ref: string | null) => ref === f.ticketRef

  return (
    <Section id="product" label="product-title">
      <SectionIntro id="product-title" title="Every pound comes with its evidence.">
        <p>Each finding shows its potential value, a confidence score, the ticket, time entry or clause behind it, and what to do next. This is the product, running on the demo MSP.</p>
      </SectionIntro>

      <figure className="mt-12 lg:mt-16">
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-start justify-between gap-4 border-b border-line bg-sunken px-4 py-3 sm:items-center sm:px-5">
            <div className="flex min-w-0 flex-col gap-x-2.5 gap-y-0.5 sm:flex-row sm:items-center">
              <p className="flex items-center gap-2.5 text-h3 text-ink">
                <ICONS.findings className="size-4 text-ink-3" aria-hidden />
                Findings
              </p>
              <span className="tnum text-small text-ink-3">
                {CATEGORY_META.OUT_OF_SCOPE.label} · {plural(oos.count, 'finding')} · {money(oos.value)}
              </span>
            </div>
            <span className="shrink-0 whitespace-nowrap">
              <Badge>Demo data</Badge>
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            {/* The list */}
            <div className="flex min-w-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
              <table className="w-full text-small">
                <caption className="sr-only">Out-of-scope findings in the demo, newest first</caption>
                <thead>
                  <tr className="border-b border-line-soft">
                    <th scope="col" className={cx(TH, 'pl-4 pr-3 sm:pl-5')}>
                      Finding
                    </th>
                    <th scope="col" className={cx(TH, 'hidden px-3 sm:table-cell')}>
                      Severity
                    </th>
                    <th scope="col" className={cx(TH, 'whitespace-nowrap pl-3 pr-4 text-right sm:pr-5')}>
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {oos.rows.map((r) => (
                    <tr key={r.ticketRef} className={cx(selected(r.ticketRef) ? 'bg-raised' : undefined)} aria-current={selected(r.ticketRef) ? 'true' : undefined}>
                      <td className="w-full max-w-0 py-3 pl-4 pr-3 sm:pl-5">
                        <span className={cx('block truncate font-medium', selected(r.ticketRef) ? 'text-ink' : 'text-ink-2')}>{r.title}</span>
                        <span className="tnum mt-0.5 block truncate text-caption text-ink-3">
                          {r.client} · #{r.ticketRef}
                          <span className="hidden sm:inline"> · {shortDate(r.workDate ?? '')}</span>
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 sm:table-cell">
                        <SeverityBadge severity={r.severity} />
                      </td>
                      <td className="tnum whitespace-nowrap py-3 pl-3 pr-4 text-right font-semibold text-ink sm:pr-5">{money(r.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="tnum mt-auto flex items-center gap-1.5 border-t border-line-soft px-4 py-3 text-caption text-ink-3 sm:px-5">
                <ArrowDown className="size-3.5" aria-hidden />
                {plural(oos.count - oos.rows.length, 'more finding')} in this category
              </p>
            </div>

            {/* The evidence for the selected finding */}
            <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge severity={f.severity} />
                <Badge>{CATEGORY_META[f.category].short}</Badge>
              </div>
              <h3 className="mt-3 text-h2 text-ink">{f.title}</h3>
              <p className="tnum mt-1 text-small text-ink-3">
                {f.client} · Ticket #{f.ticketRef}
              </p>

              <dl className="mt-5 grid grid-cols-3 border-y border-line-soft">
                <div className="py-3.5 pr-3">
                  <dt className="text-caption text-ink-3">Potential value</dt>
                  <dd className="mt-1">
                    <Figure size="md">{money(f.value)}</Figure>
                  </dd>
                </div>
                <div className="border-l border-line-soft px-3 py-3.5">
                  <dt className="text-caption text-ink-3">Time logged</dt>
                  <dd className="tnum mt-1 text-data-md text-ink">{sp.time.duration}</dd>
                </div>
                <div className="border-l border-line-soft py-3.5 pl-3">
                  <dt className="text-caption text-ink-3">Confidence</dt>
                  <dd className="mt-2">
                    <Confidence value={f.confidence} />
                  </dd>
                </div>
              </dl>

              <div className="mt-5">
                <EvidenceRow icon={<ICONS.contracts className="size-4" />} name="Contract clause" source="Uploaded contract">
                  <blockquote className="rounded-md bg-sunken px-3.5 py-3 text-body text-ink">
                    <span className="text-ink-3" aria-hidden>
                      “
                    </span>
                    <Highlighted text={sp.clause ?? ''} highlights={sp.clauseHighlights} />
                    <span className="text-ink-3" aria-hidden>
                      ”
                    </span>
                  </blockquote>
                  {sp.contractTitle && <p className="mt-1.5 text-caption text-ink-3">{sp.contractTitle}</p>}
                </EvidenceRow>
                <EvidenceRow icon={<ICONS.tickets className="size-4" />} name={`Ticket #${f.ticketRef}`} source="Ticket export">
                  <p className="text-body font-medium text-ink">
                    <Highlighted text={sp.subject} highlights={sp.ticketHighlights} />
                  </p>
                  <p className="mt-1 text-small text-ink-2">
                    <Highlighted text={sp.body} highlights={sp.ticketHighlights} />
                  </p>
                </EvidenceRow>
                <EvidenceRow icon={<Clock className="size-4" />} name="Time logged" source="Time entries">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-small">
                    <span className="tnum text-ink">
                      {shortDate(sp.time.date)}, {sp.time.time} · <span className="text-ink-2">{sp.time.technician}</span> · <span className="font-medium">{sp.time.duration}</span>
                    </span>
                    <Badge tone={sp.time.billable ? 'neutral' : 'warning'}>{sp.time.billable ? 'Billable' : 'Non-billable'}</Badge>
                  </div>
                </EvidenceRow>
              </div>

              <div className="mt-2 border-t border-line pt-4">
                <p className="text-small font-medium text-ink">Recommended action</p>
                <p className="mt-1 max-w-[62ch] text-small text-ink-2">{sp.recommendedAction}</p>
              </div>
            </div>
          </div>
        </div>
        <figcaption className="mt-3 text-caption text-ink-3">The findings list and finding view from the app, with {DEMO.msp}'s demo data. Values are potential leakage to review.</figcaption>
      </figure>
    </Section>
  )
}
