import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge, ButtonLink, Disclaimer, Logo, type Tone } from '../../components/ui'
import { BRAND } from '../../brand/brand'
import { money } from '../../lib/format'
import { DEMO } from './demoSnapshot'
import { Section, displayCls, sectionTitleCls, wrap } from './primitives'

// The page frame: top bar, the "built for MSPs" facts, the close and the footer.

const SECTIONS = [
  { href: '#problem', label: 'Leaks' },
  { href: '#how', label: 'How it works' },
  { href: '#product', label: 'Product' },
  { href: '#example', label: 'Client example' },
]

export function TopBar({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-canvas">
      <div className={`${wrap} flex h-14 items-center justify-between gap-3`}>
        <Link to="/" className="shrink-0 rounded-sm">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {SECTIONS.map((s) => (
            <a key={s.href} href={s.href} className="rounded-sm px-3 py-1.5 text-small font-medium text-ink-3 transition-colors hover:text-ink">
              {s.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          {signedIn ? (
            <ButtonLink to="/app" size="sm">
              Open dashboard
            </ButtonLink>
          ) : (
            <>
              <Link to="/login" className="hidden h-8 items-center rounded-md px-3 text-small font-medium text-ink-2 transition-colors hover:bg-raised hover:text-ink min-[400px]:inline-flex">
                Sign in
              </Link>
              <ButtonLink to="/signup" size="sm">
                Find My Lost Revenue
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

const FACTS: { title: string; body: string; status: string; tone: Tone }[] = [
  {
    title: 'CSV exports you already run',
    body: 'Clients, tickets, time entries, users and devices, and billing lines from your PSA, RMM and billing system. Map the columns as you upload.',
    status: 'Works today',
    tone: 'neutral',
  },
  {
    title: 'Contract and SOW PDFs',
    body: 'Headroom reads the clauses that decide what is billable: business hours, company-owned devices, onsite visits, project work, hardware and third-party software.',
    status: 'Works today',
    tone: 'neutral',
  },
  {
    title: 'Evidence on every finding',
    body: 'Deterministic rules tie each pound to a ticket, time entry, device, charge or clause. An optional AI review explains a finding in plain English.',
    status: 'Works today',
    tone: 'neutral',
  },
  {
    title: 'Reports for client reviews',
    body: 'Take the findings into a client review or a management meeting as a PDF report or a CSV.',
    status: 'Works today',
    tone: 'neutral',
  },
  {
    title: 'Direct PSA and accounting integrations',
    body: 'Connections that pull the same data automatically are planned. Until they arrive, exports cover everything the analysis needs.',
    status: 'Planned',
    tone: 'info',
  },
]

export function BuiltForMsps() {
  return (
    <Section id="built" label="built-title">
      <div className="grid grid-cols-1 gap-x-12 gap-y-10 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 id="built-title" className={sectionTitleCls}>
            Built for the data MSPs already have.
          </h2>
          <p className="mt-5 max-w-[48ch] text-lead text-ink-2">If your PSA, RMM and billing system can export a CSV, you can run an audit today. No agent to install, no admin access, no integration project.</p>
        </div>
        <dl className="lg:col-span-7">
          {FACTS.map((f) => (
            <div key={f.title} className="grid grid-cols-1 gap-x-8 gap-y-1.5 border-t border-line-soft py-5 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
              <dt className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:flex-col sm:items-start">
                <span className="text-h3 text-ink">{f.title}</span>
                <Badge tone={f.tone}>{f.status}</Badge>
              </dt>
              <dd className="text-body text-ink-2">{f.body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Section>
  )
}

export function Close() {
  return (
    <section aria-labelledby="close-title" className="border-t border-line-soft">
      <div className={`${wrap} grid grid-cols-1 gap-x-12 gap-y-10 py-24 sm:py-28 lg:grid-cols-12 lg:items-end lg:py-36`}>
        <div className="lg:col-span-8">
          <h2 id="close-title" className={displayCls}>
            Stop doing work for free.
          </h2>
          <p className="mt-5 text-[length:clamp(1.25rem,1rem+1vw,1.75rem)] font-medium leading-snug tracking-[-0.02em] text-ink-2">Run your first revenue audit.</p>
        </div>
        <div className="lg:col-span-4">
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
            <ButtonLink to="/signup" variant="accent" size="lg">
              Find My Lost Revenue <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink to="/demo" variant="secondary" size="lg">
              View Demo
            </ButtonLink>
          </div>
          <p className="tnum mt-4 max-w-[44ch] text-small text-ink-3">
            The demo found {money(DEMO.totals.identified)} of potential leakage in {DEMO.period.months} months of {DEMO.msp}'s data. Upload your own exports to see yours.
          </p>
        </div>
      </div>
    </section>
  )
}

const FOOT_LINKS = [
  { to: '/demo', label: 'View Demo' },
  { to: '/signup', label: 'Create an account' },
  { to: '/login', label: 'Sign in' },
]

export function Footer() {
  return (
    <footer className="border-t border-line-soft bg-sunken">
      <div className={`${wrap} grid grid-cols-1 gap-x-12 gap-y-10 py-14 lg:grid-cols-12`}>
        <div className="lg:col-span-5">
          <Logo />
          <p className="mt-3 max-w-[36ch] text-small text-ink-2">{BRAND.tagline}</p>
        </div>
        <nav aria-label="Footer" className="lg:col-span-3">
          <ul className="space-y-2.5">
            {FOOT_LINKS.map((l) => (
              <li key={l.to}>
                <Link to={l.to} className="rounded-sm text-small text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lg:col-span-4">
          <p className="text-small font-medium text-ink">Pricing (planned)</p>
          <p className="tnum mt-1.5 text-small text-ink-3">Starter £99, Growth £249 and Scale £499 a month. Pricing is not live yet.</p>
        </div>
      </div>
      <div className="border-t border-line-soft">
        <div className={`${wrap} space-y-2 py-6`}>
          <p className="text-caption text-ink-3">
            Demo data: {DEMO.msp} and its clients, tickets, contracts and figures are fictional, built to show how Headroom works.
          </p>
          <Disclaimer />
        </div>
      </div>
    </footer>
  )
}
