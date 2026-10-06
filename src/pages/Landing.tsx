import { ArrowRight } from 'lucide-react'
import { ButtonLink } from '../components/ui'
import { useStore } from '../data/store'
import { AuditPanel } from './landing/AuditPanel'
import { ClientExample } from './landing/ClientExample'
import { Flow } from './landing/Flow'
import { ProductPreview } from './landing/ProductPreview'
import { Problem } from './landing/Problem'
import { BuiltForMsps, Close, Footer, TopBar } from './landing/chrome'
import { displayCls, wrap } from './landing/primitives'

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
          <div className={`${wrap} pb-20 pt-12 sm:pt-16 lg:pb-28 lg:pt-20`}>
            <h1 id="hero-title" className={`${displayCls} max-w-[16ch] text-balance lg:max-w-[22ch]`}>
              How much money is your MSP giving away?
            </h1>

            <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-12 lg:mt-12 lg:grid-cols-12">
              <div className="lg:col-span-4 lg:pt-1">
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
                <p className="mt-5 max-w-[40ch] text-small text-ink-3">Works from the CSV exports and contract PDFs you already have. Figures are potential leakage to review, never promised.</p>
              </div>
              <div className="lg:col-span-8">
                <AuditPanel />
              </div>
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
