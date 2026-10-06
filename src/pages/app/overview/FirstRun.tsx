import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, Play, Upload } from 'lucide-react'
import { useStore } from '../../../data/store'
import { Button, ButtonLink } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { ICONS } from '../../../brand/icons'
import { num } from '../../../lib/format'

// What each export lets the engine find. Copy follows PRODUCT.md: only the
// checks the rules engine actually runs.
const SOURCES = [
  { icon: ICONS.tickets, name: 'Tickets and time entries', finds: 'Out-of-scope work done for free, billable time never invoiced, support beyond allowances' },
  { icon: ICONS.clients, name: 'Clients, users and devices', finds: 'Clients who have grown past their agreement, licences assigned but never billed' },
  { icon: ICONS.billing, name: 'Billing lines', finds: 'Recurring charges below the agreement, clients priced under your target margin' },
  { icon: ICONS.contracts, name: 'Contracts and SOWs', finds: 'What each agreement covers, so every finding cites the clause behind it' },
]

// The first-run state for a workspace with no analysis yet. Also shown by the
// Findings and Reports pages, so it stands on its own without page context.
export function GetStarted() {
  const { loadDemoData, data } = useStore()
  const toast = useToast()
  const nav = useNavigate()
  const [loading, setLoading] = useState(false)
  const hasData = data.tickets.length + data.clients.length > 0

  const loadDemo = async () => {
    setLoading(true)
    try {
      await loadDemoData()
      toast('Demo MSP loaded and analysed.')
      nav('/app')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not load demo data.', 'error')
    } finally {
      setLoading(false)
    }
  }

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
              ? 'Run the analysis to check every ticket, time entry, device and billing line against your agreements. It takes a few seconds and every pound links back to its evidence.'
              : 'Upload the exports your PSA, RMM and billing system already produce. Headroom checks every ticket, device and invoice line against the agreement and shows what you could be charging for.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            {hasData ? (
              <ButtonLink to="/app/data" variant="accent" size="lg">
                <Play className="size-4" /> Go to data and run analysis
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/app/data" variant="accent" size="lg">
                  <Upload className="size-4" /> Upload your data
                </ButtonLink>
                <Button variant="secondary" size="lg" onClick={loadDemo} loading={loading}>
                  {!loading && <FlaskConical className="size-4" />} Load demo data
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
                    <dd className={r.n ? 'tnum font-semibold text-ink' : 'tnum text-ink-4'}>{r.n ? num(r.n) : 'None yet'}</dd>
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
