import { ArrowRight } from 'lucide-react'
import { ButtonLink } from '../components/ui'
import { useStore } from '../data/store'
import { AuditPanel } from './landing/AuditPanel'
import { ClientExample } from './landing/ClientExample'
import { Flow } from './landing/Flow'
import { ProductPreview } from './landing/ProductPreview'
import { Problem } from './landing/Problem'
import { BuiltForMsps, Close, Footer, TopBar } from './landing/chrome'
import { wrap } from './landing/primitives'

// The landing page is the audit. It asks the question and the real product
// answers it in the first viewport, using the demo MSP's real figures from a
// precomputed snapshot (./landing/demoSnapshot.ts), so the page never ships the
// engine. Every section below shows the product's own output, not illustration.
export default function Landing() {
  const { user, workspace } = useStore()

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <TopBar signedIn={!!(user && workspace)} />

      <main>
        <section aria-labelledby="hero-title">
          {/* The question and its supporting copy share a column; the audit panel
              starts beside the question's second line, so both columns end together. */}
          <div
            className={`${wrap} grid grid-cols-1 gap-x-12 gap-y-12 pb-20 pt-12 [--hero-size:clamp(2.75rem,1.15rem_+_5.4vw,5rem)] sm:pt-16 lg:grid-cols-12 lg:pb-28 lg:pt-20 lg:[--hero-size:clamp(3.5rem,0.5rem_+_4.6vw,4.75rem)]`}
          >
            <div className="lg:col-span-5 lg:flex lg:flex-col">
              <h1 id="hero-title" className="max-w-[16ch] text-balance text-[length:var(--hero-size)] font-semibold leading-[0.98] tracking-(--type-display-tracking) text-ink">
                How much money is your MSP giving away?
              </h1>
              <div className="mt-8 lg:mt-10">
                <p className="max-w-[46ch] text-lead text-ink-2">
                  Headroom analyses your tickets, contracts and billing data to uncover revenue that quietly disappears through scope creep, missed charges and underpriced clients.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <ButtonLink to="/signup" variant="accent" size="lg">
                    Find My Lost Revenue <ArrowRight className="size-4" aria-hidden />
                  </ButtonLink>
                  <ButtonLink to="/demo" variant="secondary" size="lg">
                    View Demo
                  </ButtonLink>
                </div>
              </div>
              {/* The small print settles at the foot of the column, level with the panel's own footnote. */}
              <p className="mt-5 max-w-[40ch] text-small text-ink-3 lg:mt-auto lg:pt-8">Works from the CSV exports and contract PDFs you already have. Figures are potential leakage to review, never promised.</p>
            </div>
            <div className="lg:col-span-7 lg:mt-[calc(var(--hero-size)*0.98)]">
              <AuditPanel />
            </div>
          </div>
        </section>

        <Problem />
        <Flow />
        <ProductPreview />
        <ClientExample />
        <BuiltForMsps />
        <Close />
      </main>

      <Footer />
    </div>
  )
}
