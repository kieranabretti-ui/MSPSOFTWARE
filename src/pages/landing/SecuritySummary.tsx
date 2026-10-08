import { ArrowRight } from 'lucide-react'
import { COMPANY, HOSTED } from '../../brand/brand'
import { TextLink, cx } from '../../components/ui'
import { Section, sectionTitleCls } from './primitives'

// What Headroom does with an MSP's data, in sentences the code backs. Claims
// about server-side controls appear only on the hosted service (HOSTED); in
// evaluation mode the section says plainly that data stays in the browser.
// The full account, including what isn't in place yet, is the Trust Centre.

const STORAGE = HOSTED
  ? {
      title: 'Your workspace only',
      body: `Data is stored${COMPANY.hostingRegion ? ` in ${COMPANY.hostingRegion}` : ''} in Postgres with row-level security on every table, so only signed-in members of your workspace can read it. Contract files sit in private storage, and key actions go to an audit log you can check.`,
    }
  : {
      title: 'Evaluation mode',
      body: "This site is running in evaluation mode: data stays in your browser and isn't protected by a server login. Use the demo or sample data, not client data.",
    }

const FACTS: { title: string; body: string }[] = [
  {
    title: 'Exports, not access',
    body: 'Headroom works from files you choose to upload. It needs no agent, admin account or API credentials, and never connects to your PSA.',
  },
  STORAGE,
  {
    title: 'Rules, not guesswork',
    body: 'A deterministic rules engine finds every opportunity and calculates its value. The same data always gives the same result, and every calculation is shown.',
  },
  {
    title: 'AI only when you ask',
    body: "An optional explanation sends one opportunity and its evidence to Anthropic's API (United States) from our server. AI never produces a figure, and its text is labelled AI-assisted.",
  },
  {
    title: 'Not certified yet',
    body: "Headroom isn't SOC 2 or ISO 27001 certified and hasn't had a penetration test. The Trust Centre lists what is and isn't in place, and who our providers are.",
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
          <TextLink to="/trust" className="group mt-6 inline-flex items-center gap-1 text-body">
            Visit the Trust Centre
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
