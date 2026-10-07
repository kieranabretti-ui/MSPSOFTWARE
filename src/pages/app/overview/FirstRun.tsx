import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Play, Upload } from 'lucide-react'
import type { AnalysisSummary } from '../../../engine/types'
import { useStore } from '../../../data/store'
import { Button, ButtonLink, TextLink } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { ICONS } from '../../../brand/icons'
import { mapError } from '../../../lib/errors'
import { num } from '../../../lib/format'
import { AnalysisProgress } from '../analyses/AnalysisProgress'
import { AnalysisResult } from '../analyses/AnalysisResult'

// What each export lets the engine find. Copy follows PRODUCT.md: only the
// checks the rules engine actually runs.
const SOURCES = [
  { icon: ICONS.tickets, name: 'Tickets and time entries', finds: 'Out-of-scope work done for free, billable time never invoiced, support beyond allowances' },
  { icon: ICONS.clients, name: 'Clients, users and devices', finds: 'Clients who have grown past their agreement, licences assigned but never billed' },
  { icon: ICONS.billing, name: 'Billing lines', finds: 'Recurring charges below the agreement, clients priced under your target margin' },
  { icon: ICONS.contracts, name: 'Contracts and SOWs', finds: 'What each agreement covers, so out-of-scope opportunities cite the clause behind them' },
]

// The first-run state for a workspace with no analysis yet. Also shown by the
// Opportunities and Reports pages, so it stands on its own without page
// context. With data loaded, the run happens here: its progress, then its
// result. onRunChange tells a parent that wants the result kept on screen
// (the Overview) when a run starts and when the reader moves on.
export function GetStarted({ onRunChange }: { onRunChange?: (active: boolean) => void }) {
  const { loadDemoData, data } = useStore()
  const toast = useToast()
  const nav = useNavigate()
  const [loading, setLoading] = useState(false)
  const [run, setRun] = useState<'running' | AnalysisSummary | null>(null)
  const hasData = data.tickets.length + data.clients.length > 0

  const loadDemo = async () => {
    setLoading(true)
    try {
      await loadDemoData()
      toast('Demo MSP loaded and analysed.')
      nav('/app')
    } catch (e) {
      toast(mapError(e, 'demo'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const start = () => {
    onRunChange?.(true)
    setRun('running')
  }
  const finish = () => {
    setRun(null)
    onRunChange?.(false)
  }

  if (run === 'running') return <AnalysisProgress source="first_run" onDone={setRun} onCancel={finish} />
  if (run) return <AnalysisResult summary={run} onViewOverview={finish} />

  const loaded = [
    { label: 'Clients', n: data.clients.length },
    { label: 'Tickets', n: data.tickets.length },
    { label: 'Time entries', n: data.time_entries.length },
    { label: 'Users and devices', n: data.assets.length },
    { label: 'Billing lines', n: data.billing_items.length },
    { label: 'Contracts', n: data.contracts.length },
  ]

  return (
    <section className="overflow-hidden rounded-xl border border-line bg-surface" aria-labelledby="first-run-title">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14">
          <h2 id="first-run-title" className="max-w-[24ch] text-h2 text-balance text-ink sm:text-h1">
            {hasData ? 'Your data is ready to analyse' : 'Find out where your MSP is losing money'}
          </h2>
          <p className="mt-4 max-w-[52ch] text-body text-ink-2">
            {hasData
              ? 'Run the analysis to check every ticket, time entry, device and billing line against your agreements. It takes a few seconds, and every pound links back to its evidence.'
              : "Upload the exports your PSA, RMM and billing system already produce. Headroom checks every ticket, device and invoice line against each client's agreement figures and, where you upload them, its contract, then shows what you could be charging for."}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            {hasData ? (
              <>
                <Button variant="accent" size="lg" onClick={start} disabled={!data.clients.length}>
                  <Play className="size-4" aria-hidden /> Run analysis
                </Button>
                <TextLink to="/app/analyses">Add more data</TextLink>
              </>
            ) : (
              <>
                <ButtonLink to="/app/analyses" variant="accent" size="lg">
                  <Upload className="size-4" aria-hidden /> Upload your data
                </ButtonLink>
                <Button variant="secondary" size="lg" onClick={loadDemo} loading={loading}>
                  {!loading && <FlaskConical className="size-4" aria-hidden />} Load demo data
                </Button>
              </>
            )}
          </div>
          <p className="mt-4 text-caption text-ink-3">
            {hasData ? 'You can add more exports at any time and run it again.' : 'CSV exports and contract PDFs. The demo is Northlight IT, a fictional MSP with 15 clients.'}
          </p>
        </div>

        <div className="border-t border-line-soft bg-sunken px-6 py-8 sm:px-10 lg:border-l lg:border-t-0 lg:py-10">
          {hasData ? (
            <>
              <h3 className="text-h3 text-ink">Loaded so far</h3>
              <dl className="mt-4 divide-y divide-line-soft border-y border-line-soft">
                {loaded.map((r) => (
                  <div key={r.label} className="flex items-baseline justify-between gap-4 py-2.5 text-small">
                    <dt className={r.n ? 'text-ink-2' : 'text-ink-3'}>{r.label}</dt>
                    <dd className={r.n ? 'tnum font-semibold text-ink' : 'tnum text-ink-3'}>{r.n ? num(r.n) : 'None yet'}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <>
              <h3 className="text-h3 text-ink">What Headroom checks</h3>
              <ul className="mt-4 divide-y divide-line-soft border-y border-line-soft">
                {SOURCES.map((s) => (
                  <li key={s.name} className="flex gap-3 py-3.5">
                    <s.icon className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-small font-medium text-ink">{s.name}</p>
                      <p className="mt-0.5 text-caption text-ink-3">{s.finds}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
