import { ArrowRight } from 'lucide-react'
import type { ConfidenceLevel as Level } from '../../../engine/types'
import { ButtonLink, Disclaimer, Figure, TextLink, cx } from '../../../components/ui'
import { GapBar } from '../../../components/bars'
import { ConfidenceLevel } from '../../../components/ConfidenceLevel'
import { CONFIDENCE, LEVEL_ORDER } from '../../../lib/labels'
import { money, num, plural } from '../../../lib/format'

export interface HeroFigures {
  total: number
  monthly: number
  recurringAgreement: number
  recurringPricing: number
  oneOff: number
  annual: number
  count: number
  clientsAffected: number
  clientCount: number
  atRisk: number
  // clients with no MRR, whose margin (and so risk) can't be measured
  needMrr: number
  byLevel: Record<Level, { count: number; value: number }>
  periodLabel: string
  billed: number
  months: number
  // money counted under two opportunities at once, disclosed rather than netted
  overlap: { value: number; monthly: number; clients: string[] }
}

const names = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

// The money panel, in the order an owner asks: how much in all (L1), how much
// of it recurs, how much was one-off, what it costs a year and how many
// clients it touches (L2), and how sure each part is. The headline figure
// keeps data-testid="hero-total".
export function Hero({ f }: { f: HeroFigures }) {
  const recurringParts = [
    f.recurringAgreement > 0 && `${money(f.recurringAgreement)} from agreement and billing gaps`,
    f.recurringPricing > 0 && `${money(f.recurringPricing)} from pricing below target`,
    f.overlap.monthly > 0 && `${money(f.overlap.monthly)} of it overlaps at ${names(f.overlap.clients)}`,
  ].filter(Boolean) as string[]
  // How the headline adds up: what recurring gaps came to over the period, and
  // the one-off work, so the tiles below can be traced back to it.
  const inPeriod = f.total - f.oneOff
  const overlapLine =
    f.overlap.value > 0
      ? `Includes ${money(f.overlap.value)} at ${names(f.overlap.clients)} that overlaps with ${f.overlap.clients.length === 1 ? 'its' : 'their'} agreement gaps (shown, not netted).`
      : null

  const atRiskLine =
    f.needMrr >= f.clientCount && f.clientCount > 0
      ? 'Add MRR to see which are at risk'
      : f.needMrr > 0
        ? `${num(f.atRisk)} at risk · ${num(f.needMrr)} need MRR`
        : f.atRisk > 0
          ? `${num(f.atRisk)} at risk`
          : 'None at risk'

  const cells = [
    {
      label: 'Recurring',
      value: (
        <>
          <Figure size="md" tone={f.monthly > 0 ? 'accent' : 'muted'} className="sm:text-data-lg">
            {money(f.monthly)}
          </Figure>
          <span className="text-small text-ink-3">a month</span>
        </>
      ),
      sub: recurringParts.length ? recurringParts : ['No recurring leakage found'],
    },
    {
      label: 'One-off',
      value: (
        <Figure size="md" className="sm:text-data-lg">
          {money(f.oneOff)}
        </Figure>
      ),
      sub: ['Work done in the period without a charge'],
    },
    {
      label: 'Annualised',
      value: (
        <Figure size="md" className="sm:text-data-lg">
          {money(f.annual)}
        </Figure>
      ),
      sub: ['If the recurring leakage is left uncorrected'],
    },
    {
      label: 'Clients affected',
      value: (
        <>
          <Figure size="md" className="sm:text-data-lg">
            {num(f.clientsAffected)}
          </Figure>
          <span className="tnum text-small text-ink-3">of {num(f.clientCount)}</span>
        </>
      ),
      sub: [atRiskLine],
    },
  ]

  return (
    <section aria-labelledby="hero-label" className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* Phones read figure, bar, then the action; wider screens put the
          action beside the figure and run the bar underneath both. */}
      <div className="flex flex-col gap-6 px-5 pb-6 pt-5 sm:px-8 sm:pb-7 sm:pt-7 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-10">
        <div className="min-w-0">
          <h2 id="hero-label" className="text-body font-medium text-ink-2">
            Potential leakage identified
          </h2>
          <div className="mt-2.5">
            <Figure size="xl" testId="hero-total">
              {money(f.total)}
            </Figure>
          </div>
          <p className="tnum mt-3 max-w-[68ch] text-body text-ink-3">
            {f.count > 0 ? `Across ${plural(f.count, 'opportunity', 'opportunities')} at ${plural(f.clientsAffected, 'client')} in ${f.periodLabel}` : `No potential leakage found in ${f.periodLabel}`}
            {f.count > 0 && inPeriod > 0 && f.oneOff > 0 ? (
              <>
                : <span className="text-ink-2">{money(inPeriod)}</span> from recurring gaps over the period and <span className="text-ink-2">{money(f.oneOff)}</span> of one-off work.
              </>
            ) : (
              '.'
            )}
          </p>
          {overlapLine && <p className="tnum mt-1.5 max-w-[68ch] text-small text-ink-3">{overlapLine}</p>}
        </div>
        <div className="order-last flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3 lg:order-none lg:flex-col lg:items-end lg:self-end lg:pb-1">
          <ButtonLink to="/app/opportunities" variant="accent">
            Review opportunities <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
          <TextLink to="/app/queue">Open the recovery queue</TextLink>
        </div>
        <div className="lg:col-span-2">
          {f.billed > 0 ? (
            <GapBar billed={f.billed} gap={f.total} height={14} billedLabel={f.months > 0 ? `Billed over ${plural(f.months, 'month')}` : undefined} />
          ) : (
            <p className="text-caption text-ink-3">Add each client's monthly recurring revenue to see leakage against what you bill.</p>
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px border-t border-line-soft bg-line-soft xl:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="flex min-w-0 flex-col bg-surface px-5 py-4 sm:px-6 xl:px-7 xl:py-5">
            <dt className="text-small font-medium text-ink-2">{c.label}</dt>
            <dd className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5">{c.value}</dd>
            {c.sub.map((line) => (
              <dd key={line} className="tnum mt-1 text-caption text-ink-3">
                {line}
              </dd>
            ))}
          </div>
        ))}
      </dl>

      <div className="border-t border-line-soft px-5 py-4 sm:px-8">
        <h3 className="sr-only">By confidence</h3>
        <ul className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-3">
          {LEVEL_ORDER.map((l) => {
            const v = f.byLevel[l]
            return (
              <li key={l} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  {/* Three columns are too narrow for the count beside the
                      level between sm and xl, so it goes underneath there. */}
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 sm:max-xl:flex-col sm:max-xl:items-start sm:max-xl:gap-y-0.5">
                    <ConfidenceLevel level={l} short />
                    <span className="tnum text-caption text-ink-3">{plural(v.count, 'opportunity', 'opportunities')}</span>
                  </span>
                  <span className={cx('tnum shrink-0 text-small font-semibold', v.value > 0 ? 'text-ink' : 'text-ink-3')}>{money(v.value)}</span>
                </div>
                <p className="mt-1 text-caption text-ink-3">{CONFIDENCE[l].definition}</p>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="border-t border-line-soft bg-sunken px-5 py-3 sm:px-8">
        <Disclaimer />
      </div>
    </section>
  )
}
