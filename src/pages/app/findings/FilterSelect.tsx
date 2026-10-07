import type { ReactNode, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cx } from '../../../components/ui'

// A native select dressed in the product's controls: same height, border and
// focus ring as inputCls, with a drawn chevron instead of the browser's arrow.
// It stays a real <select>, so labels, keyboard use and tests work unchanged.
export function FilterSelect({ className, children, active, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { active?: boolean; children: ReactNode }) {
  return (
    <div className={cx('relative min-w-0', className)}>
      <select
        {...rest}
        className={cx(
          'block h-9 w-full cursor-pointer appearance-none truncate rounded-md border bg-sunken pl-3 pr-8 text-small transition-[border-color,box-shadow,color] duration-150',
          'hover:border-ink-4 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-50',
          active ? 'border-line-strong font-medium text-ink' : 'border-line text-ink-2',
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  )
}
