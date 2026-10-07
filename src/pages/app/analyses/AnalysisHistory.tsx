import type { Analysis } from '../../../engine/types'
import { Card, CardHeader, cx } from '../../../components/ui'
import { dateTime, money, num, plural } from '../../../lib/format'

const TH = 'px-3 py-2.5 text-left text-label uppercase text-ink-3 font-semibold'

// Opportunities in this run that the run before it didn't have. Null when
// either run predates finding keys, so there is nothing honest to compare.
function newSince(run: Analysis, previous: Analysis | undefined): number | null {
  const now = run.summary.finding_keys
  const before = previous?.summary.finding_keys
  if (!now || !before) return null
  const seen = new Set(before)
  return now.filter((k) => !seen.has(k)).length
}

// Every past run with the figures it reported at the time, newest first. Later
// stage changes and dismissals don't rewrite history, so the latest row can
// differ from the overview.
export function AnalysisHistory({ analyses, className }: { analyses: Analysis[]; className?: string }) {
  const runs = [...analyses].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  return (
    <Card className={className}>
      <CardHeader
        title="Past analyses"
        subtitle={runs.length ? <span className="tnum">{plural(runs.length, 'run')}. Figures are as at the time of each analysis.</span> : undefined}
      />
      {runs.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-0 table-fixed text-small">
            <caption className="sr-only">Past analyses, newest first. Figures are as at the time of each analysis.</caption>
            <thead>
              <tr className="border-b border-line-soft">
                <th scope="col" className={cx(TH, 'pl-4 sm:pl-5')}>
                  Run date
                </th>
                <th scope="col" className={cx(TH, 'hidden w-48 lg:table-cell')}>
                  Period
                </th>
                <th scope="col" className={cx(TH, 'hidden w-48 xl:table-cell')}>
                  Data analysed
                </th>
                <th scope="col" className={cx(TH, 'hidden w-32 text-right md:table-cell')}>
                  Opportunities
                </th>
                <th scope="col" className={cx(TH, 'w-28 text-right sm:w-32')}>
                  Identified
                </th>
                <th scope="col" className={cx(TH, 'hidden w-28 text-right sm:table-cell')}>
                  Recurring
                </th>
                <th scope="col" className={cx(TH, 'hidden w-40 whitespace-nowrap pr-5 text-right md:table-cell')}>
                  New vs previous
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {runs.map((a, i) => {
                const s = a.summary
                const fresh = newSince(a, runs[i + 1])
                const counts = `${plural(s.data_counts.clients, 'client')} · ${plural(s.data_counts.tickets, 'ticket')}`
                return (
                  <tr key={a.id} className="transition-colors duration-150 hover:bg-hover">
                    <td className="py-3 pl-4 pr-3 sm:pl-5">
                      <p className="tnum truncate font-medium text-ink">
                        {dateTime(a.created_at)}
                        {i === 0 && <span className="ml-2 text-caption font-normal text-ink-3">Latest</span>}
                      </p>
                      <p className="tnum mt-0.5 text-caption text-ink-3 lg:hidden">{s.period_label}</p>
                      <p className="tnum mt-0.5 text-caption text-ink-3 xl:hidden">
                        <span className="md:hidden">{plural(s.finding_count, 'opportunity', 'opportunities')} · </span>
                        {counts}
                      </p>
                    </td>
                    <td className="hidden truncate px-3 py-3 text-ink-2 lg:table-cell">{s.period_label}</td>
                    <td className="tnum hidden truncate px-3 py-3 text-ink-2 xl:table-cell">{counts}</td>
                    <td className="tnum hidden px-3 py-3 text-right text-ink-2 md:table-cell">{num(s.finding_count)}</td>
                    <td className="tnum px-3 py-3 text-right font-semibold text-ink">
                      {money(s.total_identified)}
                      <span className="mt-0.5 block text-caption font-normal text-ink-3 sm:hidden">{money(s.monthly_recurring)}/mo</span>
                    </td>
                    <td className="tnum hidden px-3 py-3 text-right text-ink-2 sm:table-cell">{money(s.monthly_recurring)}/mo</td>
                    <td className="tnum hidden py-3 pl-3 pr-5 text-right text-ink-2 md:table-cell">
                      {fresh == null ? (
                        <span className="text-ink-3">
                          <span aria-hidden>—</span>
                          <span className="sr-only">Not recorded</span>
                        </span>
                      ) : fresh === 0 ? <span className="text-ink-3">None</span> : `+${num(fresh)}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-8">
          <p className="text-body text-ink-2">No analyses yet. Run your first analysis above.</p>
          <p className="mt-1 text-small text-ink-3">Each run is listed here with what it found, so you can see what changed from one month to the next.</p>
        </div>
      )}
    </Card>
  )
}
