import { NavLink } from 'react-router-dom'
import { cx } from '../../../components/ui'

// The two views of the same opportunities: the full list, and the queue that
// works them through each stage. Real links (NavLink marks the current one
// with aria-current="page"), drawn as a hairline segmented control.
const VIEWS = [
  { to: '/app/opportunities', label: 'All opportunities', end: true },
  { to: '/app/queue', label: 'Recovery queue', end: false },
]

export function OpportunityTabs({ className }: { className?: string }) {
  return (
    <nav aria-label="Opportunity views" className={cx('mb-6', className)}>
      <div className="inline-flex max-w-full rounded-md border border-line bg-surface p-0.5">
        {VIEWS.map((v) => (
          <NavLink
            key={v.to}
            to={v.to}
            end={v.end}
            className={({ isActive }) =>
              cx(
                'inline-flex h-8 items-center whitespace-nowrap rounded-[6px] px-3 text-small font-medium transition-colors duration-150',
                isActive ? 'bg-raised text-ink ring-1 ring-inset ring-line' : 'text-ink-3 hover:text-ink',
              )
            }
          >
            {v.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
