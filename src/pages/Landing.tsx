import { Link } from 'react-router-dom'
import { ArrowRight, Check, FileSpreadsheet, FileText, Quote, ShieldCheck, Ticket, TrendingDown, Users } from 'lucide-react'
import { ButtonLink, Logo, SeverityBadge, cx } from '../components/ui'
import { useStore } from '../data/store'

const LEAKS = [
  { title: 'Out-of-scope work', body: 'Personal devices, hardware repairs, onsite visits and project work your agreement excludes, delivered for free.' },
  { title: 'Unbilled time', body: 'Time logged as non-billable on work that looks billable, or billable tickets with non-billable time entries.' },
  { title: 'Agreement drift', body: 'Clients who added users and devices since the contract was signed, still billed at the old count.' },
  { title: 'Underpriced clients', body: 'High-effort clients whose support hours have quietly eaten the margin on their agreement.' },
]

const PLANS = [
  { name: 'Starter', price: 99, blurb: 'For MSPs up to 25 clients', features: ['Unlimited uploads and analyses', 'Out-of-scope and unbilled work detection', 'Agreement drift checks', 'PDF and CSV reports'] },
  { name: 'Growth', price: 249, blurb: 'For MSPs up to 100 clients', features: ['Everything in Starter', 'Client profitability', 'AI-assisted contract review', 'Actions and recovery tracking'], featured: true },
  { name: 'Scale', price: 499, blurb: 'For larger and multi-brand MSPs', features: ['Everything in Growth', 'Unlimited clients', 'PSA integrations as they launch', 'Priority support'] },
]

function ExampleFinding() {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(0,0,0,0.12)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-zinc-500">Bramley Homes · Ticket #18492</p>
          <p className="mt-1 font-semibold">Personal device supported free of charge</p>
        </div>
        <SeverityBadge severity="HIGH" />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-y border-zinc-100 py-4">
        <div>
          <p className="text-xs text-zinc-500">Potential value</p>
          <p className="tnum text-xl font-semibold">£80</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Time spent</p>
          <p className="tnum text-xl font-semibold">1h 20m</p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Confidence</p>
          <p className="tnum text-xl font-semibold">94%</p>
        </div>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">Why we flagged this</p>
      <div className="mt-2 space-y-2 text-sm">
        <p className="flex gap-2 rounded-lg border-l-2 border-zinc-900 bg-zinc-50 px-3 py-2">
          <Quote className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
          <span>
            <span className="font-medium">Contract states:</span> “Support applies to <mark className="rounded bg-orange-100 px-0.5">company-owned devices only</mark>.”
          </span>
        </p>
        <p className="flex gap-2 rounded-lg border-l-2 border-orange-400 bg-orange-50/50 px-3 py-2">
          <Quote className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
          <span>
            <span className="font-medium">Ticket states:</span> “Set up <mark className="rounded bg-orange-100 px-0.5">employee's personal MacBook</mark>.”
          </span>
        </p>
      </div>
      <p className="mt-4 text-[11px] text-zinc-400">Example from the built-in demo MSP</p>
    </div>
  )
}

export default function Landing() {
  const { user, workspace } = useStore()
  return (
    <div className="bg-white text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-zinc-600 md:flex">
            <a href="#how" className="hover:text-zinc-900">How it works</a>
            <a href="#findings" className="hover:text-zinc-900">Findings</a>
            <a href="#pricing" className="hover:text-zinc-900">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            {user && workspace ? (
              <ButtonLink to="/app" size="sm">Open dashboard</ButtonLink>
            ) : (
              <>
                <Link to="/login" className="hidden px-3 text-sm font-medium text-zinc-600 hover:text-zinc-900 sm:block">Sign in</Link>
                <ButtonLink to="/signup" size="sm">Start free audit</ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_50%_at_70%_0%,rgba(249,115,22,0.08),transparent)]" />
        <div className="relative mx-auto grid grid-cols-1 max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-28 lg:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
              <span className="size-1.5 rounded-full bg-orange-500" /> Revenue protection for managed service providers
            </p>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">How much money is your MSP giving away?</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-600">
              MSP Leak analyses your tickets, contracts and billing data to uncover out-of-scope work, unbilled time, agreement drift and underpriced clients.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink to="/signup" size="lg">
                Run a Free Revenue Audit <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink to="/demo" size="lg" variant="secondary">
                View Demo
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-zinc-500">Works from CSV and PDF exports. No PSA integration required.</p>
          </div>
          <ExampleFinding />
        </div>
      </section>

      {/* problem */}
      <section className="border-t border-zinc-100 bg-zinc-50/70 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-orange-600">The problem</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Your MSP is probably leaking revenue</h2>
            <p className="mt-4 text-lg text-zinc-600">
              Agreements are signed once, but clients change every month. New starters arrive, devices multiply, and engineers help with “just a quick favour” that was never in scope. None of it shows up on an invoice, and nobody has time to cross-check thousands of tickets against dozens of contracts.
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {LEAKS.map((l) => (
              <div key={l.title} className="rounded-xl border border-zinc-200 bg-white p-5">
                <TrendingDown className="size-5 text-orange-500" />
                <h3 className="mt-4 font-semibold">{l.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{l.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how */}
      <section id="how" className="py-20 sm:py-28">
        <div className="mx-auto grid grid-cols-1 max-w-6xl gap-16 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-orange-600">Step 1</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Upload your existing data</h2>
            <p className="mt-4 text-zinc-600">Export what you already have from your PSA, RMM and billing system. Map your columns once and MSP Leak does the rest. No integration, no agent, no admin access.</p>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                [FileSpreadsheet, 'Clients, tickets, time entries, users & devices and billing as CSV'],
                [FileText, 'Contracts, SOWs and service agreements as PDF'],
                [ShieldCheck, 'Data is isolated to your workspace and never shared'],
              ].map(([Icon, t]) => {
                const I = Icon as typeof FileText
                return (
                  <li key={t as string} className="flex items-start gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white">
                      <I className="size-4 text-zinc-600" />
                    </span>
                    <span className="pt-1.5 text-zinc-700">{t as string}</span>
                  </li>
                )
              })}
            </ul>
          </div>
          <div id="findings">
            <p className="text-sm font-semibold text-orange-600">Step 2</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">See exactly where money is disappearing</h2>
            <p className="mt-4 text-zinc-600">Every finding shows the value, how confident we are, and the exact ticket text and contract clause behind it. Nothing is a black box.</p>
            <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200">
              {[
                ['ABC Ltd', '4 more users than contracted', 'Agreement drift', '£72/mo'],
                ['Kingsbridge Architects', 'Third-party application support given free', 'Out of scope', '£150'],
                ['Castle Accountancy', 'Gross margin 28% against a 30% target', 'Underpriced', '£229'],
                ['Harbour Physio', 'Support usage above the 10h monthly allowance', 'Over allowance', '£355'],
              ].map(([c, t, k, v], i) => (
                <div key={t} className={cx('flex items-center gap-4 bg-white px-4 py-3', i > 0 && 'border-t border-zinc-100')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t}</p>
                    <p className="text-xs text-zinc-500">
                      {c} · {k}
                    </p>
                  </div>
                  <span className="tnum text-sm font-semibold">{v}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-400">Examples from the built-in demo MSP</p>
          </div>
        </div>
      </section>

      {/* actions */}
      <section className="border-y border-zinc-100 bg-zinc-950 py-20 text-white sm:py-28">
        <div className="mx-auto grid grid-cols-1 max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-orange-400">Step 3</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Turn leakage into revenue</h2>
            <p className="mt-4 text-zinc-400">Each finding comes with a recommended action. Confirm it, assign it, and track it through to an updated agreement or invoice. Then share a report your management team can act on.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/demo" variant="secondary">View the demo</ButtonLink>
            </div>
          </div>
          <div className="space-y-3">
            {[
              ['Review contract and update recurring charge to 39 users', 'ABC Ltd', 'In progress'],
              ['Bill onsite visit at the standard rate', 'Pennine Engineering', 'Open'],
              ['Move client to a tier with more included hours', 'Harbour Physio', 'Open'],
            ].map(([a, c, s]) => (
              <div key={a} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <Check className="size-4 shrink-0 text-orange-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{a}</p>
                  <p className="text-xs text-zinc-500">{c}</p>
                </div>
                <span className="rounded-md bg-white/10 px-2 py-0.5 text-xs text-zinc-300">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* built for MSPs */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <h2 className="text-3xl font-semibold tracking-tight">Built for MSPs</h2>
              <p className="mt-4 text-zinc-600">MSP Leak does one job: answer “where is my MSP losing money?” It isn't a PSA, an RMM or a chatbot.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
              {[
                [Ticket, 'Speaks your language', 'Agreements, additions, block hours, MRR, per-user and per-device pricing.'],
                [ShieldCheck, 'Evidence first', 'Deterministic rules find the leakage. AI only explains, and always cites the source.'],
                [Users, 'Client profitability', 'Margin, effort and revenue per technician hour for every client.'],
                [FileSpreadsheet, 'PSA integrations coming', 'Direct connections to popular PSA, RMM and accounting tools are on the roadmap. Exports work today.'],
              ].map(([Icon, t, b]) => {
                const I = Icon as typeof Ticket
                return (
                  <div key={t as string} className="rounded-xl border border-zinc-200 p-5">
                    <I className="size-5 text-zinc-700" />
                    <h3 className="mt-3 font-semibold">{t as string}</h3>
                    <p className="mt-1.5 text-sm text-zinc-600">{b as string}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* pricing */}
      <section id="pricing" className="border-t border-zinc-100 bg-zinc-50/70 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing</h2>
            <p className="mt-3 text-zinc-600">Planned pricing for launch. Your first revenue audit is free.</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {PLANS.map((p) => (
              <div key={p.name} className={cx('flex flex-col rounded-2xl border bg-white p-6', p.featured ? 'border-zinc-900 shadow-lg' : 'border-zinc-200')}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.featured && <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-xs font-medium text-white">Most popular</span>}
                </div>
                <p className="mt-1 text-sm text-zinc-500">{p.blurb}</p>
                <p className="mt-6">
                  <span className="tnum text-4xl font-semibold tracking-tight">£{p.price}</span>
                  <span className="text-sm text-zinc-500">/month</span>
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-zinc-900" /> {f}
                    </li>
                  ))}
                </ul>
                <ButtonLink to="/signup" variant={p.featured ? 'primary' : 'secondary'} className="mt-8 w-full">
                  Start with a free audit
                </ButtonLink>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Find the work your MSP is doing for free.</h2>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink to="/signup" size="lg">
              Run a Free Revenue Audit <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink to="/demo" size="lg" variant="secondary">
              View Demo
            </ButtonLink>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-100 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-zinc-500 sm:flex-row sm:px-6">
          <Logo className="text-sm" />
          <p>Figures shown are potential opportunities, not guaranteed recovered revenue.</p>
        </div>
      </footer>
    </div>
  )
}
