import type { ReactNode } from 'react'
import { money, plural } from '../../lib/format'
import { CATEGORY_META } from '../../lib/labels'
import type { Category } from '../../engine/types'
import { Figure } from '../../components/ui'
import { DEMO } from './demoSnapshot'
import { Highlighted, Section, SectionIntro, inWords, shortDate } from './primitives'

// The problem, as a statement of account: four kinds of leakage, each with one
// real example from the demo MSP and what it added up to across its clients,
// closed with a double rule under the total.

const cat = (c: Category) => DEMO.categories.find((x) => x.category === c) ?? { category: c, value: 0, count: 0, clients: 0 }

function Example({ source, value, valueLabel, quote, children }: { source: ReactNode; value: number; valueLabel: string; quote: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-4">
        <p className="tnum min-w-0 text-small text-ink-3">{source}</p>
        <p className="tnum shrink-0 text-small text-ink-3">
          {valueLabel}: <span className="font-medium text-ink-2">{money(value)}</span>
        </p>
      </div>
      <p className="mt-1.5 text-body font-medium text-ink">{quote}</p>
      <p className="mt-1 max-w-[62ch] text-small text-ink-2">{children}</p>
    </div>
  )
}

export function Problem() {
  const { scope, unbilled, drift, underpriced } = DEMO.leaks
  const rows: { name: string; def: string; category: Category; example: ReactNode }[] = [
    {
      name: 'Agreement drift',
      def: 'Clients who grew past the users and devices they pay for.',
      category: 'AGREEMENT_DRIFT',
      example: (
        <Example
          source={`${drift.finding.client} · Agreement`}
          value={drift.finding.value}
          valueLabel="This client"
          quote={`Contracted for ${drift.contracted} users, supporting ${drift.active}.`}
        >
          {plural(drift.active - drift.contracted, 'user')} at {money(drift.unitPrice)} each is {money(drift.finding.monthly)} a month that is not on the agreement.
        </Example>
      ),
    },
    {
      name: 'Unbilled work',
      def: 'Billable work that never reaches an invoice.',
      category: 'UNBILLED_TIME',
      example: (
        <Example source={`${unbilled.finding.client} · Ticket #${unbilled.finding.ticketRef}`} value={unbilled.finding.value} valueLabel="This ticket" quote={`“${unbilled.subject}”`}>
          The ticket is billable and its notes say “{unbilled.body.split('. ')[0]}.” Then {unbilled.time.duration} of time against it was logged as non-billable.
        </Example>
      ),
    },
    {
      name: 'Scope creep',
      def: 'Work the agreement excludes or charges for, logged as non-billable.',
      category: 'OUT_OF_SCOPE',
      example: (
        <Example source={`${scope.finding.client} · Ticket #${scope.finding.ticketRef}`} value={scope.finding.value} valueLabel="This ticket" quote={`“${scope.subject}”`}>
          {scope.time.duration} logged as non-billable at {scope.time.time} on {shortDate(scope.time.date)}. The contract says: “
          <Highlighted text={scope.clause ?? ''} highlights={scope.clauseHighlights} />”
        </Example>
      ),
    },
    {
      name: 'Underpriced clients',
      def: 'Support effort that has eaten into the margin. An estimate.',
      category: 'UNDERPRICED_CLIENT',
      example: (
        <Example
          source={`${underpriced.finding.client} · Profitability`}
          value={underpriced.finding.value}
          valueLabel="This client"
          quote={`${money(underpriced.mrr)} a month for ${underpriced.avgHours} support hours a month.`}
        >
          Estimated gross margin {Math.round(underpriced.margin * 100)}% against a {Math.round(DEMO.settings.targetMargin * 100)}% target, an average shortfall of {money(underpriced.finding.monthly)} a month over{' '}
          {inWords(DEMO.period.months)} months.
        </Example>
      ),
    },
  ]

  const shown = rows.reduce((a, r) => a + cat(r.category).value, 0)
  const restText = DEMO.categories
    .filter((c) => !rows.some((r) => r.category === c.category))
    .map((c) => `${CATEGORY_META[c.category].label.toLowerCase()} (${money(c.value)})`)
    .join(' and ')

  return (
    <Section id="problem" label="problem-title">
      <SectionIntro id="problem-title" stacked title="Your MSP can be profitable on paper and still give work away every month.">
        <p>
          Agreements are signed once. Clients change every month. New starters arrive, devices multiply and engineers do the quick favour nobody bills. Much of it never reaches an invoice, and nobody
          has time to check a thousand tickets against fifteen contracts.
        </p>
      </SectionIntro>

      <div className="mt-14 lg:mt-20">
        <div className="hidden grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,11rem)] gap-x-10 border-b border-line pb-3 lg:grid">
          <p className="text-label uppercase text-ink-3">Type</p>
          <p className="text-label uppercase text-ink-3">One example from {DEMO.msp}</p>
          <p className="text-right text-label uppercase text-ink-3">Across its {DEMO.totals.clients} clients</p>
        </div>

        {rows.map((r) => {
          const c = cat(r.category)
          return (
            <div key={r.category} className="grid grid-cols-1 gap-x-10 gap-y-4 border-b border-line-soft py-7 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,11rem)] lg:py-8">
              <div>
                <h3 className="text-h2 text-ink">{r.name}</h3>
                <p className="mt-1 text-small text-ink-3">{r.def}</p>
              </div>
              {r.example}
              <div className="flex items-baseline justify-between gap-4 border-t border-line-soft pt-3 lg:block lg:border-0 lg:pt-0 lg:text-right">
                <p className="text-small text-ink-3 lg:hidden">Across {DEMO.msp}</p>
                <div className="text-right">
                  <Figure size="md" className="lg:text-data-lg">
                    {money(c.value)}
                  </Figure>
                  <p className="tnum mt-1 text-caption text-ink-3">
                    {r.category === 'UNDERPRICED_CLIENT' ? plural(c.clients, 'client') : `${plural(c.count, 'opportunity', 'opportunities')} at ${plural(c.clients, 'client')}`}
                  </p>
                </div>
              </div>
            </div>
          )
        })}

        <div className="grid grid-cols-1 gap-x-10 gap-y-2 border-b-[3px] border-double border-line-strong py-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,11rem)]">
          <p className="text-h3 text-ink">Four types, one {DEMO.totals.clients}-client MSP</p>
          <p className="tnum text-small text-ink-3 lg:self-center">
            Of {money(DEMO.totals.identified)} found in {DEMO.period.label}.{restText && ` ${restText[0].toUpperCase()}${restText.slice(1)} make up the rest.`}
          </p>
          <p className="text-right">
            <Figure>{money(shown)}</Figure>
          </p>
        </div>
      </div>
    </Section>
  )
}
