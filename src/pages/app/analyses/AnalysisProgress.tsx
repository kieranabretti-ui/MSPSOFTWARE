import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import type { AnalysisSummary } from '../../../engine/types'
import { useStore, type AnalysisStage } from '../../../data/store'
import { Button, cx } from '../../../components/ui'
import { mapError } from '../../../lib/errors'
import { plural } from '../../../lib/format'
import { Callout } from '../data/kit'

// How long each step stays on screen at the least, so a phase that finishes in
// a few milliseconds still reads. Never longer: the steps report real work.
export const STEP_DWELL = 250

// Moves a shown count up to the reported count one step at a time, holding
// each step for at least `dwell` ms since it became current. A step that has
// already been on screen that long ticks the moment its phase reports.
export function usePacedCount(target: number, dwell = STEP_DWELL) {
  const [shown, setShown] = useState(0)
  const since = useRef(0)
  useEffect(() => {
    if (!since.current) since.current = performance.now()
    if (shown >= target) return
    const wait = Math.max(0, dwell - (performance.now() - since.current))
    const t = setTimeout(() => {
      since.current = performance.now()
      setShown((s) => Math.min(s + 1, target))
    }, wait)
    return () => clearTimeout(t)
  }, [shown, target, dwell])
  return shown
}

// One line in a run: what is happening, then what happened.
export interface RunStep {
  running: string
  done: string
  sub?: string
}

// A list of real phases: a tick once a phase has finished, a spinner on the
// current one, a ring on those still to come. The words carry the state, so
// the marks never have to (and the spinner stops for reduced motion).
export function RunSteps({ steps, shown, failed }: { steps: RunStep[]; shown: number; failed?: boolean }) {
  return (
    <ol className="space-y-3.5">
      {steps.map((s, i) => {
        const done = i < shown
        const current = i === shown && !failed
        return (
          <li key={s.done} aria-current={current ? 'step' : undefined} className="flex items-start gap-3">
            <span className="flex h-5 w-4 shrink-0 items-center justify-center" aria-hidden>
              {done ? (
                <Check className="size-4 text-ink-2" />
              ) : current ? (
                <Loader2 className="size-4 text-accent motion-safe:animate-spin" />
              ) : (
                <span className="size-3 rounded-full border border-line-strong" />
              )}
            </span>
            <span className="min-w-0">
              <span className={cx('tnum block text-body', done ? 'text-ink-2' : current ? 'font-medium text-ink' : 'text-ink-3')}>
                {done ? s.done : s.running}
                <span className="sr-only">{done ? ' (done)' : current ? ' (in progress)' : ' (to do)'}</span>
              </span>
              {done && s.sub && <span className="mt-0.5 block text-small text-ink-3">{s.sub}</span>}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const joinList = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

// Steps finished by the time each phase is reported. Reading covers the data
// and the contract match; one engine call covers the checks and profitability.
const FINISHED: Record<AnalysisStage, number> = { reading: 0, checking: 2, saving: 4, done: 5 }

type Source = 'manual' | 'first_run' | 'settings'

// The analysis as it runs, step by step, with the real counts from the
// workspace. Ends by handing the summary to onDone; the caller shows the result.
export function AnalysisProgress({ source, onDone, onCancel }: { source: Source; onDone: (summary: AnalysisSummary) => void; onCancel?: () => void }) {
  const [attempt, setAttempt] = useState(0)
  return <Run key={attempt} source={source} onDone={onDone} onCancel={onCancel} onRetry={() => setAttempt((n) => n + 1)} />
}

function Run({ source, onDone, onCancel, onRetry }: { source: Source; onDone: (summary: AnalysisSummary) => void; onCancel?: () => void; onRetry: () => void }) {
  const { data, runAnalysis } = useStore()
  const [finished, setFinished] = useState(0)
  const [summary, setSummary] = useState<AnalysisSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shown = usePacedCount(finished)
  const started = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })

  // The counts as they were when the run began.
  const [steps] = useState<RunStep[]>(() => {
    const read = [
      [data.clients.length, 'client'],
      [data.tickets.length, 'ticket'],
      [data.time_entries.length, 'time entry', 'time entries'],
      [data.assets.length, 'user or device', 'users and devices'],
      [data.billing_items.length, 'billing line'],
    ] as const
    const what = joinList(read.filter(([n]) => n > 0).map(([n, one, many]) => plural(n, one, many)))
    const ids = new Set(data.clients.map((c) => c.id))
    const n = data.clients.length
    const x = new Set(data.contracts.map((c) => c.client_id).filter((id) => ids.has(id))).size
    return [
      { running: `Reading ${what}`, done: `Read ${what}` },
      x === 0
        ? { running: 'Matching contracts to clients', done: `No contracts found for your ${plural(n, 'client')}`, sub: "Out-of-scope work can't be checked until you upload them." }
        : {
            running: 'Matching contracts to clients',
            done: `Found contracts for ${x} of ${plural(n, 'client')}`,
            sub: x < n ? `Out-of-scope work can't be checked for the other ${n - x}.` : undefined,
          },
      { running: 'Checking every ticket, time entry, user, device and charge against the agreements', done: 'Checked every ticket, time entry, user, device and charge against the agreements' },
      { running: 'Calculating client profitability', done: 'Calculated client profitability' },
      { running: 'Saving the results', done: 'Saved the results' },
    ]
  })

  useEffect(() => {
    if (started.current) return
    started.current = true
    // The button that started the run has gone; keep focus with the run.
    heading.current?.focus({ preventScroll: true })
    runAnalysis({ source, onStage: (s) => setFinished((f) => Math.max(f, FINISHED[s])) })
      .then((s) => {
        setFinished(FINISHED.done)
        setSummary(s)
      })
      .catch((e) => setError(mapError(e, 'analysis')))
  }, [runAnalysis, source])

  // Hand over once the last tick has had its moment on screen.
  const complete = summary != null && shown >= steps.length
  useEffect(() => {
    if (!complete || !summary) return
    const t = setTimeout(() => done.current(summary), STEP_DWELL)
    return () => clearTimeout(t)
  }, [complete, summary])

  return (
    <section aria-labelledby="run-title" className="rounded-lg border border-line bg-surface px-5 py-5 sm:px-6">
      <h2 ref={heading} id="run-title" tabIndex={-1} className="text-h3 text-ink focus:outline-none">
        {error ? 'The analysis stopped' : complete ? 'Analysis finished' : 'Running the analysis'}
      </h2>
      <div className="mt-4" role="status" aria-live="polite">
        <RunSteps steps={steps} shown={shown} failed={!!error} />
      </div>
      {error && (
        <div className="mt-5 space-y-3">
          <Callout tone="danger" alert>
            {error}
          </Callout>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={onRetry}>
              Try again
            </Button>
            {onCancel && (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Back
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
