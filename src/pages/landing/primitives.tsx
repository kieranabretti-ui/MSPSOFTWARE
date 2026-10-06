import type { ReactNode } from 'react'
import { cx } from '../../components/ui'

// Landing-only building blocks: the page measure, marketing-scale headings and
// the ledger rules (a hairline for a line item, a double rule under a total).

export const wrap = 'mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8'

// Marketing display sizes sit on the brand's display tracking (-0.04em) and
// scale fluidly; the app's h1/h2 tokens stay as they are.
export const displayCls = 'font-semibold text-ink text-[length:clamp(2.75rem,1.15rem+5.4vw,5rem)] leading-[0.98] tracking-(--type-display-tracking)'
export const sectionTitleCls = 'font-semibold text-ink text-balance text-[length:clamp(1.875rem,1.15rem+2.4vw,3rem)] leading-[1.06] tracking-[-0.032em]'

export function Section({ id, className, children, label }: { id?: string; className?: string; children: ReactNode; label?: string }) {
  return (
    <section id={id} aria-labelledby={label} className={cx('scroll-mt-14 border-t border-line-soft', className)}>
      <div className={cx(wrap, 'py-20 sm:py-24 lg:py-28')}>{children}</div>
    </section>
  )
}

// `stacked` sets the intro under the heading, for a section whose module
// below should carry the width on its own.
export function SectionIntro({ id, title, children, className, stacked }: { id: string; title: ReactNode; children?: ReactNode; className?: string; stacked?: boolean }) {
  if (stacked)
    return (
      <div className={className}>
        <h2 id={id} className={cx(sectionTitleCls, 'max-w-[24ch]')}>
          {title}
        </h2>
        {children && <div className="mt-6 max-w-[68ch] text-lead text-ink-2">{children}</div>}
      </div>
    )
  return (
    <div className={cx('grid grid-cols-1 gap-x-8 gap-y-5 lg:grid-cols-12 lg:items-end', className)}>
      <h2 id={id} className={cx(sectionTitleCls, 'lg:col-span-7')}>
        {title}
      </h2>
      {children && <div className="max-w-[56ch] text-lead text-ink-2 lg:col-span-4 lg:col-start-9">{children}</div>}
    </div>
  )
}

// A matched phrase in a ticket or clause, marked the way the app marks it.
export function Highlighted({ text, highlights }: { text: string; highlights?: string[] }) {
  const hs = (highlights ?? []).filter((h) => h && h.length > 2).sort((a, b) => b.length - a.length)
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

// "15 Sept 2026" from "2026-09-15".
export function shortDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
