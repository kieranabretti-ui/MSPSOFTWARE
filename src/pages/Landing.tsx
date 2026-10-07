import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { ButtonLink, TextLink } from '../components/ui'
import { BRAND } from '../brand/brand'
import { AuditPanel } from './landing/AuditPanel'
import { ClientExample } from './landing/ClientExample'
import { Faq } from './landing/Faq'
import { Flow } from './landing/Flow'
import { Pricing } from './landing/Pricing'
import { ProductPreview } from './landing/ProductPreview'
import { Problem } from './landing/Problem'
import { SecuritySummary } from './landing/SecuritySummary'
import { AuditCta, BuiltForMsps, Close, Footer, TopBar, WhoBuilds } from './landing/chrome'
import { wrap } from './landing/primitives'

// The landing page is the audit. It says what Headroom finds and the real
// product shows it in the first viewport, using the demo MSP's real figures
// from a precomputed snapshot (./landing/demoSnapshot.ts), so the page never
// ships the engine. Every section below shows the product's own output, not
// illustration, then answers the questions an owner asks before uploading.
export default function Landing() {
  const { hash } = useLocation()

  // Arriving from another page at /#pricing: the section exists only once
  // React has drawn it, so bring it into view after the first render.
  useEffect(() => {
    if (hash.length > 1) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [hash])

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only rounded-md bg-raised text-body font-medium text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <TopBar />

      <main id="main" tabIndex={-1} className="focus:outline-none">
        <section aria-labelledby="hero-title">
          {/* The claim and its supporting copy share a column; the audit panel
              starts beside the headline's second line. */}
          <div
            className={`${wrap} grid grid-cols-1 gap-x-12 gap-y-12 pb-20 pt-12 [--hero-size:clamp(2.75rem,1.15rem_+_5.4vw,5rem)] sm:pt-16 lg:grid-cols-12 lg:pb-28 lg:pt-14 lg:[--hero-size:clamp(3.5rem,0.75rem_+_4.4vw,4.75rem)] xl:pt-20`}
          >
            <div className="lg:col-span-6 xl:col-span-5">
              <h1 id="hero-title" className="max-w-[15ch] text-balance text-[length:var(--hero-size)] font-semibold leading-[0.98] tracking-(--type-display-tracking) text-ink">
                {BRAND.tagline}
              </h1>
              <p className="mt-6 max-w-[48ch] text-lead text-ink-2 lg:mt-8">
                Upload your PSA exports and contracts. Headroom finds unbilled work, agreement drift, scope creep and underpriced clients, with the ticket, time entry or clause behind every pound.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:mt-8">
                <AuditCta location="hero" />
                <ButtonLink to="/#how" variant="secondary" size="lg" onClick={() => document.getElementById('how')?.scrollIntoView()}>
                  See how it works
                </ButtonLink>
              </div>
              <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ink-3">
                <span>Free. No card, no integration: CSV exports and contract PDFs.</span>
                <TextLink to="/demo" className="group inline-flex items-center gap-1">
                  Explore the demo
                  <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
                </TextLink>
              </p>
            </div>
            <div className="lg:col-span-6 lg:mt-[calc(var(--hero-size)*0.98)] xl:col-span-7">
              <AuditPanel />
            </div>
          </div>
        </section>

        <Problem />
        <Flow />
        <ProductPreview />
        <ClientExample />
        <BuiltForMsps />
        <SecuritySummary />
        <Pricing />
        <Faq />
        <WhoBuilds />
        <Close />
      </main>

      <Footer />
    </div>
  )
}
