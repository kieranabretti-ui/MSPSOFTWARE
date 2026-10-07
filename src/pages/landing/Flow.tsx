import type { ReactNode } from 'react'
import { Badge, Figure, cx } from '../../components/ui'
import { ShareBars } from '../../components/bars'
import { ConfidenceLevel } from '../../components/ConfidenceLevel'
import { money, num, plural } from '../../lib/format'
import { signed } from '../../engine/format'
import { CATEGORY_META, CONFIDENCE, FINDING_STATUS } from '../../lib/labels'
import { DEMO } from './demoSnapshot'
import { Section, SectionIntro } from './primitives'

// How it works, in four numbered steps. The numbers carry the order, and each
// pane shows what that step actually produced for the demo MSP rather than an
// icon and a promise: the files, the checks, the evidence, the queue.

function Pane({ n, title, line, children, foot, className }: { n: string; title: string; line: ReactNode; children: ReactNode; foot?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex min-w-0 flex-col', className)}>
      <div className="px-5 pb-5 pt-6 sm:px-7">
        <p className="tnum text-small font-medium text-ink-3">{n}</p>
        <h3 className="mt-2 text-h2 text-ink">{title}</h3>
        <p className="mt-1.5 max-w-[56ch] text-small text-ink-3">{line}</p>
      </div>
      <div className="flex-1 px-5 pb-6 sm:px-7">{children}</div>
      {foot && <div className="flex min-h-13 items-center border-t border-line-soft bg-sunken px-5 py-3 sm:px-7">{foot}</div>}
    </div>
  )
}

export function Flow() {
  const d = DEMO.data
  const files: { name: string; kind: 'CSV' | 'PDF'; rows: number }[] = [
    { name: 'Clients', kind: 'CSV', rows: d.clients },
    { name: 'Tickets', kind: 'CSV', rows: d.tickets },
    { name: 'Time entries', kind: 'CSV', rows: d.timeEntries },
    { name: 'Users and devices', kind: 'CSV', rows: d.usersAndDevices },
    { name: 'Billing lines', kind: 'CSV', rows: d.billingLines },
    { name: 'Contracts', kind: 'PDF', rows: d.contracts },
  ]
  const { rows: recurringRows, restCount, restMonthly } = DEMO.recurring
  // The working stages; nothing in the demo is dismissed.
  const stages = DEMO.stages.filter((s) => s.status !== 'dismissed' || s.count > 0)

  return (
    <Section id="how" label="how-title">
      <SectionIntro id="how-title" title="Headroom finds the revenue hiding inside your existing MSP data.">
        <p>No integration project. Upload the exports you already run, let the rules check them against each agreement, and act on what they find.</p>
      </SectionIntro>

      <div className="mt-12 grid grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-2 lg:mt-16">
        <Pane
          n="01"
          title="Upload your PSA exports"
          line="CSV exports from your PSA, RMM and billing system, plus contract PDFs."
          foot={<p className="text-caption text-ink-3">What {DEMO.msp} uploaded for the demo.</p>}
        >
          <table className="w-full text-small">
            <caption className="sr-only">Data uploaded</caption>
            <tbody>
              {files.map((f) => (
                <tr key={f.name} className="border-t border-line-soft first:border-t-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal text-ink-2">
                    {f.name}
                  </th>
                  <td className="py-2.5 pr-3">
                    <Badge>{f.kind}</Badge>
                  </td>
                  <td className="tnum py-2.5 text-right font-medium text-ink">
                    {num(f.rows)}
                    <span className="sr-only"> {f.kind === 'PDF' ? 'files' : 'rows'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Pane>

        <Pane
          className="border-t border-line md:border-l md:border-t-0"
          n="02"
          title="We analyse it"
          line="Rules compare tickets, time, users, devices and charges with each agreement, and check each ticket against the clauses found in that client's contract."
          foot={<p className="tnum text-caption text-ink-3">{plural(DEMO.totals.findings, 'opportunity', 'opportunities')}, each tied to the record behind it.</p>}
        >
          <ShareBars
            rows={DEMO.categories.map((c) => ({
              label: CATEGORY_META[c.category].label,
              value: c.value,
              sub: c.category === 'UNDERPRICED_CLIENT' ? plural(c.clients, 'client') : plural(c.count, 'opportunity', 'opportunities'),
            }))}
          />
        </Pane>

        <Pane
          className="border-t border-line"
          n="03"
          title="Find the leakage"
          line="Every opportunity carries its records, its calculation and a confidence level."
          foot={<p className="tnum text-caption text-ink-3">Each level comes from the rule that raised it and where its evidence came from.</p>}
        >
          <table className="w-full text-small">
            <caption className="sr-only">Opportunities in the demo by confidence level</caption>
            <thead>
              <tr className="border-b border-line-soft">
                <th scope="col" className="pb-2 text-left text-caption font-normal text-ink-3">
                  Confidence
                </th>
                <th scope="col" className="pb-2 text-right text-caption font-normal text-ink-3">
                  Opportunities
                </th>
                <th scope="col" className="pb-2 text-right text-caption font-normal text-ink-3">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {DEMO.levels.map((l) => (
                <tr key={l.level} className="border-t border-line-soft first:border-t-0">
                  <th scope="row" className="py-2.5 pr-3 text-left font-normal">
                    <ConfidenceLevel level={l.level} />
                  </th>
                  <td className="tnum py-2.5 pr-3 text-right text-ink-2">{l.count}</td>
                  <td className="tnum py-2.5 text-right font-medium text-ink">{money(l.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 space-y-1.5 border-t border-line-soft pt-4 text-caption">
            {DEMO.levels.map((l) => (
              <div key={l.level} className="flex gap-2">
                <dt className="w-14 shrink-0 font-medium text-ink-2">{CONFIDENCE[l.level].short}</dt>
                <dd className="text-ink-3">{CONFIDENCE[l.level].definition}</dd>
              </div>
            ))}
          </dl>
        </Pane>

        <Pane
          className="border-t border-line md:border-l"
          n="04"
          title="Take action"
          line={
            <>
              <span className="font-medium text-ink-2">Commercial opportunities: turn findings into action, prioritised by financial impact.</span> Work through each opportunity from New to Actioned:
              correct the agreement, bill the work or reprice the client.
            </>
          }
          foot={
            <div className="flex w-full items-baseline justify-between gap-4">
              <p className="tnum text-caption text-ink-3">Recurring, across {plural(DEMO.recurring.count, 'opportunity', 'opportunities')}</p>
              <p className="tnum text-right">
                <Figure size="md" tone="accent">
                  {money(DEMO.totals.monthly)}
                </Figure>
                <span className="ml-1 text-small text-ink-3">a month recurring</span>
              </p>
            </div>
          }
        >
          <ul>
            {recurringRows.map((f) => (
              <li key={f.title + f.client} className="flex items-baseline justify-between gap-4 border-t border-line-soft py-2.5 first:border-t-0">
                <span className="min-w-0">
                  <span className="block truncate text-small font-medium text-ink">{f.client}</span>
                  <span className="block truncate text-caption text-ink-3">{f.title}</span>
                </span>
                <span className="tnum shrink-0 text-small font-semibold text-ink">
                  {signed(money(f.monthly))}
                  <span className="font-normal text-ink-3"> a month</span>
                </span>
              </li>
            ))}
          </ul>
          {restCount > 0 && (
            <p className="tnum border-t border-line-soft py-2.5 text-caption text-ink-3">
              +{plural(restCount, 'more recurring opportunity', 'more recurring opportunities')} · {money(restMonthly)} a month
            </p>
          )}
          <div className="@container mt-3">
            <dl aria-label="Opportunities by stage in the demo" className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line-soft bg-line-soft @md:grid-cols-4">
              {stages.map((s) => (
                <div key={s.status} className="min-w-0 bg-surface px-3 py-2.5">
                  <dt className="truncate text-caption text-ink-3">{FINDING_STATUS[s.status]}</dt>
                  <dd className="tnum mt-0.5 flex items-baseline gap-1.5">
                    <span className="text-small font-semibold text-ink">{s.count}</span>
                    <span className="truncate text-caption text-ink-2">{money(s.value)}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Pane>
      </div>
    </Section>
  )
}
