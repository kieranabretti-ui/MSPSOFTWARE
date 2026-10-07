import { describe, expect, it } from 'vitest'
import {
  BILLING_LIVE,
  FREE_AUDIT,
  access,
  atPeriodEnd,
  cancelAtPeriodEnd,
  canUse,
  changeKind,
  changePlan,
  currentSubscription,
  effectivePlan,
  foundingBand,
  isTrialing,
  markPastDue,
  refundable,
  resume,
  startPlan,
  trialDaysLeft,
} from './entitlements'
import { FOUNDING, PAST_DUE_GRACE_DAYS, READ_ONLY_DAYS_AFTER_END, REFUND_WINDOW_DAYS } from './plans'

const NOW = new Date('2026-10-07T09:00:00Z')
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000)

describe('entitlements', () => {
  it('allows everything while billing is not live', () => {
    expect(BILLING_LIVE).toBe(false)
    expect(canUse(FREE_AUDIT, 'recoveryQueue')).toBe(true)
    expect(canUse(FREE_AUDIT, 'maxAnalyses', { used: 10 })).toBe(true)
  })

  it('limits the free audit to one analysis and no recovery queue when enforced', () => {
    const o = { now: NOW, enforce: true }
    expect(canUse(FREE_AUDIT, 'maxAnalyses', { ...o, used: 0 })).toBe(true)
    expect(canUse(FREE_AUDIT, 'maxAnalyses', { ...o, used: 1 })).toBe(false)
    expect(canUse(FREE_AUDIT, 'recoveryQueue', o)).toBe(false)
    expect(canUse(FREE_AUDIT, 'aiExplanations', { ...o, used: 2 })).toBe(true)
    expect(canUse(FREE_AUDIT, 'aiExplanations', { ...o, used: 3 })).toBe(false)
    expect(canUse(FREE_AUDIT, 'summaryReport', o)).toBe(true)
    expect(canUse(FREE_AUDIT, 'clientView', o)).toBe(false)
  })

  it('gives Growth unlimited re-runs up to 100 clients, and Pro no client limit', () => {
    const growth = startPlan('growth', 'month', NOW)
    const pro = startPlan('pro', 'month', NOW)
    const o = { now: NOW, enforce: true }
    expect(canUse(growth, 'maxAnalyses', { ...o, used: 500 })).toBe(true)
    expect(canUse(growth, 'maxClients', { ...o, used: 99 })).toBe(true)
    expect(canUse(growth, 'maxClients', { ...o, used: 100 })).toBe(false)
    expect(canUse(pro, 'maxClients', { ...o, used: 5000 })).toBe(true)
    expect(canUse(growth, 'prioritySupport', o)).toBe(false)
    expect(canUse(pro, 'prioritySupport', o)).toBe(true)
    expect(canUse(pro, 'monitoring', o)).toBe(false)
  })

  it('defaults the current account to the free audit', () => {
    expect(currentSubscription()).toEqual(FREE_AUDIT)
    expect(effectivePlan(FREE_AUDIT, NOW)).toBe('audit')
  })
})

describe('trial and founding', () => {
  it('gives founding MSPs the free days first', () => {
    const s = startPlan('growth', 'month', NOW, 7)
    expect(s.status).toBe('trialing')
    expect(isTrialing(s, NOW)).toBe(true)
    expect(trialDaysLeft(s, NOW)).toBe(FOUNDING.freeDays)
    expect(access(s, days(FOUNDING.freeDays - 1))).toBe('full')
    expect(s.refundable_until).toBeNull()
  })

  it('maps founding numbers to their bands', () => {
    expect(foundingBand(1)?.priceLockMonths).toBe(24)
    expect(foundingBand(10)?.priceLockMonths).toBe(24)
    expect(foundingBand(11)?.priceLockMonths).toBe(12)
    expect(foundingBand(50)?.priceLockMonths).toBe(12)
    expect(foundingBand(51)).toBeNull()
  })

  it('gives MSP 51 onwards no trial and a refundable first payment', () => {
    const s = startPlan('growth', 'month', NOW, 51)
    expect(s.status).toBe('active')
    expect(s.trial_end).toBeNull()
    expect(refundable(s, days(REFUND_WINDOW_DAYS))).toBe(true)
    expect(refundable(s, days(REFUND_WINDOW_DAYS + 1))).toBe(false)
  })

  it('converts a trial to a paid period when it ends', () => {
    const s = startPlan('pro', 'year', NOW, 3)
    const after = atPeriodEnd(s, days(FOUNDING.freeDays))
    expect(after.status).toBe('active')
    expect(new Date(after.current_period_end!).getUTCFullYear()).toBe(2027)
  })

  it('ends a trial cancelled before it converts', () => {
    const s = cancelAtPeriodEnd(startPlan('growth', 'month', NOW, 3))
    expect(atPeriodEnd(s, days(FOUNDING.freeDays)).status).toBe('canceled')
  })
})

describe('plan changes', () => {
  it('classifies upgrades and downgrades', () => {
    expect(changeKind({ plan: 'growth', interval: 'month' }, { plan: 'pro', interval: 'month' })).toBe('upgrade')
    expect(changeKind({ plan: 'growth', interval: 'month' }, { plan: 'growth', interval: 'year' })).toBe('upgrade')
    expect(changeKind({ plan: 'pro', interval: 'month' }, { plan: 'growth', interval: 'year' })).toBe('downgrade')
    expect(changeKind({ plan: 'growth', interval: 'year' }, { plan: 'growth', interval: 'month' })).toBe('downgrade')
    expect(changeKind({ plan: 'growth', interval: 'month' }, { plan: 'growth', interval: 'month' })).toBe('none')
  })

  it('applies an upgrade at once, prorated', () => {
    const s = startPlan('growth', 'month', NOW)
    const c = changePlan(s, { plan: 'pro', interval: 'month' }, days(10))
    expect(c.effective).toBe('now')
    expect(c.prorated).toBe(true)
    expect(c.subscription.plan).toBe('pro')
    expect(c.subscription.current_period_end).toBe(s.current_period_end)
  })

  it('starts a new annual period when moving from monthly to annual', () => {
    const s = startPlan('growth', 'month', NOW)
    const c = changePlan(s, { plan: 'growth', interval: 'year' }, days(10))
    expect(c.kind).toBe('upgrade')
    expect(c.subscription.interval).toBe('year')
    expect(new Date(c.subscription.current_period_end!).getTime()).toBeGreaterThan(days(360).getTime())
  })

  it('starts a plan when upgrading from the free audit', () => {
    const c = changePlan(FREE_AUDIT, { plan: 'growth', interval: 'month' }, NOW)
    expect(c.subscription.plan).toBe('growth')
    expect(c.subscription.status).toBe('active')
  })

  it('holds a downgrade until the period ends', () => {
    const s = startPlan('pro', 'month', NOW)
    const c = changePlan(s, { plan: 'growth', interval: 'month' }, days(5))
    expect(c.effective).toBe('period_end')
    expect(c.subscription.plan).toBe('pro')
    expect(c.subscription.pending).toEqual({ plan: 'growth', interval: 'month' })
    const later = atPeriodEnd(c.subscription, new Date(s.current_period_end!))
    expect(later.plan).toBe('growth')
    expect(later.pending).toBeNull()
  })

  it('treats a downgrade to the free audit as a cancellation', () => {
    const s = startPlan('growth', 'month', NOW)
    const c = changePlan(s, { plan: 'audit', interval: 'month' }, days(5))
    expect(c.subscription.cancel_at_period_end).toBe(true)
  })
})

describe('cancellation and payment', () => {
  it('cancels at the end of the period, then read-only, then the free audit', () => {
    const s = cancelAtPeriodEnd(startPlan('growth', 'month', NOW))
    expect(s.cancel_at_period_end).toBe(true)
    expect(access(s, days(5))).toBe('full')
    const end = new Date(s.current_period_end!)
    const ended = atPeriodEnd(s, end)
    expect(ended.status).toBe('canceled')
    expect(access(ended, end)).toBe('read_only')
    expect(canUse(ended, 'fullReports', { now: end, enforce: true })).toBe(true)
    expect(canUse(ended, 'maxAnalyses', { now: end, enforce: true })).toBe(false)
    const later = new Date(end.getTime() + (READ_ONLY_DAYS_AFTER_END + 1) * 86_400_000)
    expect(access(ended, later)).toBe('free')
  })

  it('can resume before the period ends', () => {
    const s = resume(cancelAtPeriodEnd(startPlan('growth', 'month', NOW)))
    expect(atPeriodEnd(s, new Date(s.current_period_end!)).status).toBe('active')
  })

  it('renews an active plan for another period', () => {
    const s = startPlan('growth', 'month', NOW)
    const r = atPeriodEnd(s, new Date(s.current_period_end!))
    expect(r.status).toBe('active')
    expect(new Date(r.current_period_end!).getTime()).toBeGreaterThan(new Date(s.current_period_end!).getTime())
  })

  it('keeps access through the past-due grace period, then goes read-only', () => {
    const s = markPastDue(startPlan('growth', 'month', NOW))
    const end = new Date(s.current_period_end!).getTime()
    expect(access(s, new Date(end + (PAST_DUE_GRACE_DAYS - 1) * 86_400_000))).toBe('full')
    expect(access(s, new Date(end + (PAST_DUE_GRACE_DAYS + 1) * 86_400_000))).toBe('read_only')
  })
})
