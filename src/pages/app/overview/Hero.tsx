import { ArrowRight } from 'lucide-react'
import type { FindingClass } from '../../../engine/types'
import { ButtonLink, Figure, TextLink, cx } from '../../../components/ui'
import { GapBar } from '../../../components/bars'
import { ConfidenceLevel } from '../../../components/ConfidenceLevel'
import { CLASSIFICATION, CLASSIFICATION_ORDER, CONFIDENCE, CONFIDENCE_NOTE, SPLIT_LABEL } from '../../../lib/labels'
import { CLASSIFICATION_DEFINITIONS } from '../../../lib/confidence'
import { money, num, plural } from '../../../lib/format'
import type { SplitPart } from './split'

export interface HeroFigures {
  high: SplitPart
  review: SplitPart
  // Medium and Low counts inside review
  medium: number
  low: number
  byClass: Record<FindingClass, number>
  actioned: { count: number; value: number }
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
  periodLabel: string
  // agreement revenue for the period: client MRR × months, not invoiced amounts
  billed: number
  months: number
  // money counted under two opportunities at once, disclosed rather than netted
  overlap: { value: number; monthly: number; clients: string[] }
  // AI explanations exist only in hosted mode
  ai: boolean
}

const names = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

function partLine(p: SplitPart) {
  const bits = [p.monthly > 0 && `${money(p.monthly)} a month`, p.oneOff > 0 && `${money(p.oneOff)} one-off`].filter(Boolean) as string[]
  return bits.length ? bits.join(' · ') : 'Nothing in this band'
}

// The money panel, conservative first: what the evidence supports directly
// (High confidence) beside what needs the MSP's review, each with its monthly
// and one-off parts, then their labelled sum. The sum keeps
// data-testid="hero-total". Below: recurring, one-off, annualised and reach,
// then the counts by classification and the actioned value.
export function Hero({ f }: { f: HeroFigures }) {
  const recurringParts = [
    f.recurringAgreement > 0 && `${money(f.recurringAgreement)} from agreement and billing gaps`,
    f.recurringPricing > 0 && `${money(f.recurringPricing)} from pricing below target (an estimate)`,
    f.overlap.monthly > 0 && `${money(f.overlap.monthly)} of it overlaps at ${names(f.overlap.clients)}`,
  ].filter(Boolean) as string[]
  const inPeriod = f.total - f.oneOff
  const overlapLine =
    f.overlap.value > 0
      ? `Includes ${money(f.overlap.value)} at ${names(f.overlap.clients)} that overlaps with ${f.overlap.clients.length === 1 ? 'its' : 'their'} agreement gaps (shown, not netted).`
      : null

  const atRiskLine =
    f.needMrr >= f.clientCount && f.clientCount > 0
      ? 'Add MRR to see which are at risk'
      : f.needMrr > 0
        ? `${num(f.atRisk)} at risk on margin · ${num(f.needMrr)} need MRR`
        : f.atRisk > 0
          ? `${num(f.atRisk)} at risk on margin`
          : 'None at risk on margin'

  const cells = [
    {
      label: 'Recurring',
      value: (
        <>
          <Figure size="md" className="sm:text-data-lg">
            {money(f.monthly)}
          </Figure>
          <span className="text-small text-ink-3">a month</span>
        </>
      ),
      sub: f.monthly > 0 ? [`${money(f.high.monthly)} high confidence, ${money(f.review.monthly)} requires review`, ...recurringParts] : ['No recurring opportunity found'],
    },
    {
      label: 'One-off',
      value: (
        <Figure size="md" className="sm:text-data-lg">
          {money(f.oneOff)}
        </Figure>
      ),
      sub: ['Work in the period logged as non-billable or over allowance'],
    },
    {
      label: 'Annualised',
      value: (
        <Figure size="md" className="sm:text-data-lg">
          {money(f.annual)}
        </Figure>
      ),
      sub:
        f.monthly > 0
          ? [
              `${money(f.high.monthly * 12)} of it high confidence`,
              ...(f.recurringPricing > 0 ? [`${money(f.recurringPricing * 12)} of it a pricing estimate`] : []),
              ...(f.overlap.monthly > 0 ? [`${money(f.overlap.monthly * 12)} of it overlaps at ${names(f.overlap.clients)}`] : []),
              'Recurring items × 12, if confirmed and left uncorrected',
            ]
          : ['Recurring items × 12, if confirmed and left uncorrected'],
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
      <div className="flex flex-col gap-6 px-5 pb-6 pt-5 sm:px-8 sm:pb-7 sm:pt-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
          <div className="min-w-0">
            <h2 id="hero-label" className="text-body font-medium text-ink">
              Potential opportunity
            </h2>
            <p className="tnum mt-1 max-w-[68ch] text-small text-ink-3">
              {f.count > 0
                ? `${plural(f.count, 'opportunity', 'opportunities')} at ${plural(f.clientsAffected, 'client')} in ${f.periodLabel}. Each one shows its evidence and calculation, for you to review.`
                : `No rule flagged an opportunity in ${f.periodLabel} with the data provided.`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-3">
            <ButtonLink to="/app/opportunities" variant="accent">
              Review opportunities <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <TextLink to="/app/queue">Open the recovery queue</TextLink>
          </div>
        </div>

        {/* The conservative split: what the records support directly, then what needs review. */}
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line-soft bg-line-soft sm:grid-cols-2">
          <div className="min-w-0 bg-surface px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 className="text-small font-medium text-ink">{SPLIT_LABEL.high}</h3>
              <ConfidenceLevel level="HIGH" short />
            </div>
            <div className="mt-2">
              <Figure size="xl" testId="hero-high">
                {money(f.high.value)}
              </Figure>
            </div>
            <p className="tnum mt-2.5 text-small text-ink-2">{partLine(f.high)}</p>
            <p className="tnum mt-1 text-caption text-ink-3">
              {plural(f.high.count, 'opportunity', 'opportunities')}. {CONFIDENCE.HIGH.definition}
            </p>
          </div>
          <div className="min-w-0 bg-surface px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 className="text-small font-medium text-ink">{SPLIT_LABEL.review}</h3>
              <span className="tnum text-caption text-ink-3">
                {f.medium} medium · {f.low} low
              </span>
            </div>
            <div className="mt-2">
              <Figure size="lg" tone="muted" testId="hero-review" className="sm:text-[clamp(2rem,4.2vw,3rem)] sm:leading-none sm:tracking-[-0.035em]">
                {money(f.review.value)}
              </Figure>
            </div>
            <p className="tnum mt-2.5 text-small text-ink-2">{partLine(f.review)}</p>
            <p className="tnum mt-1 text-caption text-ink-3">{plural(f.review.count, 'opportunity', 'opportunities')}. Medium or low confidence: check the evidence before acting.</p>
          </div>
        </div>

        <div>
          <p className="tnum flex flex-wrap items-baseline gap-x-2 gap-y-1 text-small text-ink-3">
            <span className="font-medium text-ink-2">{SPLIT_LABEL.total}</span>
            <Figure size="md" testId="hero-total">
              {money(f.total)}
            </Figure>
            <span>
              = {money(f.high.value)} high confidence + {money(f.review.value)} requiring review
              {f.count > 0 && inPeriod > 0 && f.oneOff > 0 && (
                <>
                  , of which {money(inPeriod)} is recurring gaps over the period and {money(f.oneOff)} one-off work
                </>
              )}
              .
            </span>
          </p>
          {overlapLine && <p className="tnum mt-1.5 max-w-[80ch] text-caption text-ink-3">{overlapLine}</p>}
          <div className="mt-5">
            {f.billed > 0 ? (
              <GapBar billed={f.billed} gap={f.total} height={12} billedLabel={f.months > 0 ? `Agreement value over ${plural(f.months, 'month')}` : undefined} />
            ) : (
              <p className="text-caption text-ink-3">Add each client's monthly recurring revenue to compare potential opportunity with agreement value.</p>
            )}
          </div>
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
        <h3 className="sr-only">Opportunities by classification</h3>
        <ul className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
          {CLASSIFICATION_ORDER.map((k) => (
            <li key={k} className="min-w-0" title={CLASSIFICATION_DEFINITIONS[k]}>
              <span className="block text-caption text-ink-3">{CLASSIFICATION[k].label}</span>
              <span className={cx('tnum mt-0.5 block text-body font-semibold', f.byClass[k] ? 'text-ink' : 'text-ink-3')}>{num(f.byClass[k])}</span>
            </li>
          ))}
          <li className="min-w-0">
            <span className="block text-caption text-ink-3">Actioned value</span>
            <span className={cx('tnum mt-0.5 block text-body font-semibold', f.actioned.count ? 'text-ink' : 'text-ink-3')}>
              {money(f.actioned.value)}
              <span className="ml-1.5 text-caption font-normal text-ink-3">{plural(f.actioned.count, 'opportunity', 'opportunities')}</span>
            </span>
          </li>
        </ul>
      </div>

      <div className="space-y-1 border-t border-line-soft bg-sunken px-5 py-3 sm:px-8">
        <p className="text-caption text-ink-3">
          {CONFIDENCE_NOTE} Figures are potential opportunities from the data provided, not guaranteed to be recoverable. Recommendations require MSP review before action.
        </p>
        <p className="text-caption text-ink-3">
          {f.ai ? 'AI assists with interpretation. Financial calculations are deterministic.' : 'Every figure comes from deterministic rules applied to your data; no AI produces a number.'} The
          software recommends. The MSP decides.
        </p>
      </div>
    </section>
  )
}
