import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Disclaimer, Figure, Logo } from '../../components/ui'
import { GapBar } from '../../components/bars'
import { BRAND } from '../../brand/brand'
import { ICONS } from '../../brand/icons'
import { money } from '../../lib/format'
import { supabaseConfigured } from '../../data/store'
import { DEMO as SNAPSHOT } from '../landing/demoSnapshot'

// The shell every page outside the workspace shares: the form on the surface,
// and beside it a quiet brand panel on the canvas carrying the line and one
// real proof element. One column on mobile, with the proof below the form.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  asideBody,
  aside,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  asideBody: string
  aside: ReactNode
}) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
      <aside className="hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:border-r lg:border-line lg:px-12 lg:py-14">
        <div className="w-full max-w-[30rem]">
          <Link to="/" className="inline-flex w-fit rounded-sm">
            <Logo />
          </Link>
          <p className="mt-10 text-h1 text-balance text-ink">{BRAND.tagline}</p>
          <p className="mt-4 max-w-[58ch] text-body text-ink-3">{asideBody}</p>
          <div className="mt-10">{aside}</div>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col bg-surface lg:min-h-0">
        <div className="border-b border-line-soft px-5 py-4 sm:px-8 lg:hidden">
          <Link to="/" className="inline-flex w-fit rounded-sm">
            <Logo />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 sm:py-14">
          <div className="w-full max-w-sm">
            <h1 className="text-h1 text-balance text-ink">{title}</h1>
            {subtitle && <p className="mt-2.5 text-body text-ink-3">{subtitle}</p>}
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-6 text-small text-ink-3">{footer}</div>}
            {!supabaseConfigured && (
              <p className="mt-8 border-t border-line-soft pt-5 text-caption text-ink-3">
                Running in local mode: accounts and data are stored in this browser only.
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-line bg-canvas px-5 py-9 sm:px-8 lg:hidden">
          <p className="text-h2 text-balance text-ink">{BRAND.tagline}</p>
          <div className="mt-5">{aside}</div>
        </div>
      </main>
    </div>
  )
}

// The demo MSP's own figures, from the engine-generated snapshot the landing
// page uses (its test fails if they drift from the analysis).
const DEMO = { total: SNAPSHOT.totals.identified, billed: SNAPSHOT.totals.billed, opportunities: SNAPSHOT.totals.findings, period: SNAPSHOT.period.label }

// One real proof element: the signature GapBar on the demo MSP.
export function DemoProof() {
  return (
    <div>
      <figure className="rounded-lg border border-line bg-surface p-5">
        <figcaption className="text-caption text-ink-3">Demo MSP, {DEMO.period}</figcaption>
        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <Figure tone="accent">{money(DEMO.total)}</Figure>
          <span className="tnum text-small text-ink-2">potential leakage across {DEMO.opportunities} opportunities</span>
        </div>
        <GapBar billed={DEMO.billed} gap={DEMO.total} height={14} className="mt-6" />
      </figure>
      <Disclaimer className="mt-4 max-w-[62ch]" />
    </div>
  )
}

// The landing page's four steps, so the promise and the product use the same words.
const NEXT = [
  { icon: ICONS.data, title: 'Upload your PSA exports', body: 'CSV exports from your PSA, RMM and billing system, plus contract PDFs.' },
  { icon: ICONS.findings, title: 'We analyse it', body: 'Every ticket, time entry, device and billing line is checked against the agreement.' },
  { icon: ICONS.leakage, title: 'Find the leakage', body: 'Each opportunity carries its evidence, its calculation and a confidence level.' },
  { icon: ICONS.actions, title: 'Take action', body: 'Work through each one from New to Actioned: correct the agreement, bill the work or reprice the client.' },
]

// What happens after the workspace exists. A sequence, not a card grid.
export function NextSteps() {
  return (
    <ol className="divide-y divide-line-soft rounded-lg border border-line bg-surface">
      {NEXT.map((s) => (
        <li key={s.title} className="flex gap-3.5 px-5 py-4">
          <s.icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          <div className="min-w-0">
            <p className="text-h3 text-ink">{s.title}</p>
            <p className="mt-1 text-small text-ink-3">{s.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

// Form-level errors: name the problem, stay small.
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-small text-danger">
      <ICONS.alerts className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}
