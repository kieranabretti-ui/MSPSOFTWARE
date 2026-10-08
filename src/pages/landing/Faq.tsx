import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { TextLink } from '../../components/ui'
import { COMPANY, HOSTED, TRUST_COPY } from '../../brand/brand'
import { CONFIDENCE } from '../../lib/labels'
import { money } from '../../lib/format'
import { ENTITLEMENTS, PLANS, READ_ONLY_DAYS_AFTER_END, formatLimit } from '../../billing/plans'
import { DEMO } from './demoSnapshot'
import { Section, inWords, sectionTitleCls } from './primitives'

// The questions an MSP owner asks before uploading anything, answered with
// what the product does today. Native details and summary: keyboard and
// screen-reader support come with the elements, and no script runs.

const QUESTIONS: { q: string; a: ReactNode }[] = [
  {
    q: 'Does this work with my PSA?',
    a: `Yes, through exports. Headroom works from CSV exports that any PSA, RMM or billing system can produce, plus contract PDFs. You map the columns when you upload, so the file layout doesn't matter. Direct PSA connection is planned, and when it launches it will be included in ${PLANS.growth.name}. Until then, exports cover everything the analysis needs.`,
  },
  {
    q: 'Do I need to change my PSA?',
    a: 'No. Headroom reads exports from the tools you already use and changes nothing in them.',
  },
  {
    q: 'What data do I need?',
    a: 'Start with your client list (monthly recurring revenue, contracted users and devices) and a ticket export. Time entries, users and devices, billing lines and contract PDFs make the analysis more complete. Contracts are what let Headroom check work against what each agreement covers.',
  },
  {
    q: 'Is my customer data secure?',
    a: (
      <>
        {HOSTED
          ? "Your exports are read in your browser and saved to a workspace only its members can access, enforced by row-level security in the database. Contract files sit in private storage, and key actions are recorded in an audit log. AI only runs when you ask it to explain a single opportunity. "
          : "This site is running in evaluation mode, so data stays in your browser and isn't protected by a server login: use the demo or sample data, not client data. "}
        Headroom isn't SOC 2 or ISO 27001 certified yet;{' '}
        <TextLink to="/trust" className="text-body underline">
          the Trust Centre
        </TextLink>{' '}
        sets out exactly what is and isn't in place, who our providers are and how deletion works.
      </>
    ),
  },
  {
    q: 'Does it automatically bill my customers?',
    a: 'No. Headroom never contacts, invoices or charges your clients. It shows you the opportunity and its evidence; you decide what to bill, reprice or let go.',
  },
  {
    q: 'How accurate are the opportunities?',
    a: `Every opportunity comes from deterministic rules, so the same data always gives the same result. Each one shows the records behind it, the file and row they came from, how its value was calculated, and a confidence level. ${TRUST_COPY.confidence} High: ${CONFIDENCE.HIGH.definition} Medium: ${CONFIDENCE.MEDIUM.definition} Low: ${CONFIDENCE.LOW.definition} ${TRUST_COPY.review}`,
  },
  {
    q: 'Does AI work out the figures?',
    a: `No. ${TRUST_COPY.ai} Rules find each opportunity and calculate its value. AI is used only when you ask for a plain-English explanation of one opportunity, and that text is labelled AI-assisted.`,
  },
  {
    q: 'Does it replace my PSA?',
    a: 'No. Your PSA runs tickets and billing. Headroom sits above it as a commercial layer, showing where agreements, work and charges have drifted apart.',
  },
  {
    q: 'How much could I recover?',
    a: `It depends on your data, your agreements and how you price, and we don't promise a figure. As an example, the fictional demo MSP (${DEMO.totals.clients} clients) shows ${money(DEMO.totals.identified)} of potential opportunity over ${inWords(DEMO.period.months)} months: ${money(DEMO.totals.highConfidence)} at high confidence and ${money(DEMO.totals.requiresReview)} that requires review. ${money(DEMO.totals.monthly)} a month of it is recurring. Your first audit is free, so you can see exactly what we find before you pay.`,
  },
  {
    q: 'What if my audit finds very little?',
    a: `Then the audit shows you that before you pay anything. If it finds less than ${PLANS.growth.name} costs, ${PLANS.growth.name} probably isn't worth it for you yet.`,
  },
  {
    q: "Why don't you charge per endpoint or per user?",
    a: `The value is the commercial opportunity, not your device count. Each plan has one price. ${PLANS.growth.name} covers ${formatLimit(ENTITLEMENTS.growth.maxClients).toLowerCase()} clients; ${PLANS.pro.name} has no limit.`,
  },
  {
    q: 'Can I change plan or cancel?',
    a: `Paid plans aren't on sale yet, so there is nothing to pay for or cancel today, and you can delete your workspace at any time in Settings. When paid plans open, you'll be able to move to a higher plan at any time; downgrades and cancellations will take effect at the end of the period you've paid for, with read-only access to past reports for ${READ_ONLY_DAYS_AFTER_END} days after that.`,
  },
  ...(COMPANY.contactEmail
    ? [
        {
          q: `Why does ${PLANS.pro.name} start with a call?`,
          a: `Part of ${PLANS.pro.name} is delivered by people: priority support now, and a quarterly review that is planned. A short call confirms it fits and shows which planned items matter to you.`,
        },
      ]
    : []),
]

export function Faq() {
  return (
    <Section id="faq" label="faq-title">
      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-12">
        <div className="lg:sticky lg:top-24 lg:col-span-4 lg:self-start">
          <h2 id="faq-title" className={sectionTitleCls}>
            Questions owners ask first.
          </h2>
          <p className="mt-5 max-w-[40ch] text-lead text-ink-2">Straight answers about your data, your PSA and what the figures mean.</p>
        </div>
        <div className="border-b border-line-soft lg:col-span-8">
          {QUESTIONS.map(({ q, a }) => (
            <details key={q} className="group border-t border-line-soft">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 rounded-sm py-4 text-lead font-medium text-ink transition-colors hover:text-ink-2 [&::-webkit-details-marker]:hidden">
                {q}
                <Plus className="size-4 shrink-0 text-ink-3 transition-transform duration-200 ease-out-brand group-open:rotate-45" aria-hidden />
              </summary>
              <div className="max-w-[68ch] pb-6 pr-10 text-body text-ink-2">{a}</div>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}
