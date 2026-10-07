import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { cx } from '../../components/ui'
import { wrap } from './primitives'

export interface MenuLink {
  label: string
  // An in-page anchor (/#pricing) or a route (/security).
  href: string
  route?: boolean
  current?: boolean
}

const ITEM = 'flex h-11 items-center rounded-md px-3 text-body font-medium transition-colors hover:bg-raised hover:text-ink'

// The top bar's links below lg: a disclosure, not a modal. A panel drops under
// the header and the page stays usable. It closes on a link, on Escape (focus
// returns to the button) and on a click anywhere outside it.
export function MobileMenu({ links, account }: { links: MenuLink[]; account: MenuLink[] }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  const item = (l: MenuLink) => {
    const cls = cx(ITEM, l.current ? 'text-ink' : 'text-ink-2')
    const close = () => setOpen(false)
    return (
      <li key={l.label}>
        {l.route ? (
          <Link to={l.href} className={cls} onClick={close} aria-current={l.current ? 'page' : undefined}>
            {l.label}
          </Link>
        ) : (
          <a href={l.href} className={cls} onClick={close}>
            {l.label}
          </a>
        )}
      </li>
    )
  }

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="-mr-2 inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-small font-medium text-ink-2 transition-colors hover:bg-raised hover:text-ink"
      >
        {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
        Menu
      </button>
      <div ref={panelRef} id={id} hidden={!open} className="elevate-2 absolute inset-x-0 top-full border-b border-line bg-canvas">
        <nav aria-label="Site" className={cx(wrap, 'py-2')}>
          <ul>{links.map(item)}</ul>
          {account.length > 0 && <ul className="mt-2 border-t border-line-soft pt-2">{account.map(item)}</ul>}
        </nav>
      </div>
    </div>
  )
}
