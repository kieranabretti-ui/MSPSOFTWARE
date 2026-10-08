import { useState } from 'react'
import { Badge, Button, cx } from '../../../components/ui'
import { IntervalToggle } from '../../../components/IntervalToggle'
import { COMPANY } from '../../../brand/brand'
import { track } from '../../../lib/track'
import { currentSubscription, effectivePlan, trialDaysLeft } from '../../../billing/entitlements'
import { ENTITLEMENTS, PLANS, PLAN_IDS, PRICES_EXCLUDE_VAT, formatLimit, formatPrice, perMonth, priceFor, type Interval, type PaidPlanId } from '../../../billing/plans'
import { Callout } from '../data/kit'

// The workspace's plan, read from the billing state, and the plans it could
// move to, read from the pricing config. Checkout isn't built: choosing a plan
// records the interest and says plainly that nothing is charged.

export function PlanBody({ isDemo }: { isDemo: boolean }) {
  const sub = currentSubscription()
  const now = new Date()
  const current = effectivePlan(sub, now)
  const left = trialDaysLeft(sub, now)
  const [interval, setBillingInterval] = useState<Interval>('month')
  const [chosen, setChosen] = useState<PaidPlanId | null>(null)

  const choose = (plan: PaidPlanId) => {
    track('upgrade_clicked', { plan, from: current, interval, location: 'settings' })
    track('plan_selected', { plan, interval, location: 'settings' })
    setChosen(plan)
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-body text-ink-2">Current plan</span>
          <Badge tone="neutral">
            {PLANS[current].name}: {PLANS[current].tagline}
          </Badge>
          {left > 0 && <Badge tone="info">{left} days free left</Badge>}
        </div>
        <p className="max-w-[68ch] text-small text-ink-3">
          {isDemo ? 'This is the demo sandbox. Plans apply to your own workspace. ' : ''}
          Billing isn't live yet, so every workspace has the whole product as it is today (one user per workspace) and nothing is charged.
        </p>
      </div>

      <IntervalToggle value={interval} onChange={setBillingInterval} />

      <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line-soft md:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const p = PLANS[id]
          const free = priceFor(id, 'month') === 0
          const isCurrent = id === current
          return (
            <li key={id} className={cx('flex min-w-0 flex-col gap-3 bg-surface px-4 py-4', p.recommended && 'bg-raised')}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-body font-medium text-ink">{p.name}</p>
                {isCurrent ? <Badge>Current</Badge> : p.recommended && <Badge>Recommended</Badge>}
              </div>
              <p className="tnum text-small text-ink-2">
                <span className="text-h3 text-ink">{formatPrice(perMonth(id, interval))}</span>
                {!free && ` a month${PRICES_EXCLUDE_VAT ? ' + VAT' : ''}`}
                {!free && interval === 'year' && <span className="block text-caption text-ink-3">Billed {formatPrice(priceFor(id, 'year'))} a year</span>}
              </p>
              <p className="flex-1 text-small text-ink-3">
                {p.tagline}. Clients: {formatLimit(ENTITLEMENTS[id].maxClients).toLowerCase()}.
              </p>
              {id !== 'audit' && !isCurrent && (
                <Button variant="secondary" size="sm" className="self-start" onClick={() => choose(id)}>
                  {p.salesLed ? `Ask about ${p.name}` : `Choose ${p.name}`}
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      <div aria-live="polite">
        {chosen && (
          <Callout tone="info" title={`${PLANS[chosen].name} isn't available to buy online yet`}>
            Billing isn't live, so nothing is charged and your workspace keeps the whole product.{' '}
            {COMPANY.contactEmail
              ? `${PLANS[chosen].salesLed ? `${PLANS[chosen].name} is set up on a short call. ` : ''}Paid plans open to founding MSPs first and are invoiced directly: email ${COMPANY.contactEmail} to start.`
              : "Paid plans aren't on sale yet. They open to founding MSPs first, and how to start one will be shown here when they do."}
          </Callout>
        )}
      </div>
    </div>
  )
}
