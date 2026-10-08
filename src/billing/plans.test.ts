import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ANNUAL_DISCOUNT,
  ENTITLEMENTS,
  FOUNDING,
  PAID_PLAN_IDS,
  PLANS,
  PLAN_IDS,
  annualDiscountFor,
  formatAnnual,
  formatMonthly,
  formatPrice,
  parsePlanId,
  perMonth,
  priceFor,
} from './plans'

describe('pricing config', () => {
  it('prices every paid plan annually at exactly the stated discount', () => {
    for (const id of PAID_PLAN_IDS) {
      expect(priceFor(id, 'year')).toBe(Math.round(priceFor(id, 'month') * 12 * (1 - ANNUAL_DISCOUNT)))
      expect(annualDiscountFor(id)).toBeCloseTo(ANNUAL_DISCOUNT, 10)
    }
  })

  it('gives whole-pound monthly equivalents for annual plans', () => {
    for (const id of PAID_PLAN_IDS) expect(Number.isInteger(perMonth(id, 'year'))).toBe(true)
  })

  it('keeps the free audit free and paid plans in ascending order', () => {
    expect(priceFor('audit', 'month')).toBe(0)
    expect(priceFor('audit', 'year')).toBe(0)
    expect(priceFor('growth', 'month')).toBeLessThan(priceFor('pro', 'month'))
  })

  it('has one recommended plan, a plan for every id, and entitlements for every plan', () => {
    expect(PLAN_IDS.filter((id) => PLANS[id].recommended)).toEqual(['growth'])
    for (const id of PLAN_IDS) {
      expect(PLANS[id].id).toBe(id)
      expect(ENTITLEMENTS[id]).toBeDefined()
      expect(PLANS[id].cta.to ?? PLANS[id].cta.href).toBeTruthy()
    }
  })

  it('never lists a planned feature as available on a plan entitlement', () => {
    for (const id of PLAN_IDS) {
      expect(ENTITLEMENTS[id].monitoring).toBe(false)
      expect(ENTITLEMENTS[id].psaConnection).toBe(false)
      expect(ENTITLEMENTS[id].users).toBe(1)
    }
    expect(PLANS.growth.features.filter((f) => f.status === 'planned').map((f) => f.text)).toEqual(['Direct PSA connection', 'Automatic monitoring and alerts'])
    // A people-delivered review can't be delivered until paid plans are on sale.
    expect(ENTITLEMENTS.pro.quarterlyReview).toBe(false)
    expect(PLANS.pro.features.find((f) => /quarterly/i.test(f.text))?.status).toBe('planned')
  })

  it('does not promise invoicing or a checkout that does not exist', () => {
    for (const id of PLAN_IDS) for (const f of PLANS[id].features) expect(f.text).not.toMatch(/invoice|checkout/i)
    expect(PLANS.growth.cta.note).toMatch(/not on sale online yet/i)
  })

  it('formats prices in pounds, ex VAT', () => {
    expect(formatPrice(2592)).toBe('£2,592')
    expect(formatMonthly('growth')).toMatch(/^£\d+ a month \+ VAT$/)
    expect(formatAnnual('pro')).toBe(`${formatPrice(priceFor('pro', 'year'))} a year (${formatPrice(perMonth('pro', 'year'))} a month)`)
  })

  it('reads plan ids from URLs and rejects anything else', () => {
    expect(parsePlanId('growth')).toBe('growth')
    expect(parsePlanId('starter')).toBeNull()
    expect(parsePlanId(null)).toBeNull()
  })

  it('has founding bands that cover the cohort without gaps', () => {
    let next = 1
    for (const b of FOUNDING.bands) {
      expect(b.from).toBe(next)
      next = b.to + 1
    }
    expect(next - 1).toBe(FOUNDING.cohortSize)
  })

  it('writes no copy with an em dash', () => {
    const text = JSON.stringify(PLANS)
    expect(text).not.toContain('—')
  })
})

// No component may carry a price of its own: every price comes from plans.ts.
describe('no duplicated price literals', () => {
  const src = fileURLToPath(new URL('..', import.meta.url))
  const files: string[] = []
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(tsx?|html)$/.test(f) && !/\.test\.ts$/.test(f) && !p.endsWith(join('billing', 'plans.ts'))) files.push(p)
    }
  }
  walk(src)

  const prices = new Set<string>()
  for (const id of PAID_PLAN_IDS)
    for (const n of [priceFor(id, 'month'), priceFor(id, 'year'), perMonth(id, 'year')]) {
      prices.add(formatPrice(n))
      prices.add(`£${n}`)
    }
  // Retired prices must not come back either.
  for (const old of ['£99', '£249', '£499', '£5,390']) prices.add(old)

  it('finds source files to check', () => expect(files.length).toBeGreaterThan(20))

  it.each([...prices])('%s appears only in src/billing/plans.ts', (price) => {
    const re = new RegExp(`${price.replace(/[$.*+?^()[\]{}|\\]/g, '\\$&')}(?![\\d,])`)
    const hits = files.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(src, f))
    expect(hits).toEqual([])
  })

  it('has no Starter plan left anywhere in the UI', () => {
    const hits = files.filter((f) => /['"`]Starter['"`]|\bStarter £/.test(readFileSync(f, 'utf8'))).map((f) => relative(src, f))
    expect(hits).toEqual([])
  })
})
