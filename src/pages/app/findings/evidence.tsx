import type { ReactNode } from 'react'
import { ChartColumn, Clock, Laptop, Users, type LucideIcon } from 'lucide-react'
import { Badge, cx } from '../../../components/ui'
import { ICONS } from '../../../brand/icons'
import { dateTime, money } from '../../../lib/format'
import { fmtMinutes, monthLabel } from '../../../engine/format'
import type { Evidence } from '../../../engine/types'

// The evidence ledger: each source record the rules engine used, drawn in the
// shape of the record itself. A clause reads as a quotation, a ticket as a
// ticket, logged time as a timesheet, and agreement or usage figures as
// label and amount rows. Matched phrases carry a highlighter mark.

export function Highlighted({ text, highlights }: { text: string; highlights?: string[] }) {
  const hs = (highlights ?? []).filter((h) => h && h.length > 2)
  if (!hs.length) return <>{text}</>
  const re = new RegExp(`(${hs.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  return (
    <>
      {text.split(re).map((part, i) =>
        hs.some((h) => h.toLowerCase() === part.toLowerCase()) ? (
          <mark key={i} className="box-decoration-clone rounded-xs border-b border-accent-line bg-accent-soft px-0.5 text-ink">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  )
}

const KIND: Record<Evidence['kind'], { icon: LucideIcon; name?: string }> = {
  contract: { icon: ICONS.contracts, name: 'Contract clause' },
  ticket: { icon: ICONS.tickets },
  time_entry: { icon: Clock },
  billing: { icon: ICONS.billing },
  asset: { icon: Users },
  metric: { icon: ChartColumn },
  client: { icon: ICONS.contracts },
}

// "2026-09-15 10:20 · James Smith · 1h 20m · non-billable", one line per entry.
const TIME_LINE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) · (.+) · (.+?) · (billable|non-billable)$/
function parseTime(text: string) {
  const rows = text.split('\n').map((l) => TIME_LINE.exec(l.trim()))
  if (!rows.length || rows.some((r) => !r)) return null
  return rows.map((r) => ({ date: r![1], time: r![2], technician: r![3], duration: r![4], billable: r![5] === 'billable' }))
}

// "Included support: 10 hours/month", or "Labour £35/h · Target margin 30%".
function parseFigures(text: string) {
  const out: { label: string; value: string }[] = []
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const kv = /^([^:]{1,60}):\s+(.+)$/.exec(line)
    if (kv && !/\.\s/.test(kv[1])) {
      out.push({ label: kv[1], value: kv[2] })
      continue
    }
    const parts = line.split(' · ').map((p) => /^(.*?\S)\s+([£\d].*)$/.exec(p))
    if (parts.length > 1 && parts.every(Boolean)) {
      for (const p of parts) out.push({ label: p![1], value: p![2] })
      continue
    }
    return null
  }
  return out.length ? out : null
}

function TimeLedger({ rows, nonBillableMinutes }: { rows: NonNullable<ReturnType<typeof parseTime>>; nonBillableMinutes?: number }) {
  const th = 'py-2 text-left text-label uppercase text-ink-3'
  return (
    <table className="w-full text-small">
      <thead>
        <tr className="border-b border-line-soft">
          <th scope="col" className={cx(th, 'pr-3')}>
            Logged
          </th>
          <th scope="col" className={cx(th, 'hidden px-3 sm:table-cell')}>
            Technician
          </th>
          <th scope="col" className={cx(th, 'px-3 text-right')}>
            Time
          </th>
          <th scope="col" className={cx(th, 'pl-3 text-right')}>
            Billing
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line-soft">
        {rows.map((r, i) => (
          <tr key={i}>
            <td className="py-2.5 pr-3 align-top">
              <span className="tnum text-ink">{dateTime(`${r.date}T${r.time}:00`)}</span>
              <span className="block text-caption text-ink-3 sm:hidden">{r.technician}</span>
            </td>
            <td className="hidden px-3 py-2.5 align-top text-ink-2 sm:table-cell">{r.technician}</td>
            <td className="tnum whitespace-nowrap px-3 py-2.5 text-right align-top font-medium text-ink">{r.duration}</td>
            <td className="whitespace-nowrap py-2.5 pl-3 text-right align-top">{r.billable ? <Badge>Billable</Badge> : <Badge tone="warning">Non-billable</Badge>}</td>
          </tr>
        ))}
      </tbody>
      {nonBillableMinutes != null && nonBillableMinutes > 0 && (
        <tfoot>
          <tr className="border-t border-line">
            <td className="pt-2.5 pr-3 text-ink-2">Logged as non-billable</td>
            <td className="hidden sm:table-cell" />
            <td className="tnum whitespace-nowrap px-3 pt-2.5 text-right font-semibold text-ink">{fmtMinutes(nonBillableMinutes)}</td>
            <td />
          </tr>
        </tfoot>
      )}
    </table>
  )
}

function FigureRows({ rows }: { rows: { label: string; value: ReactNode; strong?: boolean }[] }) {
  return (
    <dl className="text-small">
      {rows.map((r, i) => (
        <div key={i} className={cx('flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0', i > 0 && 'border-t', r.strong ? 'border-line' : 'border-line-soft')}>
          <dt className="min-w-0 text-ink-2">{r.label}</dt>
          <dd className={cx('tnum shrink-0 text-right text-ink', r.strong ? 'font-semibold' : 'font-medium')}>{r.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// One row of the ledger: what the record is on the left, the record on the right.
function LedgerRow({ icon: Icon, name, source, children }: { icon: LucideIcon; name: ReactNode; source?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-3 px-5 py-5 md:grid-cols-[11rem_minmax(0,1fr)]">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-small font-medium text-ink">
          <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />
          <span className="min-w-0">{name}</span>
        </div>
        {source && <p className="mt-1 text-caption text-ink-3 md:pl-6">{source}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function EvidenceRow({ evidence: e, nonBillableMinutes }: { evidence: Evidence; nonBillableMinutes?: number }) {
  const k = e.kind === 'asset' && /^devices/i.test(e.label) ? { ...KIND.asset, icon: Laptop } : KIND[e.kind]
  const [head, ...rest] = e.label.split(' · ')
  const tail = rest.join(' · ')

  if (e.kind === 'contract')
    return (
      <LedgerRow icon={k.icon} name={k.name} source="Uploaded contract">
        <figure>
          <blockquote className="rounded-md border border-line-soft bg-sunken px-4 py-3.5 text-body leading-relaxed text-ink">
            <span className="text-ink-3" aria-hidden>
              “
            </span>
            <Highlighted text={e.text} highlights={e.highlights} />
            <span className="text-ink-3" aria-hidden>
              ”
            </span>
          </blockquote>
          {tail && <figcaption className="mt-2 text-caption text-ink-3">{tail}</figcaption>}
        </figure>
      </LedgerRow>
    )

  if (e.kind === 'ticket') {
    const [subject, ...body] = e.text.split('\n\n')
    return (
      <LedgerRow icon={k.icon} name={<span className="tnum">{head}</span>} source="Ticket export">
        <p className="text-body font-medium text-ink">
          <Highlighted text={subject} highlights={e.highlights} />
        </p>
        {body.length > 0 && (
          <p className="mt-1.5 max-w-[68ch] whitespace-pre-line text-body leading-relaxed text-ink-2">
            <Highlighted text={body.join('\n\n')} highlights={e.highlights} />
          </p>
        )}
      </LedgerRow>
    )
  }

  if (e.kind === 'time_entry') {
    const rows = parseTime(e.text)
    return (
      <LedgerRow icon={k.icon} name={e.label} source="Time entries">
        {rows ? <TimeLedger rows={rows} nonBillableMinutes={nonBillableMinutes} /> : <p className="tnum whitespace-pre-line text-small text-ink-2">{e.text}</p>}
      </LedgerRow>
    )
  }

  const figures = parseFigures(e.text)
  return (
    <LedgerRow icon={k.icon} name={head} source={tail || undefined}>
      {figures ? (
        <FigureRows rows={figures} />
      ) : (
        <p className="max-w-[68ch] whitespace-pre-line text-body leading-relaxed text-ink-2">
          <Highlighted text={e.text} highlights={e.highlights} />
        </p>
      )}
    </LedgerRow>
  )
}

// Closes the ledger on the money: what each month of the period contributed.
export function ValueByMonth({ periodValues, total }: { periodValues: Record<string, number>; total: number }) {
  const months = Object.keys(periodValues).sort()
  return (
    <LedgerRow icon={ICONS.revenue} name="Value by month" source="Estimated from the records above">
      <FigureRows
        rows={[
          ...months.map((m) => ({ label: monthLabel(m, 'long'), value: money(periodValues[m]) })),
          { label: 'Total potential value', value: money(total), strong: true },
        ]}
      />
    </LedgerRow>
  )
}
