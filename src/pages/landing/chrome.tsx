import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Badge, Button, ButtonLink, Disclaimer, Logo, cx, type Tone } from '../../components/ui'
import { useToast } from '../../components/toast'
import { BRAND, COMPANY } from '../../brand/brand'
import { useStore } from '../../data/store'
import { money } from '../../lib/format'
import { track } from '../../lib/track'
import { DEMO } from './demoSnapshot'
import { MobileMenu, type MenuLink } from './MobileMenu'
import { Section, displayCls, sectionTitleCls, wrap } from './primitives'

// The page frame: the audit button every section shares, the top bar, the
// "built for MSPs" facts, the close and the footer. The top bar and footer
// also frame the security page.

export const AUDIT_LABEL = 'Get a Free Revenue Leakage Audit'

// The free audit is a self-serve account and its first analysis. From inside
// the demo, the button ends the demo first, so it can't loop back into it.
export function AuditCta({
  location,
  label = AUDIT_LABEL,
  variant = 'accent',
  size = 'lg',
  plan,
  arrow = size === 'lg',
  className,
}: {
  location: string
  label?: string
  variant?: 'accent' | 'primary' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  plan?: string
  arrow?: boolean
  className?: string
}) {
  const { isDemoSession, signOut } = useStore()
  const nav = useNavigate()
  const toast = useToast()
  const [leaving, setLeaving] = useState(false)
  const to = `/signup?intent=audit${plan ? `&plan=${plan}` : ''}`
  const clicked = () => track('cta_click', { location, label, to })
  const body = (
    <>
      {label}
      {arrow && <ArrowRight className="size-4" aria-hidden />}
    </>
  )
  if (!isDemoSession)
    return (
      <ButtonLink to={to} variant={variant} size={size} className={className} onClick={clicked}>
        {body}
      </ButtonLink>
    )

  const leaveDemo = async () => {
    clicked()
    setLeaving(true)
    try {
      await signOut()
      nav(to)
    } catch {
      setLeaving(false)
      toast("We couldn't end the demo. Try again.", 'error')
    }
  }
  return (
    <Button variant={variant} size={size} className={className} loading={leaving} onClick={leaveDemo}>
      {body}
    </Button>
  )
}

// The site's sections. Security is its own page; the rest are anchors on the landing page.
const SECTIONS: { label: string; id?: string; route?: string }[] = [
  { label: 'Product', id: 'product' },
  { label: 'How it works', id: 'how' },
  { label: 'Pricing', id: 'pricing' },
  { label: 'Security', route: '/security' },
  { label: 'FAQ', id: 'faq' },
]

function useSectionLinks(): MenuLink[] {
  const { pathname } = useLocation()
  // On the landing page the sections are plain anchors; elsewhere they route back to it, and the
  // landing page brings the section into view.
  return SECTIONS.map((s) =>
    s.route ? { label: s.label, href: s.route, route: true, current: pathname === s.route } : pathname === '/' ? { label: s.label, href: `#${s.id}` } : { label: s.label, href: `/#${s.id}`, route: true },
  )
}

const NAV_LINK = 'rounded-sm px-3 py-1.5 text-small font-medium transition-colors hover:text-ink'

export function TopBar() {
  const { user, workspace, isDemoSession } = useStore()
  const links = useSectionLinks()
  const own = !!(user && workspace) && !isDemoSession
  const account: MenuLink[] = own ? [] : isDemoSession ? [{ label: 'Back to the demo', href: '/app', route: true }] : [{ label: 'Sign in', href: '/login', route: true }]

  return (
    <header className="sticky top-0 z-30 border-b border-line-soft bg-canvas">
      <div className={`${wrap} flex h-14 items-center justify-between gap-3`}>
        <Link to="/" className="shrink-0 rounded-sm">
          <Logo />
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-1 lg:flex">
          {links.map((l) =>
            l.route ? (
              <Link key={l.label} to={l.href} aria-current={l.current ? 'page' : undefined} className={cx(NAV_LINK, l.current ? 'text-ink' : 'text-ink-3')}>
                {l.label}
              </Link>
            ) : (
              <a key={l.label} href={l.href} className={cx(NAV_LINK, 'text-ink-3')}>
                {l.label}
              </a>
            ),
          )}
        </nav>
        <div className="flex items-center gap-1.5">
          {own ? (
            <ButtonLink to="/app" size="sm">
              Open dashboard
            </ButtonLink>
          ) : (
            <>
              {isDemoSession ? (
                <span className="hidden sm:flex">
                  <ButtonLink to="/app" variant="ghost" size="sm">
                    Back to the demo
                  </ButtonLink>
                </span>
              ) : (
                <Link to="/login" className="hidden h-8 items-center rounded-md px-3 text-small font-medium text-ink-2 transition-colors hover:bg-raised hover:text-ink lg:inline-flex">
                  Sign in
                </Link>
              )}
              {/* Bone, not lime: the hero's button stays the only lime one in view. */}
              <AuditCta location="top_bar" label="Get free audit" variant="primary" size="sm" />
            </>
          )}
          <MobileMenu links={links} account={account} />
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
    title: 'Evidence on every opportunity',
    body: 'Deterministic rules tie each pound to a ticket, time entry, device, charge or clause. An optional AI explanation puts one opportunity into plain English when you ask for it.',
    status: 'Works today',
    tone: 'neutral',
  },
  {
    title: 'Reports for client reviews',
    body: 'Take the opportunities into a client review or a management meeting as a PDF report or a CSV.',
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
        <div className="lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
          <h2 id="built-title" className={sectionTitleCls}>
            Built for the data MSPs already have.
          </h2>
          <p className="mt-5 max-w-[48ch] text-lead text-ink-2">
            If your PSA, RMM and billing system can export a CSV, you can run an audit today. No agent to install, no admin access, no integration project.
          </p>
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

// Who builds Headroom. Renders only once the owner has supplied the facts.
export function WhoBuilds() {
  const f = COMPANY.founder
  if (!f) return null
  return (
    <Section id="who" label="who-title">
      <div className="grid grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-12">
        <h2 id="who-title" className={cx(sectionTitleCls, 'lg:col-span-5')}>
          Who builds Headroom.
        </h2>
        <div className="lg:col-span-7">
          <p className="text-h3 text-ink">{f.name}</p>
          <p className="text-small text-ink-3">{f.role}</p>
          <p className="mt-4 max-w-[64ch] text-body text-ink-2">{f.bio}</p>
        </div>
      </div>
    </Section>
  )
}

export function Close() {
  return (
    <section aria-labelledby="close-title" className="border-t border-line-soft">
      <div className={`${wrap} py-16 sm:py-20 lg:py-24`}>
        <h2 id="close-title" className={`${displayCls} max-w-[20ch] text-balance`}>
          Find out what your MSP is leaving on the table.
        </h2>
        <p className="mt-6 max-w-[48ch] text-balance text-[length:clamp(1.25rem,1rem+1vw,1.75rem)] font-medium leading-snug tracking-[-0.02em] text-ink-2">
          Run a free revenue leakage audit using your existing PSA data.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <AuditCta location="close_primary" label="Get My Free Audit" />
          <ButtonLink to="/demo" variant="secondary" size="lg">
            See the demo
          </ButtonLink>
        </div>
        <p className="tnum mt-4 max-w-[64ch] text-small text-ink-3">
          The demo found {money(DEMO.totals.identified)} of potential leakage in {DEMO.period.months} months of {DEMO.msp}'s data. Upload your own exports to see yours.
        </p>
      </div>
    </section>
  )
}

const FOOT_LINK = 'rounded-sm text-small text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline'

export function Footer() {
  const sections = useSectionLinks()
  const site: MenuLink[] = [
    ...sections.filter((l) => l.label !== 'How it works'),
    { label: 'See the demo', href: '/demo', route: true },
    { label: 'Create an account', href: '/signup', route: true },
    { label: 'Sign in', href: '/login', route: true },
  ]
  // Shown only once the owner supplies them.
  const legal = [
    COMPANY.privacyUrl && { label: 'Privacy', href: COMPANY.privacyUrl },
    COMPANY.termsUrl && { label: 'Terms', href: COMPANY.termsUrl },
    COMPANY.contactEmail && { label: 'Contact', href: `mailto:${COMPANY.contactEmail}` },
  ].filter((l): l is { label: string; href: string } => !!l)

  return (
    <footer className="border-t border-line-soft bg-sunken">
      <div className={`${wrap} grid grid-cols-1 gap-x-12 gap-y-10 py-14 lg:grid-cols-12`}>
        <div className="lg:col-span-5">
          <Logo />
          <p className="mt-3 text-small font-medium text-ink">{COMPANY.descriptor}.</p>
          <p className="mt-1 max-w-[36ch] text-small text-ink-3">{BRAND.tagline}</p>
        </div>
        <nav aria-label="Footer" className="lg:col-span-3">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-1">
            {[...site, ...legal].map((l) => (
              <li key={l.label}>
                {'route' in l && l.route ? (
                  <Link to={l.href} className={FOOT_LINK}>
                    {l.label}
                  </Link>
                ) : (
                  <a href={l.href} className={FOOT_LINK}>
                    {l.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div className="lg:col-span-4">
          <p className="text-small font-medium text-ink">Planned pricing</p>
          <p className="tnum mt-1.5 max-w-[44ch] text-small text-ink-3">Starter £99, Growth £249 and Pro £499 a month. Not live yet; your first audit is free.</p>
          {(COMPANY.legalName || COMPANY.registeredAddress) && (
            <p className="mt-5 text-caption text-ink-3">{[COMPANY.legalName, COMPANY.registeredAddress].filter(Boolean).join(', ')}</p>
          )}
        </div>
      </div>
      <div className="border-t border-line-soft">
        <div className={`${wrap} space-y-2 py-6`}>
          <p className="text-caption text-ink-3">Demo data: {DEMO.msp} and its clients, tickets, contracts and figures are fictional, built to show how Headroom works.</p>
          <Disclaimer />
        </div>
      </div>
    </footer>
  )
}
