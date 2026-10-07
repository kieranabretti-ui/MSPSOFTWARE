import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore, type DemoStage } from '../data/store'
import { Button, ButtonLink, Logo } from '../components/ui'
import { mapError } from '../lib/errors'
import { RunSteps, STEP_DWELL, usePacedCount, type RunStep } from './app/analyses/AnalysisProgress'
import { FormError } from './auth/AuthShell'

// What the demo run actually does, in order, as startDemo reports each phase.
const STAGES: RunStep[] = [
  { running: 'Generating Northlight IT, the demo MSP', done: 'Generated Northlight IT, the demo MSP' },
  { running: 'Checking every ticket, time entry, device and charge against the agreements', done: 'Checked every ticket, time entry, device and charge against the agreements' },
  { running: 'Opening the workspace', done: 'Opened the workspace' },
]
// Stages finished by the time each phase is reported.
const FINISHED: Record<DemoStage, number> = { generating: 0, checking: 1, opening: 2 }

// One click from the landing page into a fully populated sandbox.
export default function Demo() {
  const { startDemo } = useStore()
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [finished, setFinished] = useState(0)
  const [ready, setReady] = useState(false)
  const shown = usePacedCount(finished)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    startDemo({ onStage: (s) => setFinished((f) => Math.max(f, FINISHED[s])) })
      .then(() => {
        setFinished(STAGES.length)
        setReady(true)
      })
      .catch((e) => setError(mapError(e, 'demo')))
  }, [startDemo])

  // Open the workspace once the last step has had its moment on screen.
  useEffect(() => {
    if (!ready || shown < STAGES.length) return
    const t = setTimeout(() => nav('/app', { replace: true }), STEP_DWELL)
    return () => clearTimeout(t)
  }, [ready, shown, nav])

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="border-b border-line-soft">
        <div className="mx-auto w-full max-w-6xl px-5 py-4 sm:px-8">
          <Link to="/" className="inline-flex w-fit rounded-sm">
            <Logo />
          </Link>
        </div>
      </div>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <section className="w-full max-w-md rounded-xl border border-line bg-surface p-6 sm:p-8">
          {error ? (
            <>
              <h1 className="text-h1 text-ink">The demo did not load</h1>
              <p className="mt-2.5 text-body text-ink-3">Nothing was saved. Running it again usually clears this.</p>
              <div className="mt-6">
                <FormError>{error}</FormError>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={() => location.reload()}>Run it again</Button>
                <ButtonLink to="/" variant="secondary">
                  Back to Headroom
                </ButtonLink>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-h1 text-ink">Running the demo analysis</h1>
              <p className="mt-2.5 text-body text-ink-3">
                Northlight IT is a fictional MSP with 15 clients and six months of tickets, time entries, devices and contracts.
              </p>

              <div className="mt-7 border-t border-line-soft pt-6" role="status" aria-live="polite">
                <RunSteps steps={STAGES} shown={shown} />
              </div>

              <p className="mt-7 border-t border-line-soft pt-5 text-caption text-ink-3">
                Nothing is uploaded. The demo runs in this browser and you can clear it at any time.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  )
}
