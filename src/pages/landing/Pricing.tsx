import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { Badge, Figure, cx } from '../../components/ui'
import { money } from '../../lib/format'
import { track } from '../../lib/track'
import { DEMO } from './demoSnapshot'
import { AuditCta } from './chrome'
import { Section, inWords, sectionTitleCls } from './primitives'

// Planned pricing, not live. The tiers and their limits are the owner's
// proposals and say so; until pricing goes live every account gets the whole
// product, and the first audit is free. Anything the product can't do yet
// (team seats, integrations, a support line) carries a Planned mark. Growth is
// the recommended tier and carries the section's one lime button.

interface Plan {
  key: 'starter' | 'growth' | 'pro'
  name: string
  price: number
  who: string
  // usersPlanned: more than one user per workspace needs team invites, which don't exist yet
  limits: { clients: string; users: string; usersPlanned?: boolean }
  includes: { text: string; planned?: boolean }[]
  recommended?: boolean
}

export const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    price: 99,
    who: 'For MSPs starting to find leakage.',
    limits: { clients: 'Up to 25', users: '1' },
    includes: [{ text: 'Every leakage check' }, { text: 'Evidence, calculation and confidence on every opportunity' }, { text: 'PDF and CSV reports' }],
  },
  {
    key: 'growth',
    name: 'Growth',
    price: 249,
    who: 'For continuous commercial intelligence.',
    limits: { clients: 'Up to 100', users: '3', usersPlanned: true },
    includes: [
      { text: 'Everything in Starter' },
      { text: 'Recovery queue' },
      { text: "Analysis history showing what's new since the last run" },
      { text: 'Contract vs reality for every client' },
    ],
    recommended: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 499,
    who: 'For advanced automation and intelligence.',
    limits: { clients: 'Unlimited', users: '10', usersPlanned: true },
    includes: [{ text: 'Everything in Growth' }, { text: 'PSA integrations as they launch', planned: true }, { text: 'Priority support', planned: true }],
  },
]

// The illustrative figure for the ROI line. An example, never a forecast.
const EXAMPLE_MONTHLY = 5000

export function Pricing() {
  const ref = useRef<HTMLDivElement>(null)
  const growth = PLANS.find((p) => p.recommended)!
  const share = Math.round((growth.price / EXAMPLE_MONTHLY) * 100)

  // Counted once, when the tiers first come into view.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        io.disconnect()
        track('pricing_viewed')
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <Section id="pricing" label="pricing-title">
      <div className="grid grid-cols-1 gap-x-12 gap-y-8 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-6">
          <h2 id="pricing-title" className={sectionTitleCls}>
            Planned pricing.
          </h2>
          <p className="mt-5 max-w-[48ch] text-lead text-ink-2">Pricing isn't live yet. Your first audit is free and needs no card, so you see your own figure before you pay anything.</p>
        </div>
        <div className="space-y-2 rounded-lg border border-line bg-sunken px-5 py-4 text-small text-ink-2 lg:col-span-6">
          <p>
            <span className="font-medium text-ink">Illustrative, not a forecast:</span> if an audit finds {money(EXAMPLE_MONTHLY)} a month of recoverable revenue, {growth.name} at{' '}
            {money(growth.price)} a month is about {share}% of it.
          </p>
          <p className="tnum text-ink-3">
            For scale: the fictional demo MSP has {DEMO.totals.clients} clients and billed {money(DEMO.totals.billed)} in {inWords(DEMO.period.months)} months. Headroom
            found {money(DEMO.totals.identified)} of potential leakage there, {money(DEMO.totals.monthly)} a month of it recurring.
          </p>
        </div>
      </div>

      <div ref={ref} className="mt-12 grid grid-cols-1 rounded-xl border border-line bg-surface lg:mt-14 lg:grid-cols-3">
        {PLANS.map((p, i) => (
          <div
            key={p.key}
            className={cx(
              'flex min-w-0 flex-col px-5 py-6 sm:px-7 sm:py-7 lg:px-6 xl:px-7',
              i > 0 && 'border-t border-line lg:border-l lg:border-t-0',
              // The recommended tier sits forward: a raised fill inside a stronger hairline, over the frame's own.
              // Square corners: it never sits at a corner of the frame, so its edges run straight into the frame's.
              p.recommended && 'relative z-10 -m-px bg-raised ring-1 ring-line-strong',
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-h2 text-ink">{p.name}</h3>
              {p.recommended && <Badge>Recommended</Badge>}
            </div>
            <p className="mt-4 flex items-baseline gap-1.5">
              <Figure>{money(p.price)}</Figure>
              <span className="text-small text-ink-3">a month</span>
            </p>
            <p className="mt-2 text-small text-ink-2">{p.who}</p>

            <dl className="mt-6 grid grid-cols-2 border-y border-line-soft text-small">
              <div className="py-3 pr-3">
                <dt className="text-caption text-ink-3">Clients</dt>
                <dd className="tnum mt-0.5 font-medium text-ink">{p.limits.clients}</dd>
              </div>
              <div className="border-l border-line-soft py-3 pl-4">
                <dt className="text-caption text-ink-3">Users</dt>
                <dd className="tnum mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-ink">
                  {p.limits.users}
                  {p.limits.usersPlanned && (
                    <span title="Team invites are planned. Each workspace has one user today.">
                      <Badge tone="info">Planned</Badge>
                    </span>
                  )}
                </dd>
              </div>
            </dl>

            <ul className="mt-5 flex-1 space-y-2.5 text-small">
              {p.includes.map((x) => (
                <li key={x.text} className="flex items-start gap-2.5 text-ink-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                  <span>
                    {x.text}
                    {x.planned && (
                      <span className="ml-2 inline-block align-[1px]">
                        <Badge tone="info">Planned</Badge>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <AuditCta location={`pricing_${p.key}`} plan={p.key} variant={p.recommended ? 'accent' : 'secondary'} size="md" arrow={false} className="w-full" />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 max-w-[80ch] text-small text-ink-3">
        Limits are proposals and will be confirmed before pricing goes live. Until then, every account has the whole product as it is today (one user per workspace), and your first audit is free.
      </p>
    </Section>
  )
}
