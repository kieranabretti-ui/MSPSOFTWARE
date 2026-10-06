import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Loader2 } from 'lucide-react'
import { useStore } from '../data/store'
import { Button, ButtonLink, Logo, cx } from '../components/ui'
import { FormError } from './auth/AuthShell'

// What the demo run actually does, in order.
const STAGES = [
  'Generating Northlight IT, the demo MSP',
  'Reading tickets, time entries, devices and contracts',
  'Checking every line against the agreements',
  'Opening the workspace',
]

// One click from the landing page into a fully populated sandbox.
export default function Demo() {
  const { startDemo } = useStore()
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [stage, setStage] = useState(0)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    startDemo()
      .then(() => nav('/app', { replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the demo.'))
  }, [startDemo, nav])

  // The run is one blocking call, so the stages pace themselves and hold on the
  // last one until the workspace opens.
  useEffect(() => {
    if (error) return
    const t = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 1100)
    return () => clearInterval(t)
  }, [error])

  const pct = Math.round(((stage + 1) / (STAGES.length + 1)) * 100)

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <div className="border-b border-line-soft px-5 py-4 sm:px-8">
        <Link to="/" className="inline-flex w-fit rounded-sm">
          <Logo />
        </Link>
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

              <div
                className="mt-7 h-1 overflow-hidden rounded-full bg-line"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Demo analysis progress"
              >
                <div className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out-brand" style={{ width: `${pct}%` }} />
              </div>

              <ol className="mt-6 space-y-3">
                {STAGES.map((s, i) => (
                  <li
                    key={s}
                    aria-current={i === stage ? 'step' : undefined}
                    className={cx('flex items-start gap-2.5 text-small', i < stage ? 'text-ink-3' : i === stage ? 'text-ink' : 'text-ink-4')}
                  >
                    <span className="flex size-4 shrink-0 items-center justify-center pt-0.5">
                      {i < stage ? (
                        <Check className="size-3.5" aria-hidden />
                      ) : i === stage ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <span className="size-1.5 rounded-full bg-line-strong" aria-hidden />
                      )}
                    </span>
                    {s}
                  </li>
                ))}
              </ol>

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
