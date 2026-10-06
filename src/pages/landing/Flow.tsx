import type { ReactNode } from 'react'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { Badge, Figure, cx } from '../../components/ui'
import { ShareBars } from '../../components/charts'
import { money, num, plural } from '../../lib/format'
import { CATEGORY_META } from '../../lib/labels'
import { DEMO } from './demoSnapshot'
import { Section, SectionIntro } from './primitives'

// Upload, Analyse, Recover: one frame, three panes, each showing what that
// step actually produced for the demo MSP rather than an icon and a promise.

function Pane({ verb, line, last, children, foot, className }: { verb: string; line: string; last?: boolean; children: ReactNode; foot?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex min-w-0 flex-col', className)}>
      <div className="flex items-start justify-between gap-4 px-5 pb-5 pt-6 sm:px-7">
        <div className="min-w-0">
          <h3 className="text-h2 text-ink">{verb}</h3>
          <p className="mt-1 text-small text-ink-3">{line}</p>
        </div>
        {!last && (
          <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-sm border border-line text-ink-3" aria-hidden>
            <ArrowRight className="hidden size-4 lg:block" />
            <ArrowDown className="size-4 lg:hidden" />
          </span>
        )}
      </div>
      <div className="flex-1 px-5 pb-6 sm:px-7">{children}</div>
      {foot && <div className="border-t border-line-soft bg-sunken px-5 py-3.5 sm:px-7">{foot}</div>}
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
  const recurringShown = DEMO.recurring.rows

  return (
    <Section id="how" label="how-title">
      <SectionIntro id="how-title" title="Headroom finds the revenue hiding inside your existing MSP data.">
        <p>No integration project. Upload the exports you already run, let the rules check every ticket against its contract, and act on what they find.</p>
      </SectionIntro>

      <div className="mt-12 grid grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface lg:mt-16 lg:grid-cols-3">
        <Pane verb="Upload" line="The exports from your PSA, RMM and billing system, plus contract PDFs." foot={<p className="text-caption text-ink-3">What {DEMO.msp} uploaded for the demo.</p>}>
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
            className="border-t border-line lg:border-l lg:border-t-0"
            verb="Analyse"
            line="Rules check every ticket, time entry, user, device and charge against the agreement."
            foot={<p className="tnum text-caption text-ink-3">{plural(DEMO.totals.findings, 'finding')}, each tied to the record behind it.</p>}
          >
            <ShareBars rows={DEMO.categories.map((c) => ({ label: CATEGORY_META[c.category].label, value: c.value, sub: c.category === 'UNDERPRICED_CLIENT' ? plural(c.clients, 'client') : plural(c.count, 'finding') }))} />
          </Pane>

        <Pane
            className="border-t border-line lg:border-l lg:border-t-0"
            verb="Recover"
            line="Correct the agreement, bill the work, or reprice the client."
            last
            foot={
              <div className="flex items-baseline justify-between gap-4">
                <p className="tnum text-caption text-ink-3">Recurring, across {plural(DEMO.recurring.count, 'finding')}</p>
                <p className="tnum text-right">
                  <Figure size="md" tone="accent">
                    {money(DEMO.totals.monthly)}
                  </Figure>
                  <span className="ml-1 text-small text-ink-3">a month</span>
                </p>
              </div>
            }
          >
            <ul>
              {recurringShown.map((f) => (
                <li key={f.title + f.client} className="flex items-baseline justify-between gap-4 border-t border-line-soft py-2.5 first:border-t-0">
                  <span className="min-w-0">
                    <span className="block truncate text-small font-medium text-ink">{f.client}</span>
                    <span className="block truncate text-caption text-ink-3">{f.title}</span>
                  </span>
                  <span className="tnum shrink-0 text-small font-semibold text-ink">
                    +{money(f.monthly)}
                    <span className="font-normal text-ink-3">/mo</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="tnum mt-3 text-caption text-ink-3">{money(DEMO.totals.annual)} a year if left uncorrected.</p>
          </Pane>
      </div>
    </Section>
  )
}
