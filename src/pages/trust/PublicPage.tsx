import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { COMPANY } from '../../brand/brand'
import { Footer, TopBar, companyLine } from '../landing/chrome'
import { wrap } from '../landing/primitives'

// The frame the Trust Centre, privacy policy and terms share: the site's top
// bar and footer, a heading block with an on-this-page index, and the body.

export function usePageTitle(title: string) {
  useEffect(() => {
    const before = document.title
    document.title = `${title} · Headroom`
    return () => {
      document.title = before
    }
  }, [title])
}

// Arriving at /trust#ai from another page: bring the section into view once drawn.
function useHashScroll() {
  const { hash } = useLocation()
  useEffect(() => {
    if (hash.length > 1) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView()
  }, [hash])
}

export function PublicPage({
  title,
  docTitle,
  lead,
  meta,
  index,
  children,
}: {
  title: string
  docTitle: string
  lead?: ReactNode
  meta?: ReactNode
  index?: { id: string; label: string }[]
  children: ReactNode
}) {
  usePageTitle(docTitle)
  useHashScroll()
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only rounded-md bg-raised text-body font-medium text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <TopBar />

      <main id="main" tabIndex={-1} className="focus:outline-none">
        <div className={`${wrap} pb-10 pt-14 sm:pt-20 lg:pb-12 lg:pt-24`}>
          <h1 className="max-w-[22ch] text-balance text-[length:clamp(2.25rem,1.4rem+3vw,3.75rem)] font-semibold leading-[1.02] tracking-(--type-display-tracking) text-ink">{title}</h1>
          {lead && <div className="mt-6 max-w-[60ch] text-lead text-ink-2">{lead}</div>}
          {meta && <div className="mt-4 max-w-[64ch] text-small text-ink-3">{meta}</div>}
          {index && index.length > 0 && (
            <nav aria-label="On this page" className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-line-soft pt-5">
              {index.map((g) => (
                <a key={g.id} href={`#${g.id}`} className="rounded-sm text-small text-ink-3 underline-offset-4 transition-colors hover:text-ink hover:underline">
                  {g.label}
                </a>
              ))}
            </nav>
          )}
        </div>
        {children}
        {COMPANY.legalName && (
          <div className={`${wrap} pb-16`}>
            <p className="max-w-[64ch] border-t border-line-soft pt-6 text-caption text-ink-3">{companyLine()}</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  )
}

// One titled block of a public page: heading on the left, content on the right.
export function PageSection({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line-soft">
      <div className={`${wrap} grid grid-cols-1 gap-x-12 gap-y-5 py-12 lg:grid-cols-12 lg:py-16`}>
        <div className="lg:col-span-4">
          <h2 id={`${id}-title`} className="text-h1 text-balance text-ink lg:sticky lg:top-20">
            {title}
          </h2>
          {intro && <div className="mt-3 max-w-[40ch] text-body text-ink-3">{intro}</div>}
        </div>
        <div className="min-w-0 lg:col-span-8">{children}</div>
      </div>
    </section>
  )
}

export const linkCls = 'font-medium text-ink underline decoration-line-strong underline-offset-4 transition-colors hover:decoration-ink'
