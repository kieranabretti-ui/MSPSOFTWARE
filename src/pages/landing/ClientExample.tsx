import type { ReactNode } from 'react'
import { Figure, HealthDot, cx } from '../../components/ui'
import { money, pct } from '../../lib/format'
import { CATEGORY_META } from '../../lib/labels'
import { DEMO } from './demoSnapshot'
import { Section, sectionTitleCls } from './primitives'

// One client from the demo, worked through like a client review: what it pays,
// what it costs to serve, the contract value its costs call for, and what was
// found. Every figure comes from the engine's run on the demo data.

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve']

function Line({ label, sub, value, strong, className }: { label: ReactNode; sub?: ReactNode; value: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div className={cx('flex items-baseline justify-between gap-4 py-3', className)}>
      <dt className="min-w-0">
        <span className={cx('text-small', strong ? 'font-medium text-ink' : 'text-ink-2')}>{label}</span>
        {sub && <span className="tnum mt-0.5 block text-caption text-ink-3">{sub}</span>}
      </dt>
      <dd className={cx('tnum shrink-0 text-right', strong ? 'text-data-md text-ink' : 'text-small font-medium text-ink')}>{value}</dd>
    </div>
  )
}

export function ClientExample() {
  const c = DEMO.client
  const { labourRate, targetMargin } = DEMO.settings
  const maxHours = Math.max(...c.monthlyHours.map((m) => m.hours))
  const first = c.monthlyHours[0]
  const last = c.monthlyHours[c.monthlyHours.length - 1]
  const extraUsers = c.users - (c.contractedUsers ?? c.users)
  const monthsWord = WORDS[DEMO.period.months] ?? String(DEMO.period.months)

  return (
    <Section id="example" label="example-title">
      <div className="grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <h2 id="example-title" className={sectionTitleCls}>
            One client. {monthsWord} months. {money(c.leakage)} of potential leakage.
          </h2>
          <p className="mt-5 max-w-[52ch] text-lead text-ink-2">
            {c.name} pays {money(c.mrr)} a month{c.package ? ` on ${c.package}` : ''}. Its support has grown from {first.hours} to {last.hours} hours a month, and{' '}
            {extraUsers > 0 ? `${extraUsers} new starters were never added to the agreement` : 'its agreement has not moved'}.
          </p>

          <dl className="mt-8 grid grid-cols-2 border-y border-line-soft">
            <div className="py-4 pr-4">
              <dt className="text-caption text-ink-3">Users supported</dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                <Figure>{c.users}</Figure>
                <span className="tnum text-small text-ink-3">{c.contractedUsers} contracted</span>
              </dd>
            </div>
            <div className="border-l border-line-soft py-4 pl-4">
              <dt className="text-caption text-ink-3">Devices supported</dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                <Figure>{c.devices}</Figure>
                <span className="tnum text-small text-ink-3">{c.contractedDevices} contracted</span>
              </dd>
            </div>
          </dl>

          <div className="mt-8">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-small font-medium text-ink-2">Support hours by month</p>
              <HealthDot health={c.health} />
            </div>
            <div className="mt-4 grid grid-cols-6 items-end gap-2 sm:gap-3" role="img" aria-label={`Support hours by month: ${c.monthlyHours.map((m) => `${m.month} ${m.hours}h`).join(', ')}`}>
              {c.monthlyHours.map((m, i) => (
                <div key={m.month} className="flex flex-col items-center gap-1.5">
                  <span className="tnum text-caption text-ink-2">{m.hours}h</span>
                  <div className="flex h-24 w-full items-end">
                    <div className={cx('w-full rounded-t-[3px]', i === c.monthlyHours.length - 1 ? 'bg-viz-series-strong' : 'bg-viz-series')} style={{ height: `${(m.hours / maxHours) * 100}%` }} />
                  </div>
                  <span className="text-caption text-ink-3">{m.month}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-soft px-5 py-4 sm:px-7">
              <h3 className="text-h3 text-ink">What {c.name} costs to serve</h3>
              <p className="tnum text-caption text-ink-3">Monthly average, {DEMO.period.label}</p>
            </div>
            <dl className="px-5 sm:px-7">
              <Line label="Monthly agreement" value={money(c.mrr)} />
              <Line className="border-t border-line-soft" label="Labour" sub={`${c.avgHours}h a month at ${money(labourRate)}/h`} value={`−${money(c.labour)}`} />
              <Line className="border-t border-line-soft" label="Software" value={`−${money(c.software)}`} />
              <Line className="border-t border-line" strong label="Gross contribution" sub={`${pct(c.margin)} margin against a ${pct(targetMargin)} target`} value={money(c.contribution)} />
            </dl>
            <div className="border-t-[3px] border-double border-line-strong bg-sunken px-5 py-5 sm:px-7">
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-small font-medium text-ink">Recommended contract value</p>
                <p className="tnum shrink-0 text-right">
                  <Figure>{money(c.recommended)}</Figure>
                  <span className="ml-1.5 text-small text-ink-3">a month</span>
                </p>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-4">
                <p className="max-w-[40ch] text-caption text-ink-3">The monthly price at which its labour and software cost leave a {pct(targetMargin)} margin.</p>
                <p className="tnum shrink-0 text-small font-semibold text-accent">+{money(c.uplift)} a month</p>
              </div>
            </div>

            <div className="border-t border-line-soft px-5 pb-5 pt-4 sm:px-7">
              <h3 className="text-h3 text-ink">Found at {c.name}</h3>
              <ul className="mt-2">
                {c.findings.map((f) => (
                  <li key={f.title} className="flex items-baseline justify-between gap-4 border-t border-line-soft py-2.5 first:border-t-0">
                    <span className="min-w-0">
                      <span className="block text-small text-ink">{f.title}</span>
                      <span className="tnum block text-caption text-ink-3">
                        {CATEGORY_META[f.category].short}
                        {f.ticketRef ? ` · Ticket #${f.ticketRef}` : ''}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-small font-semibold text-ink">{money(f.value)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
                <span className="text-small font-medium text-ink">Potential leakage, {monthsWord.toLowerCase()} months</span>
                <Figure size="md">{money(c.leakage)}</Figure>
              </div>
            </div>
          </div>
          {c.driftMonthly > 0 && (
            <p className="tnum mt-4 max-w-[68ch] text-small text-ink-2">
              Billing the {extraUsers} extra users alone (+{money(c.driftMonthly)} a month) takes {c.name} to {money(c.mrrAfterDrift)}, a {(c.marginAfterDrift * 100).toFixed(1)}% margin, before any
              price conversation.
            </p>
          )}
        </div>
      </div>
    </Section>
  )
}
