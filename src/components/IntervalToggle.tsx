import { useId } from 'react'
import { annualDiscountPct, type Interval } from '../billing/plans'
import { cx } from './ui'

// Monthly or annual, as a pair of native radios drawn as a segmented control:
// arrow keys, focus and screen-reader names come with the inputs. Both labels
// keep their width whichever is chosen, so switching never moves the layout.
export function IntervalToggle({ value, onChange, className }: { value: Interval; onChange: (v: Interval) => void; className?: string }) {
  const name = useId()
  const options: { v: Interval; label: string; note?: string }[] = [
    { v: 'month', label: 'Monthly' },
    { v: 'year', label: 'Annual', note: `Save ${annualDiscountPct()}%` },
  ]
  return (
    <fieldset className={cx('inline-flex rounded-md border border-line bg-surface p-0.5', className)}>
      <legend className="sr-only">Billing period</legend>
      {options.map((o) => {
        const on = value === o.v
        return (
          <label
            key={o.v}
            className={cx(
              'inline-flex h-8 cursor-pointer items-center gap-2 rounded-sm px-3 text-small font-medium transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent',
              on ? 'bg-raised text-ink ring-1 ring-inset ring-line-strong' : 'text-ink-3 hover:bg-hover hover:text-ink',
            )}
          >
            <input type="radio" name={name} value={o.v} checked={on} onChange={() => onChange(o.v)} className="sr-only" />
            {o.label}
            {o.note && <span className={cx('text-caption', on ? 'text-ink-2' : 'text-ink-3')}>{o.note}</span>}
          </label>
        )
      })}
    </fieldset>
  )
}
