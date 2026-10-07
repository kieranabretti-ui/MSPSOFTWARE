import { ArrowRight } from 'lucide-react'
import { TextLink, cx } from '../../components/ui'
import { Section, sectionTitleCls } from './primitives'

// What Headroom does with an MSP's data today, in sentences the code backs.
// The full account, including what isn't in place yet, is on /security.

const FACTS: { title: string; body: string }[] = [
  {
    title: 'Exports, not access',
    body: 'Headroom works from files you choose to upload. It needs no agent, admin account or API credentials, and never connects to your PSA.',
  },
  {
    title: 'Your workspace only',
    body: 'On the hosted service, data is stored in Postgres with row-level security on every table, so only signed-in members of your workspace can read it. Contract PDFs sit in private storage.',
  },
  {
    title: 'Rules, not guesswork',
    body: 'A deterministic rules engine finds every opportunity and its value in your browser. The same data always gives the same result.',
  },
  {
    title: 'AI only when you ask',
    body: "An optional explanation sends one opportunity and its evidence to Anthropic's Claude API from the server. The API key never reaches your browser.",
  },
  {
    title: 'Not certified yet',
    body: "Headroom isn't SOC 2 or ISO 27001 certified. The security page lists what is and isn't in place.",
  },
]

export function SecuritySummary() {
  return (
    <Section id="security" label="security-title" className="bg-sunken">
      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <h2 id="security-title" className={sectionTitleCls}>
            How your data is handled.
          </h2>
          <p className="mt-5 max-w-[44ch] text-lead text-ink-2">Headroom is early-stage software, so here is exactly what it does with your data today.</p>
          <TextLink to="/security" className="group mt-6 inline-flex items-center gap-1 text-body">
            Read how Headroom handles your data
            <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
          </TextLink>
        </div>
        <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:col-span-8">
          {FACTS.map((f, i) => (
            <div key={f.title} className={cx('border-t border-line py-5', i === FACTS.length - 1 && 'sm:col-span-2')}>
              <dt className="text-h3 text-ink">{f.title}</dt>
              <dd className="mt-1.5 max-w-[60ch] text-body text-ink-2">{f.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  )
}
