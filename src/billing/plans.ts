import { COMPANY } from '../brand/brand'

/**
 * Headroom's plans and prices: the single source of truth.
 *
 * Every price the product or the website shows is read from this file, and no
 * component may write a price literal of its own. To change a price, change it
 * here (and, once billing is live, create the matching processor price; see
 * BillingProvider in ./entitlements). The reasoning behind these numbers is in
 * the pricing strategy (7 October 2026).
 *
 * Prices are whole pounds, GBP, excluding VAT.
 */

export type PlanId = 'audit' | 'growth' | 'pro'
export type PaidPlanId = Exclude<PlanId, 'audit'>
export type Interval = 'month' | 'year'
export type FeatureStatus = 'available' | 'planned'

export const PLAN_IDS: readonly PlanId[] = ['audit', 'growth', 'pro']
export const PAID_PLAN_IDS: readonly PaidPlanId[] = ['growth', 'pro']

export const CURRENCY = 'GBP'
/** Every price shown is before VAT; the UI says "+ VAT" beside it. */
export const PRICES_EXCLUDE_VAT = true
/** UK VAT, added for UK businesses. */
export const VAT_RATE = 0.2
/** The stated annual discount. Annual prices below must equal 12 months less this. */
export const ANNUAL_DISCOUNT = 0.1
/** No setup or onboarding fee on any plan. */
export const SETUP_FEE = 0

/** List prices in whole pounds, ex VAT. The only place these numbers are written. */
const PRICES: Record<PlanId, Record<Interval, number>> = {
  audit: { month: 0, year: 0 },
  growth: { month: 240, year: 2592 },
  pro: { month: 500, year: 5400 },
}

/** Trial and founding terms. The free audit is the trial for everyone. */
export const FOUNDING = {
  /** The first this-many paying MSPs are the founding cohort. */
  cohortSize: 50,
  /** Founding MSPs get this many days of Growth or Pro free. */
  freeDays: 30,
  bands: [
    { from: 1, to: 10, priceLockMonths: 24, onboarding: 'Free audit run with the founder, a direct line to the founder', invoiced: true },
    { from: 11, to: 25, priceLockMonths: 12, onboarding: 'An onboarding call', invoiced: true },
    { from: 26, to: 50, priceLockMonths: 12, onboarding: 'Self-serve', invoiced: false },
  ],
} as const

/** From MSP 51 onwards: no separate trial, and the first payment is refundable within this many days. */
export const REFUND_WINDOW_DAYS = 30
/** After a paid plan ends, past reports stay readable for this many days. */
export const READ_ONLY_DAYS_AFTER_END = 30
/** A failed payment keeps full access for this many days while the card is retried. */
export const PAST_DUE_GRACE_DAYS = 7
/** Growth's client limit is soft: an analysis over it prompts a conversation, with this margin before it does. */
export const CLIENT_LIMIT_GRACE = 0.1

/**
 * Entitlements per plan. Infinity means no limit. Plan gating is not enforced
 * yet: see BILLING_LIVE in ./entitlements, which keeps every account on the
 * whole product until billing ships.
 */
export interface Entitlements {
  /** Analyses in total on the plan (the free audit is one). */
  maxAnalyses: number
  /** Analyses in any one calendar month. */
  maxAnalysesPerMonth: number
  /** Re-run on fresh exports and see what's new since the last run. */
  reruns: boolean
  recoveryQueue: boolean
  /** Full PDF and CSV reports (the summary PDF is on every plan). */
  fullReports: boolean
  summaryReport: boolean
  /** Client commercial view: contract vs reality. Read-only on the free audit. */
  clientView: 'read_only' | 'full'
  contractChecks: boolean
  aiExplanations: number
  historyMonths: number
  maxClients: number
  users: number
  /** Automatic monitoring and alerts: planned, so false on every plan today. */
  monitoring: boolean
  psaConnection: boolean
  prioritySupport: boolean
  quarterlyReview: boolean
}

export type EntitlementKey = keyof Entitlements

export const ENTITLEMENTS: Record<PlanId, Entitlements> = {
  audit: {
    maxAnalyses: 1,
    maxAnalysesPerMonth: 1,
    reruns: false,
    recoveryQueue: false,
    fullReports: false,
    summaryReport: true,
    clientView: 'read_only',
    contractChecks: true,
    aiExplanations: 3,
    historyMonths: 0,
    maxClients: 100,
    users: 1,
    monitoring: false,
    psaConnection: false,
    prioritySupport: false,
    quarterlyReview: false,
  },
  growth: {
    maxAnalyses: Infinity,
    maxAnalysesPerMonth: Infinity,
    reruns: true,
    recoveryQueue: true,
    fullReports: true,
    summaryReport: true,
    clientView: 'full',
    contractChecks: true,
    aiExplanations: Infinity,
    historyMonths: 12,
    maxClients: 100,
    users: 1,
    monitoring: false,
    psaConnection: false,
    prioritySupport: false,
    quarterlyReview: false,
  },
  pro: {
    maxAnalyses: Infinity,
    maxAnalysesPerMonth: Infinity,
    reruns: true,
    recoveryQueue: true,
    fullReports: true,
    summaryReport: true,
    clientView: 'full',
    contractChecks: true,
    aiExplanations: Infinity,
    historyMonths: Infinity,
    maxClients: Infinity,
    users: 1,
    monitoring: false,
    psaConnection: false,
    prioritySupport: true,
    quarterlyReview: true,
  },
}

export interface Feature {
  text: string
  status: FeatureStatus
}

export interface Cta {
  label: string
  /** An in-app route, or a mailto: link (href). */
  to?: string
  href?: string
  /** One line under the button. */
  note?: string
}

export interface Plan {
  id: PlanId
  /** The short name: Free, Growth, Pro. */
  name: string
  /** The plan's heading on the pricing page. */
  tagline: string
  /** Who it's for, in one line. */
  whoFor: string
  sub?: string
  recommended: boolean
  /** Sold on a call rather than self-serve. */
  salesLed: boolean
  cta: Cta
  /** Team seats are planned; today every workspace has one user. */
  usersPlanned: boolean
  features: Feature[]
}

const available = (text: string): Feature => ({ text, status: 'available' })
const planned = (text: string): Feature => ({ text, status: 'planned' })

const signupFor = (plan?: PlanId) => `/signup?intent=audit${plan && plan !== 'audit' ? `&plan=${plan}` : ''}`

// Pro is sales-led. Its button opens an email only when the company has a
// contact address; until then it starts the free audit with Pro noted, and
// says so rather than pretending a sales line exists.
const proCta = (): Cta =>
  COMPANY.contactEmail
    ? { label: 'Talk to Sales', href: `mailto:${COMPANY.contactEmail}?subject=${encodeURIComponent('Headroom Pro')}`, note: 'A 20-minute call to check Pro fits. No deck.' }
    : { label: 'Start with a free audit', to: signupFor('pro'), note: "Pro isn't on sale online yet. Start with the free audit; Pro opens to founding MSPs first." }

export const PLANS: Record<PlanId, Plan> = {
  audit: {
    id: 'audit',
    name: 'Free',
    tagline: 'Revenue Leakage Audit',
    whoFor: 'Find out what your MSP may be leaving on the table.',
    sub: 'One analysis of your own exports. No card.',
    recommended: false,
    salesLed: false,
    cta: { label: 'Get My Free Audit', to: signupFor() },
    usersPlanned: false,
    features: [
      available('Upload ticket, time, agreement and billing exports, plus contract PDFs if you have them'),
      available('Your potential opportunity figure, by type and by client'),
      available('Every opportunity with its evidence, calculation and confidence'),
      available('A summary report to share with your partner or finance lead'),
    ],
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tagline: 'Continuous Commercial Intelligence',
    whoFor: 'For MSPs that want continuous visibility into revenue leakage, agreement drift, unbilled work and client profitability.',
    recommended: true,
    salesLed: false,
    cta: { label: 'Start Monitoring', to: signupFor('growth'), note: `First ${FOUNDING.freeDays} days free for founding MSPs.` },
    usersPlanned: true,
    features: [
      available('Everything in the free audit'),
      available("Re-run monthly on fresh exports and see what's new since the last run"),
      available('Recovery queue to work each opportunity through to a decision'),
      available('Contract vs reality for every client'),
      available('Contract and SOW checks against your uploaded PDFs'),
      available('PDF and CSV reports for client reviews'),
      available('Your analysis history, with what changed since the last run'),
      planned('Direct PSA connection'),
      planned('Automatic monitoring and alerts'),
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'Advanced Commercial Intelligence',
    whoFor: 'For larger MSPs that need deeper commercial analysis, advanced reporting and multiple environments.',
    recommended: false,
    salesLed: true,
    cta: proCta(),
    usersPlanned: true,
    features: [
      available('Everything in Growth'),
      available('Unlimited clients'),
      // A support promise needs a published support channel. Until one exists it is planned, and once it does the
      // wording is a target, not a service level (the Terms offer none).
      COMPANY.contactEmail ? available('Priority support from a named contact. We aim to reply within one business day') : planned('Priority support from a named contact'),
      available('A quarterly commercial review: we go through your findings with you and run custom analysis on request'),
      planned('Multiple PSA environments and entities'),
      planned('Advanced reporting'),
      planned('Deeper contract intelligence'),
    ],
  },
}

/** The illustration on the pricing page. An example, never a forecast. */
export const ROI_EXAMPLE = { users: 5, pricePerUser: 60 } as const

// ---- Prices and formatting ----

/** The list price for a plan and interval, whole pounds ex VAT. */
export const priceFor = (plan: PlanId, interval: Interval): number => PRICES[plan][interval]

/** What an interval works out at per month (annual divided by 12). */
export const perMonth = (plan: PlanId, interval: Interval): number => (interval === 'year' ? PRICES[plan].year / 12 : PRICES[plan].month)

/** The annual discount as it actually falls out of the prices, 0 to 1. */
export const annualDiscountFor = (plan: PlanId): number => (PRICES[plan].month === 0 ? 0 : 1 - PRICES[plan].year / (PRICES[plan].month * 12))

/** The discount as a whole percentage for copy ("Save 10%"). */
export const annualDiscountPct = (): number => Math.round(ANNUAL_DISCOUNT * 100)

export const vatPct = (): number => Math.round(VAT_RATE * 100)

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: CURRENCY, maximumFractionDigits: 0, minimumFractionDigits: 0 })

/** £240, £2,592. Whole pounds; a price that isn't whole shows pence. */
export function formatPrice(pounds: number): string {
  if (Number.isInteger(pounds)) return gbp.format(pounds)
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(pounds)
}

/** "£240 a month + VAT" */
export const formatMonthly = (plan: PlanId): string => `${formatPrice(priceFor(plan, 'month'))} a month${PRICES_EXCLUDE_VAT ? ' + VAT' : ''}`

/** "£2,592 a year (£216 a month)" */
export const formatAnnual = (plan: PlanId): string => `${formatPrice(priceFor(plan, 'year'))} a year (${formatPrice(perMonth(plan, 'year'))} a month)`

/** "Up to 100", "Unlimited" */
export const formatLimit = (n: number, upTo = true): string => (n === Infinity ? 'Unlimited' : upTo ? `Up to ${n}` : String(n))

/** A plan id from a URL or a stored value, or null when it isn't one. */
export const parsePlanId = (v: string | null | undefined): PlanId | null => (v && (PLAN_IDS as readonly string[]).includes(v) ? (v as PlanId) : null)

/** The short pricing line the footer and other summaries share. */
export const pricingSummary = (): string =>
  `Free audit, then ${PLANS.growth.name} at ${formatPrice(priceFor('growth', 'month'))} or ${PLANS.pro.name} at ${formatPrice(priceFor('pro', 'month'))} a month + VAT. Annual plans save ${annualDiscountPct()}%.`
