import type { ReactNode } from 'react'
import { cx } from '../../../components/ui'

// One row of a settings card: what it is on the left, its controls on the right.
export function Section({ title, body, children, last, id }: { title: string; body?: ReactNode; children: ReactNode; last?: boolean; id?: string }) {
  return (
    <section id={id} className={cx('grid scroll-mt-6 grid-cols-1 gap-x-10 gap-y-5 px-5 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)]', !last && 'border-b border-line-soft')}>
      <div>
        <h2 className="text-h3 text-ink">{title}</h2>
        {body && <p className="mt-1 max-w-[40ch] text-small text-ink-3">{body}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

// A term and its explanation, for the plain-fact lists in Data and privacy.
export function FactList({ items }: { items: { term: ReactNode; detail: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-1 gap-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
          <dt className="text-small font-medium text-ink">{it.term}</dt>
          <dd className="text-small text-ink-2">{it.detail}</dd>
        </div>
      ))}
    </dl>
  )
}
