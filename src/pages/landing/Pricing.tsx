import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Badge, Figure, TextLink, cx } from '../../components/ui'
import { IntervalToggle } from '../../components/IntervalToggle'
import { COMPANY, HOSTED, TRUST_COPY } from '../../brand/brand'
import { money } from '../../lib/format'
import { track } from '../../lib/track'
import {
  ENTITLEMENTS,
  FOUNDING,
  PLANS,
  PLAN_IDS,
  PRICES_EXCLUDE_VAT,
  READ_ONLY_DAYS_AFTER_END,
  ROI_EXAMPLE,
  SETUP_FEE,
  annualDiscountPct,
  formatLimit,
  formatPrice,
  perMonth,
  priceFor,
  vatPct,
  type Interval,
  type Plan,
} from '../../billing/plans'
import { DEMO } from './demoSnapshot'
import { AuditCta } from './chrome'
import { Section, inWords, sectionTitleCls } from './primitives'

// The pricing section. Every price, limit and term comes from
// src/billing/plans.ts; this file only lays them out. Anything the product
// can't do yet carries a Planned mark, and Growth carries the section's one
// lime button.

const VAT = PRICES_EXCLUDE_VAT ? ' + VAT' : ''
const growth = PLANS.growth
const roiMonthly = ROI_EXAMPLE.users * ROI_EXAMPLE.pricePerUser
const [first10, next15] = FOUNDING.bands

// The price block keeps the same two lines in either interval, so the toggle never moves the cards.
function Price({ plan, interval }: { plan: Plan; interval: Interval }) {
  const free = priceFor(plan.id, 'month') === 0
  return (
    <div>
      <p className="flex items-baseline gap-1.5">
        <Figure testId={`price-${plan.id}`}>{formatPrice(perMonth(plan.id, interval))}</Figure>
        {!free && <span className="text-small text-ink-3">a month{VAT}</span>}
      </p>
      <p className="tnum mt-1.5 min-h-5 text-small text-ink-3">
        {free
          ? plan.sub
          : interval === 'year'
            ? `Billed ${formatPrice(priceFor(plan.id, 'year'))} a year`
            : `or ${formatPrice(priceFor(plan.id, 'year'))} a year (${formatPrice(perMonth(plan.id, 'year'))} a month)`}
      </p>
    </div>
  )
}

function PlanCta({ plan, interval }: { plan: Plan; interval: Interval }) {
  const variant = plan.recommended ? 'accent' : 'secondary'
  if (plan.cta.href)
    return (
      <a
        href={plan.cta.href}
        onClick={() => track('plan_selected', { plan: plan.id, interval, location: 'pricing' })}
        className="inline-flex h-9 w-full items-center justify-center rounded-md border border-line bg-raised px-4 text-body font-medium text-ink transition-colors hover:border-line-strong hover:bg-hover"
      >
        {plan.cta.label}
      </a>
    )
  return <AuditCta location={`pricing_${plan.id}`} label={plan.cta.label} plan={plan.id} interval={interval} variant={variant} size="md" arrow={false} className="w-full" />
}

// What happens to the data, beside the free audit's button: the facts the security page backs.
function DataNote() {
  return (
    <p className="text-caption text-ink-3">
      {HOSTED
        ? `Workspace data is stored${COMPANY.hostingRegion ? ` in ${COMPANY.hostingRegion}` : ''}. Optional AI explanations are processed by Anthropic in the US. Not SOC 2 certified.`
        : "Evaluation mode: data stays in this browser. Use sample data, not client data."}{' '}
      <TextLink to="/trust" className="text-caption underline">
        Trust Centre
      </TextLink>
    </p>
  )
}

function PlanColumn({ plan, interval, index }: { plan: Plan; interval: Interval; index: number }) {
  const e = ENTITLEMENTS[plan.id]
  return (
    <div
      className={cx(
        'flex min-w-0 flex-col px-5 py-6 sm:px-7 sm:py-7 lg:px-6 xl:px-7',
        index > 0 && 'border-t border-line lg:border-l lg:border-t-0',
        // The recommended plan sits forward: a raised fill inside a stronger hairline, over the frame's own.
        plan.recommended && 'relative z-10 -m-px bg-raised ring-1 ring-line-strong',
      )}
    >
      <div className="flex min-h-5 items-center justify-between gap-3">
        <p className="text-small font-medium text-ink-2">{plan.name}</p>
        {plan.recommended && <Badge>Recommended</Badge>}
      </div>
      <h3 className="mt-2 text-h3 text-ink">{plan.tagline}</h3>
      <div className="mt-5">
        <Price plan={plan} interval={interval} />
      </div>
      <p className="mt-4 text-small text-ink-2 lg:min-h-[4lh]">{plan.whoFor}</p>

      <dl className="mt-5 grid grid-cols-2 border-y border-line-soft text-small">
        <div className="py-3 pr-3">
          <dt className="text-caption text-ink-3">Clients</dt>
          <dd className="tnum mt-0.5 font-medium text-ink">{formatLimit(e.maxClients)}</dd>
        </div>
        <div className="border-l border-line-soft py-3 pl-4">
          <dt className="text-caption text-ink-3">Users</dt>
          <dd className="tnum mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink">
            {e.users}
            {plan.usersPlanned && (
              <span title="Team seats are planned. Each workspace has one user today." className="inline-flex items-center gap-1.5 text-caption font-normal text-ink-3">
                Team seats <Badge tone="info">Planned</Badge>
              </span>
            )}
          </dd>
        </div>
      </dl>

      <ul className="mt-5 flex-1 space-y-2.5 text-small">
        {plan.features.map((f) => (
          <li key={f.text} className={cx('flex items-start gap-2.5', f.status === 'planned' ? 'text-ink-3' : 'text-ink-2')}>
            <Check className={cx('mt-0.5 size-4 shrink-0', f.status === 'planned' ? 'text-line-strong' : 'text-ink-3')} aria-hidden />
            <span>
              {f.text}
              {f.status === 'planned' && (
                <span className="ml-2 inline-block align-[1px]">
                  <Badge tone="info">Planned</Badge>
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-7 space-y-3">
        <PlanCta plan={plan} interval={interval} />
        {/* Three lines held on wide screens, so the three buttons sit on one line. */}
        <div className="lg:min-h-[3lh] lg:text-caption">{plan.id === 'audit' ? <DataNote /> : plan.cta.note && <p className="text-caption text-ink-3">{plan.cta.note}</p>}</div>
      </div>
    </div>
  )
}

export function Pricing() {
  const ref = useRef<HTMLDivElement>(null)
  const [interval, setBillingInterval] = useState<Interval>('month')

  // Counted once, when the plans first come into view.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((x) => x.isIntersecting)) return
        io.disconnect()
        track('pricing_viewed')
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const choose = (v: Interval) => {
    setBillingInterval(v)
    track('pricing_interval_changed', { interval: v })
  }

  const footnotes = [
    `Prices are in GBP and exclude VAT, which is added at ${vatPct()}% for UK businesses.${SETUP_FEE === 0 ? ' There is no setup fee.' : ''}`,
    `When paid plans open: annual plans save ${annualDiscountPct()}%, monthly plans can be cancelled at any time and end at the close of the billing month, and after a plan ends past reports stay readable for ${READ_ONLY_DAYS_AFTER_END} days.`,
    'Items marked Planned are not available yet and are not part of what you pay for today.',
    'Headroom shows potential revenue opportunities for you to review, not guaranteed savings.',
    "Paid plans aren't on sale yet and there is no checkout, so nothing is charged. They will open to founding MSPs first. Until then, every account has the whole product as it is today (one user per workspace), and your first audit is free.",
  ]

  return (
    <Section id="pricing" label="pricing-title">
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <p className="text-small font-medium text-ink-3">Pricing</p>
          <h2 id="pricing-title" className={cx(sectionTitleCls, 'mt-3 max-w-[18ch]')}>
            Find the work your MSP is doing for free.
          </h2>
          <p className="mt-5 max-w-[52ch] text-lead text-ink-2">
            {HOSTED ? 'Start with a free audit of your own exports.' : 'Start with a free audit. This evaluation version keeps data in your browser, so try it on the sample exports.'} {TRUST_COPY.freeAudit} You see each opportunity, the evidence and calculation behind it, and the clients involved. If Headroom then finds even one missed recurring
            charge, {growth.name} can pay for itself.
          </p>
        </div>
        <div className="space-y-2.5 rounded-lg border border-line bg-sunken px-5 py-4 text-small text-ink-2 lg:col-span-5">
          <p className="tnum">
            <span className="font-medium text-ink">Illustrative, not a forecast:</span> {inWords(ROI_EXAMPLE.users)} users added at a client but never added to the invoice, at{' '}
            {formatPrice(ROI_EXAMPLE.pricePerUser)} per user a month, is {formatPrice(roiMonthly)} a month of potential revenue. {growth.name} is {formatPrice(priceFor('growth', 'month'))}.
          </p>
          <p className="tnum text-ink-3">
            For scale: the fictional demo MSP has {DEMO.totals.clients} clients with agreements worth {money(DEMO.totals.billed)} over {inWords(DEMO.period.months)} months. Headroom found{' '}
            {money(DEMO.totals.identified)} of potential opportunity there ({money(DEMO.totals.highConfidence)} high confidence), {money(DEMO.totals.monthly)} a month of it recurring.
          </p>
          <p className="text-ink-3">If your audit finds less than {growth.name} costs, {growth.name} isn't worth it for you yet, and the audit shows you that before you pay.</p>
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:mt-14">
        <IntervalToggle value={interval} onChange={choose} />
        <p className="text-small text-ink-3">Prices exclude VAT.{SETUP_FEE === 0 && ' No setup fee.'}</p>
      </div>

      <div ref={ref} className="mt-4 grid grid-cols-1 rounded-xl border border-line bg-surface lg:grid-cols-3">
        {PLAN_IDS.map((id, i) => (
          <PlanColumn key={id} plan={PLANS[id]} interval={interval} index={i} />
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-lg border border-line bg-sunken px-5 py-4 sm:flex-row sm:items-baseline sm:gap-6">
        <p className="shrink-0 text-small font-medium text-ink">Founding MSPs</p>
        <p className="tnum text-small text-ink-2">
          The first {FOUNDING.cohortSize} MSPs on {growth.name} or {PLANS.pro.name} get their first {FOUNDING.freeDays} days free. If list prices rise, they keep their price for {next15.priceLockMonths} months (
          {first10.priceLockMonths} months for the first {first10.to}). After the first {FOUNDING.freeDays} days, everyone pays the same list price.
        </p>
      </div>

      <ul className="mt-6 max-w-[88ch] space-y-1.5 text-small text-ink-3">
        {footnotes.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span aria-hidden className="mt-[0.6em] size-1 shrink-0 rounded-full bg-line-strong" />
            <span className="tnum">{f}</span>
          </li>
        ))}
        <li className="flex gap-2.5">
          <span aria-hidden className="mt-[0.6em] size-1 shrink-0 rounded-full bg-line-strong" />
          <span>
            Plans are subject to the{' '}
            <TextLink to="/terms" className="text-small underline">
              Terms
            </TextLink>{' '}
            and the{' '}
            <TextLink to="/privacy" className="text-small underline">
              Privacy policy
            </TextLink>
            .
          </span>
        </li>
      </ul>
    </Section>
  )
}
