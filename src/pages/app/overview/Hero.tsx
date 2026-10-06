import { ArrowRight } from 'lucide-react'
import { ButtonLink, Disclaimer, Figure } from '../../../components/ui'
import { GapBar } from '../../../components/charts'
import { money, plural } from '../../../lib/format'

// The money panel: what is leaking, against what was billed, and how much of
// it recurs. The headline figure keeps data-testid="hero-total".
export function Hero({
  total,
  monthly,
  annual,
  findingCount,
  openCount,
  periodLabel,
  billed,
  months,
}: {
  total: number
  monthly: number
  annual: number
  findingCount: number
  openCount: number
  periodLabel: string
  billed: number
  months: number
}) {
  return (
    <section aria-labelledby="hero-label" className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="px-5 py-6 sm:px-8 sm:py-8">
          <p id="hero-label" className="text-body font-medium text-ink-2">
            Potential revenue leakage identified
          </p>
          <div className="mt-3">
            <Figure size="xl" testId="hero-total">
              {money(total)}
            </Figure>
          </div>
          <p className="mt-3 text-body text-ink-3">
            {findingCount > 0 ? `Across ${plural(findingCount, 'finding')} in ${periodLabel}` : `No potential leakage found in ${periodLabel}`}
            {billed > 0 && months > 0 ? `, measured against ${plural(months, 'month')} of agreement revenue.` : '.'}
          </p>

          <div className="mt-7 max-w-[720px]">
            {billed > 0 ? (
              <GapBar billed={billed} gap={total} height={12} />
            ) : (
              <p className="text-caption text-ink-3">Add each client's monthly recurring revenue to see leakage against what you bill.</p>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
            <ButtonLink to="/app/findings" variant="accent">
              Review findings <ArrowRight className="size-4" />
            </ButtonLink>
            <span className="tnum text-small text-ink-3">{openCount > 0 ? `${plural(openCount, 'finding')} open` : 'Nothing open to review'}</span>
          </div>
        </div>

        <dl className="grid grid-cols-2 border-t border-line-soft lg:grid-cols-1 lg:grid-rows-2 lg:border-l lg:border-t-0">
          <div className="flex flex-col border-r border-line-soft px-5 py-5 sm:px-6 lg:justify-center lg:border-b lg:border-r-0 lg:px-7">
            <dt className="text-small font-medium text-ink-2">Recurring leakage</dt>
            <dd className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
              <Figure tone={monthly > 0 ? 'accent' : 'muted'}>{money(monthly)}</Figure>
              <span className="text-small text-ink-3">a month</span>
            </dd>
            <dd className="mt-1.5 text-caption text-ink-3">Potential MRR to recover by correcting agreements and billing</dd>
          </div>
          <div className="flex flex-col px-5 py-5 sm:px-6 lg:justify-center lg:px-7">
            <dt className="text-small font-medium text-ink-2">Annualised</dt>
            <dd className="mt-2">
              <Figure>{money(annual)}</Figure>
            </dd>
            <dd className="mt-1.5 text-caption text-ink-3">If the recurring leakage is left uncorrected</dd>
          </div>
        </dl>
      </div>
      <div className="border-t border-line-soft bg-sunken px-5 py-3 sm:px-8">
        <Disclaimer />
      </div>
    </section>
  )
}
