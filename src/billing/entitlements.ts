import { ENTITLEMENTS, FOUNDING, PAST_DUE_GRACE_DAYS, READ_ONLY_DAYS_AFTER_END, REFUND_WINDOW_DAYS, type EntitlementKey, type Entitlements, type Interval, type PaidPlanId, type PlanId } from './plans'

/**
 * Billing state and the rules that act on it, as pure functions.
 *
 * Nothing here talks to a payment processor. A subscription is a plain value;
 * every rule takes the current one and returns the next, so the same rules can
 * run in the browser (to show prompts) and on the server (to enforce them).
 */

/** Billing is not live: until it is, every account has the whole product. */
export const BILLING_LIVE = false

export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled'

export interface Subscription {
  plan: PlanId
  interval: Interval | null
  status: SubscriptionStatus
  /** ISO date the founding free period ends, when trialing. */
  trial_end: string | null
  /** ISO date the paid (or trial) period ends. */
  current_period_end: string | null
  cancel_at_period_end: boolean
  /** A downgrade waiting for the period to end. */
  pending: { plan: PlanId; interval: Interval } | null
  /** The first payment is refundable until this date (MSP 51 onwards). */
  refundable_until: string | null
  /** 1 to 50 for a founding MSP. */
  founding_number: number | null
}

/** A new account: the free audit, no subscription. */
export const FREE_AUDIT: Subscription = {
  plan: 'audit',
  interval: null,
  status: 'none',
  trial_end: null,
  current_period_end: null,
  cancel_at_period_end: false,
  pending: null,
  refundable_until: null,
  founding_number: null,
}

const DAY = 86_400_000
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
const iso = (d: Date) => d.toISOString()
const at = (s: string | null) => (s ? new Date(s).getTime() : NaN)

/** One period on from a date: a calendar month or year. */
export function addInterval(d: Date, interval: Interval): Date {
  const next = new Date(d.getTime())
  if (interval === 'year') next.setUTCFullYear(next.getUTCFullYear() + 1)
  else next.setUTCMonth(next.getUTCMonth() + 1)
  return next
}

// ---- Access ----

export type Access = 'full' | 'read_only' | 'free'

/**
 * What the account can do right now.
 * - full: the plan's entitlements (trialing, active, or past due within the grace period)
 * - read_only: past reports only (past due beyond grace, or ended within the read-only window)
 * - free: the free audit's entitlements
 */
export function access(sub: Subscription, now: Date): Access {
  if (sub.plan === 'audit' || sub.status === 'none') return 'free'
  const end = at(sub.current_period_end)
  switch (sub.status) {
    case 'trialing':
      return now.getTime() < at(sub.trial_end) ? 'full' : 'read_only'
    case 'active':
      return 'full'
    case 'past_due':
      return now.getTime() < end + PAST_DUE_GRACE_DAYS * DAY ? 'full' : 'read_only'
    case 'canceled':
      return now.getTime() < end + READ_ONLY_DAYS_AFTER_END * DAY ? 'read_only' : 'free'
  }
}

/** The plan whose entitlements apply now. */
export const effectivePlan = (sub: Subscription, now: Date): PlanId => (access(sub, now) === 'free' ? 'audit' : sub.plan)

export function entitlementsFor(sub: Subscription, now: Date): Entitlements {
  return ENTITLEMENTS[effectivePlan(sub, now)]
}

/**
 * Whether the account may use an entitlement. For a limit, pass how much is
 * already used ("3 analyses so far"). Read-only access allows only reports of
 * past analyses. Until BILLING_LIVE, everything is allowed: pass enforce: true
 * to evaluate the rules (tests, upgrade prompts).
 */
export function canUse(sub: Subscription, key: EntitlementKey, opts: { used?: number; now?: Date; enforce?: boolean } = {}): boolean {
  const { used = 0, now = new Date(), enforce = BILLING_LIVE } = opts
  if (!enforce) return true
  const a = access(sub, now)
  if (a === 'read_only') return key === 'summaryReport' || key === 'fullReports'
  const v = ENTITLEMENTS[effectivePlan(sub, now)][key]
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return used < v
  // clientView: the full commercial view (the free audit's is read-only)
  return v === 'full'
}

// ---- Trial and starting a plan ----

/** The founding band for a paying MSP's number, or null from MSP 51 onwards. */
export function foundingBand(n: number | null) {
  if (n == null) return null
  return FOUNDING.bands.find((b) => n >= b.from && n <= b.to) ?? null
}

/**
 * Start a paid plan. A founding MSP (1 to 50) gets the free days first; from
 * MSP 51 onwards there's no trial and the first payment is refundable for
 * REFUND_WINDOW_DAYS.
 */
export function startPlan(plan: PaidPlanId, interval: Interval, now: Date, foundingNumber: number | null = null): Subscription {
  const founding = foundingBand(foundingNumber) ? foundingNumber : null
  if (founding != null) {
    const trialEnd = addDays(now, FOUNDING.freeDays)
    return { ...FREE_AUDIT, plan, interval, status: 'trialing', trial_end: iso(trialEnd), current_period_end: iso(trialEnd), founding_number: founding }
  }
  return { ...FREE_AUDIT, plan, interval, status: 'active', current_period_end: iso(addInterval(now, interval)), refundable_until: iso(addDays(now, REFUND_WINDOW_DAYS)) }
}

export const isTrialing = (sub: Subscription, now: Date) => sub.status === 'trialing' && now.getTime() < at(sub.trial_end)

export function trialDaysLeft(sub: Subscription, now: Date): number {
  if (!isTrialing(sub, now)) return 0
  return Math.ceil((at(sub.trial_end) - now.getTime()) / DAY)
}

/** The first payment after the free days: the plan becomes active for a full period. */
export function convertTrial(sub: Subscription, now: Date): Subscription {
  if (sub.status !== 'trialing' || !sub.interval) return sub
  return { ...sub, status: 'active', current_period_end: iso(addInterval(now, sub.interval)) }
}

// ---- Changing plan ----

const RANK: Record<PlanId, number> = { audit: 0, growth: 1, pro: 2 }

export type ChangeKind = 'upgrade' | 'downgrade' | 'none'

/** An upgrade is a higher plan, or the same plan from monthly to annual. */
export function changeKind(from: Pick<Subscription, 'plan' | 'interval'>, to: { plan: PlanId; interval: Interval }): ChangeKind {
  if (RANK[to.plan] !== RANK[from.plan]) return RANK[to.plan] > RANK[from.plan] ? 'upgrade' : 'downgrade'
  if (from.interval === to.interval) return 'none'
  return to.interval === 'year' ? 'upgrade' : 'downgrade'
}

export interface PlanChange {
  subscription: Subscription
  kind: ChangeKind
  /** Upgrades apply now and are prorated; downgrades wait for the period to end. */
  effective: 'now' | 'period_end' | 'none'
  prorated: boolean
}

/**
 * Change plan or interval. Upgrades apply at once and the processor prorates
 * the difference; downgrades (including to the free audit) take effect at the
 * end of the period already paid for.
 */
export function changePlan(sub: Subscription, to: { plan: PlanId; interval: Interval }, now: Date): PlanChange {
  const kind = changeKind(sub, to)
  if (kind === 'none') return { subscription: { ...sub, pending: null, cancel_at_period_end: false }, kind, effective: 'none', prorated: false }

  if (kind === 'upgrade') {
    if (to.plan === 'audit') throw new Error('The free audit is never an upgrade')
    // From the free audit (or an ended plan), an upgrade starts a new plan.
    if (sub.plan === 'audit' || sub.status === 'none' || sub.status === 'canceled') return { subscription: startPlan(to.plan, to.interval, now, sub.founding_number), kind, effective: 'now', prorated: false }
    const intervalChanged = sub.interval !== to.interval
    return {
      subscription: {
        ...sub,
        plan: to.plan,
        interval: to.interval,
        pending: null,
        cancel_at_period_end: false,
        // A trial keeps its free days on the new plan; a new interval starts a new period.
        current_period_end: sub.status === 'trialing' || !intervalChanged ? sub.current_period_end : iso(addInterval(now, to.interval)),
      },
      kind,
      effective: 'now',
      prorated: sub.status !== 'trialing',
    }
  }

  if (to.plan === 'audit') return { subscription: cancelAtPeriodEnd(sub), kind, effective: 'period_end', prorated: false }
  return { subscription: { ...sub, pending: { plan: to.plan, interval: to.interval }, cancel_at_period_end: false }, kind, effective: 'period_end', prorated: false }
}

// ---- Cancelling ----

/** Cancelling ends the plan at the close of the period already paid for. No partial refunds. */
export function cancelAtPeriodEnd(sub: Subscription): Subscription {
  if (sub.plan === 'audit' || sub.status === 'none' || sub.status === 'canceled') return sub
  return { ...sub, cancel_at_period_end: true, pending: null }
}

export function resume(sub: Subscription): Subscription {
  return { ...sub, cancel_at_period_end: false }
}

/** Whether a cancellation today still falls in the first-payment refund window (MSP 51 onwards). */
export const refundable = (sub: Subscription, now: Date) => sub.refundable_until != null && now.getTime() <= at(sub.refundable_until)

/**
 * What happens when the period closes: a cancellation ends the plan, a pending
 * downgrade applies, a trial converts, and otherwise the plan renews.
 */
export function atPeriodEnd(sub: Subscription, now: Date): Subscription {
  if (sub.plan === 'audit' || sub.status === 'none' || sub.status === 'canceled' || !sub.interval) return sub
  if (now.getTime() < at(sub.current_period_end)) return sub
  if (sub.cancel_at_period_end) return { ...sub, status: 'canceled', cancel_at_period_end: false, pending: null }
  if (sub.status === 'trialing') return convertTrial(sub, now)
  const next = sub.pending ?? { plan: sub.plan, interval: sub.interval }
  return { ...sub, plan: next.plan, interval: next.interval, pending: null, current_period_end: iso(addInterval(new Date(at(sub.current_period_end)), next.interval)) }
}

/** A failed renewal payment. Access continues for the grace period while the card is retried. */
export const markPastDue = (sub: Subscription): Subscription => (sub.status === 'active' ? { ...sub, status: 'past_due' } : sub)

// ---- The current account ----

/**
 * The workspace's billing state. Billing isn't live, so every workspace is on
 * the free audit with no subscription; once a provider is connected this reads
 * the workspace's billing record instead.
 */
export function currentSubscription(): Subscription {
  return FREE_AUDIT
}

// ---- The processor seam ----

/**
 * Where a payment processor plugs in. Nothing implements this yet.
 *
 * With Stripe the mapping is:
 * - startCheckout: create a Checkout Session in subscription mode for the
 *   Stripe Price keyed `${plan}_${interval}` (growth_month, growth_year,
 *   pro_month, pro_year), with `trial_period_days` set to FOUNDING.freeDays
 *   for a founding MSP, and return its URL.
 * - openPortal: create a Customer Portal session for the workspace's Stripe
 *   customer (plan changes, card updates, invoices, cancellation) and return
 *   its URL. Configure the portal so upgrades prorate immediately and
 *   downgrades and cancellations apply at period end, matching changePlan and
 *   cancelAtPeriodEnd here.
 * - getSubscription: read the workspace's billing record, which only the
 *   server-side webhook handler writes (customer.subscription.created,
 *   .updated and .deleted, invoice.payment_failed), mapped to Subscription.
 *
 * Price IDs and keys belong in server configuration, never in this bundle.
 */
export interface BillingProvider {
  startCheckout(input: { workspaceId: string; plan: PaidPlanId; interval: Interval }): Promise<{ url: string }>
  openPortal(input: { workspaceId: string }): Promise<{ url: string }>
  getSubscription(input: { workspaceId: string }): Promise<Subscription>
}
