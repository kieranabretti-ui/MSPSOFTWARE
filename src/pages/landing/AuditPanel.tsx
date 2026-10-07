import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Loader2 } from 'lucide-react'
import { Badge, Figure, cx } from '../../components/ui'
import { GAP_SHARE_NOTE, GapBar } from '../../components/bars'
import { ConfidenceLevel } from '../../components/ConfidenceLevel'
import { money, plural } from '../../lib/format'
import { CATEGORY_META } from '../../lib/labels'
import { track } from '../../lib/track'
import { DEMO } from './demoSnapshot'

// The hero's audit panel: the real dashboard components showing the demo MSP's
// real figures. On first view it replays the analysis once, in just over a
// second: the total counts up from £0, the GapBar opens across what was
// billed, and the next opportunities land in the ledger under the first. The
// stats and the first row are there from the start, the final values are
// always in the DOM (the running count is drawn by a pseudo-element), and
// nothing moves for anyone who prefers reduced motion.

const RUN_MS = 1200
const LEDGER_ROWS = 4
const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x))
// The count reads as counting: a gentler quartic ease-out so the figure is still climbing as the findings land.
const quartOut = (x: number) => 1 - Math.pow(1 - x, 4)

type Phase = 'final' | 'armed' | 'running'

function useAuditRun() {
  const ref = useRef<HTMLElement>(null)
  const [phase, setPhase] = useState<Phase>('final')
  const [t, setT] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined' || typeof window.matchMedia !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    setPhase('armed')
    const run = () => {
      let start = 0
      setPhase('running')
      const tick = (now: number) => {
        start ||= now
        const elapsed = now - start
        if (elapsed >= RUN_MS) {
          setPhase('final')
          return
        }
        setT(elapsed)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          run()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  // Eased progress of a step on the run's timeline, 0 to 1.
  const at = (start: number, duration: number, ease = expoOut) => (phase === 'final' ? 1 : phase === 'armed' ? 0 : ease(Math.min(1, Math.max(0, (t - start) / duration))))
  return { ref, phase, t, at }
}

// Arrives: fades up a few pixels. Opacity and transform only, so it stays on the compositor.
const arrive = (p: number): CSSProperties | undefined => (p >= 1 ? undefined : { opacity: p, transform: `translateY(${(1 - p) * 6}px)` })

// The final figure stays in the DOM; while counting, it is transparent and the
// running value is painted over it from a data attribute.
function Counting({ value, shown, live }: { value: string; shown: string; live: boolean }) {
  if (!live) return <>{value}</>
  return (
    <span className="relative inline-block">
      <span className="text-transparent">{value}</span>
      <span aria-hidden data-n={shown} className="absolute inset-y-0 left-0 whitespace-nowrap after:content-[attr(data-n)]" />
    </span>
  )
}

function Stat({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-start border-line-soft px-4 py-4 not-last:border-r sm:px-6 md:justify-center md:not-last:border-r-0 md:not-last:border-b">
      <dt className="text-caption text-ink-3 sm:text-small sm:text-ink-2">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
      {sub && <dd className="tnum mt-1 text-caption text-ink-3">{sub}</dd>}
    </div>
  )
}

export function AuditPanel() {
  const { ref, phase, t, at } = useAuditRun()
  const { totals, period } = DEMO
  const live = phase !== 'final'
  const count = at(0, 1050, quartOut)
  const bar = at(0, 900)
  const rows = DEMO.topFindings.slice(0, LEDGER_ROWS)
  // The first row is there from the start; the rest land one after another.
  const landAt = (i: number) => (i === 0 ? -1 : 150 + i * 200)
  const share = ((totals.identified / (totals.billed + totals.identified)) * 100).toFixed(1)

  return (
    <section ref={ref} aria-label={`Demo audit of ${DEMO.msp}, a fictional MSP`} className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-line-soft px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <p className="text-h3 text-ink">{DEMO.msp}</p>
          <Badge>Demo MSP</Badge>
        </div>
        <p className="tnum flex items-center gap-1.5 text-caption text-ink-3">
          {live ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Check className="size-3.5" aria-hidden />}
          {live ? 'Replaying the demo analysis' : `Analysis complete · ${period.label}`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_13.5rem]">
        <div className="flex flex-col justify-between gap-6 px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
          <div>
            <p className="text-small font-medium text-ink-2">Potential revenue leakage identified</p>
            <div className="mt-2">
              <Figure size="xl">
                <Counting value={money(totals.identified)} shown={money(Math.round(totals.identified * count))} live={live} />
              </Figure>
            </div>
            <p className="tnum mt-2.5 text-small text-ink-3">
              Across {plural(totals.findings, 'opportunity', 'opportunities')} at {totals.clients} clients over {period.months} months.
            </p>
          </div>
          <div>
            <div style={bar < 1 ? { clipPath: `inset(0 ${(1 - bar) * 100}% 0 0)` } : undefined}>
              <GapBar billed={totals.billed} gap={totals.identified} height={16} label={false} />
            </div>
            <div className="tnum mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-caption" style={arrive(at(650, 400))}>
              <span className="text-ink-3">
                Billed over {period.months} months <span className="text-ink-2">{money(totals.billed)}</span>
              </span>
              <span className="text-ink-3">
                Potential leakage <span className="font-semibold text-accent">{money(totals.identified)}</span>
                <span className="ml-1.5" title={GAP_SHARE_NOTE}>
                  · {share}%<span className="sr-only"> of billed plus potential leakage</span>
                </span>
              </span>
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-3 border-t border-line-soft md:grid-cols-1 md:border-l md:border-t-0">
          <Stat label="Opportunities">
            <Figure>{totals.findings}</Figure>
          </Stat>
          <Stat label="Clients at risk" sub={`of ${totals.clients}`}>
            <Figure>{totals.atRisk}</Figure>
          </Stat>
          <Stat label="Recurring" sub={`a month · ${money(totals.annual)} a year`}>
            <Figure tone="accent">{money(totals.monthly)}</Figure>
          </Stat>
        </dl>
      </div>

      <div className="border-t border-line-soft">
        <div className="flex items-baseline justify-between gap-4 px-4 pb-1.5 pt-3.5 sm:px-6">
          <p className="text-small font-medium text-ink-2">Highest-value opportunities</p>
          <p className="text-caption text-ink-3">Potential value</p>
        </div>
        <ol aria-label="Highest-value opportunities">
          {rows.map((f, i) => {
            const fresh = phase === 'running' && i > 0 && t >= landAt(i) && t < landAt(i) + 700
            return (
              <li
                key={f.title + f.client}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-t border-line-soft px-4 py-2.5 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_5.5rem_4.5rem] sm:px-6"
                style={i === 0 ? undefined : arrive(at(landAt(i), 400))}
              >
                <div className="min-w-0">
                  <p className="line-clamp-2 text-small font-medium text-ink">{f.title}</p>
                  <p className="truncate text-caption text-ink-3">
                    {f.client} · {CATEGORY_META[f.category].short}
                  </p>
                  {/* Disclosed, not netted: the same money as the client's agreement gaps. */}
                  {f.overlaps && <p className="text-caption text-ink-2">Overlaps with {f.client}'s agreement gaps. Don't count both.</p>}
                </div>
                <span className="hidden sm:block">
                  <ConfidenceLevel level={f.level} short />
                </span>
                <span className={cx('tnum text-right text-small font-semibold transition-colors duration-700', fresh ? 'text-accent' : 'text-ink')}>{money(f.value)}</span>
              </li>
            )
          })}
        </ol>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line-soft bg-sunken px-4 py-3 sm:px-6">
          <p className="tnum max-w-[72ch] text-caption text-ink-3">
            {plural(totals.findings - LEDGER_ROWS, 'more opportunity', 'more opportunities')}. Fictional MSP, real engine: every figure comes from running Headroom on demo data. Potential, never promised.
          </p>
          <Link
            to="/demo"
            onClick={() => track('cta_click', { location: 'audit_panel', label: 'Explore the demo', to: '/demo' })}
            className="group inline-flex items-center gap-1 rounded-sm text-small font-medium text-ink-2 transition-colors hover:text-ink"
          >
            Explore the demo
            <ArrowRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  )
}
