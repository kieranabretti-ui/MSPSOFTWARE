import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, Loader2, FlaskConical } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ICONS } from '../brand/icons'
import { useStore } from '../data/store'
import type { WorkspaceData } from '../data/backend'
import { useToast } from './toast'
import { Button, cx, Logo, Modal, trapTab } from './ui'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  // Active only on `to` itself, not on paths beneath it.
  end?: boolean
  // Other paths that belong to this item, such as a tab that has its own route.
  also?: string[]
  // A count shown beside the label, worked out from the workspace's data.
  badge?: (data: WorkspaceData) => number
}

// Stages that need no more review. Everything else (New, Reviewing) is counted
// on the Opportunities badge.
const SETTLED: readonly string[] = ['valid', 'resolved', 'dismissed']

const NAV: NavItem[] = [
  { to: '/app', label: 'Overview', icon: ICONS.overview, end: true },
  { to: '/app/analyses', label: 'Analyses', icon: ICONS.data },
  { to: '/app/opportunities', label: 'Opportunities', icon: ICONS.findings, also: ['/app/queue'], badge: (d) => d.findings.filter((f) => !SETTLED.includes(f.status)).length },
  { to: '/app/clients', label: 'Clients', icon: ICONS.clients },
  { to: '/app/contracts', label: 'Contracts', icon: ICONS.contracts },
  { to: '/app/reports', label: 'Reports', icon: ICONS.reports },
  { to: '/app/settings', label: 'Settings', icon: ICONS.settings },
]

const under = (path: string, base: string) => path === base || path.startsWith(base + '/')
const isActive = (n: NavItem, path: string) => (n.end ? path.replace(/\/$/, '') === n.to : [n.to, ...(n.also ?? [])].some((p) => under(path, p)))

// The page name for the tab title. Detail routes come before their lists.
const TITLES: [RegExp, string][] = [
  [/^\/app\/?$/, 'Overview'],
  [/^\/app\/opportunities\/[^/]+/, 'Opportunity'],
  [/^\/app\/opportunities/, 'Opportunities'],
  [/^\/app\/queue/, 'Recovery queue'],
  [/^\/app\/clients\/[^/]+/, 'Client'],
  [/^\/app\/clients/, 'Clients'],
  [/^\/app\/contracts/, 'Contracts'],
  [/^\/app\/analyses/, 'Analyses'],
  [/^\/app\/reports/, 'Reports'],
  [/^\/app\/settings/, 'Settings'],
]

function Sidebar({ onNavigate, onSignOut }: { onNavigate?: () => void; onSignOut: () => void }) {
  const { workspace, user, data } = useStore()
  const { pathname } = useLocation()
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-0.5 px-2" aria-label="Main">
        {NAV.map((n) => {
          const active = isActive(n, pathname)
          const count = n.badge?.(data) ?? 0
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cx('group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-body font-medium transition-colors duration-150', active ? 'bg-raised text-ink [&>svg]:text-accent [&>svg]:opacity-100' : 'text-ink-2 hover:bg-raised/60 hover:text-ink')}
            >
              <n.icon className="size-4 opacity-70 transition-opacity group-hover:opacity-100" />
              <span className="flex-1">{n.label}</span>
              {count > 0 && (
                <span className="tnum rounded-xs bg-line px-1.5 text-[11px] font-medium text-ink-2" title={`${count} to review (New and Reviewing)`}>
                  <span aria-hidden>{count}</span>
                  <span className="sr-only">, {count} to review</span>
                </span>
              )}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-line-soft p-3">
        <div className="rounded-lg px-2 py-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-sm border border-line bg-raised text-[11px] font-semibold text-ink-2">{(workspace?.name ?? 'W').slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-small font-semibold text-ink">{workspace?.name}</div>
              <div className="truncate text-caption text-ink-3">{user?.email}</div>
            </div>
            <button
              onClick={onSignOut}
              className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-raised hover:text-ink"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const { workspace, busy, backend, isDemoSession, signOut } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const menuRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastPath = useRef(loc.pathname)

  // The tab title names the page; the site's own title comes back on the way out.
  useEffect(() => {
    const before = document.title
    return () => {
      document.title = before
    }
  }, [])

  // On a new page: name it, close the drawer, start at the top and move focus to
  // the content so keyboard and screen reader users land on the page, not the
  // link they left. The first load keeps focus where it is, so the first Tab
  // still reaches "Skip to content".
  // Block body: newer browsers return a Promise from scrollTo, and React would
  // call an effect's return value as its cleanup.
  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(loc.pathname))?.[1]
    if (t) document.title = `${t} · Headroom`
    if (lastPath.current === loc.pathname && !loc.hash) return
    const samePage = lastPath.current === loc.pathname
    lastPath.current = loc.pathname
    setOpen(false)
    if (!samePage) {
      window.scrollTo(0, 0)
      mainRef.current?.focus({ preventScroll: true })
    }
    // A link to a section (/app/analyses#uploads) lands on it once the page
    // has rendered; lazy pages can take a few frames.
    if (!loc.hash) return
    let tries = 0
    let frame = 0
    const seek = () => {
      const el = document.getElementById(decodeURIComponent(loc.hash.slice(1)))
      if (el) el.scrollIntoView({ block: 'start' })
      else if (tries++ < 30) frame = requestAnimationFrame(seek)
    }
    frame = requestAnimationFrame(seek)
    return () => cancelAnimationFrame(frame)
  }, [loc.pathname, loc.hash])

  // The mobile drawer is modal: focus starts on Close, Tab stays inside, and
  // Escape hands focus back to the menu button.
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        menuRef.current?.focus()
      } else if (drawerRef.current) trapTab(e, drawerRef.current)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const closeMenu = () => {
    setOpen(false)
    menuRef.current?.focus()
  }

  // Local (evaluation) mode keeps the account and its data in this browser, so
  // signing out asks whether to leave them there. Hosted data stays on the
  // server either way.
  const [signingOut, setSigningOut] = useState(false)
  const [leaving, setLeaving] = useState<'keep' | 'remove' | null>(null)
  const askBeforeSignOut = backend.mode === 'local' && !isDemoSession
  const doSignOut = async (clearLocalData = false) => {
    setLeaving(clearLocalData ? 'remove' : 'keep')
    try {
      await signOut({ clearLocalData })
      setSigningOut(false)
      navigate('/')
    } catch {
      toast("We couldn't sign you out. Try again.", 'error')
    } finally {
      setLeaving(null)
    }
  }
  const requestSignOut = () => {
    setOpen(false)
    if (askBeforeSignOut) setSigningOut(true)
    else void doSignOut()
  }

  const startOwnAudit = async () => {
    try {
      await signOut()
      navigate('/signup?intent=audit')
    } catch {
      toast("We couldn't sign you out. Try again.", 'error')
    }
  }

  return (
    <div className="min-h-screen lg:pl-60 print:pl-0">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault()
          mainRef.current?.focus()
        }}
        className="sr-only rounded-md bg-raised text-body font-medium text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 border-r border-line-soft bg-canvas lg:block">
        <Sidebar onSignOut={requestSignOut} />
      </aside>

      {/* mobile top bar: the page's banner landmark below lg */}
      <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line-soft bg-canvas/85 px-4 backdrop-blur-md lg:hidden">
        <Logo />
        <button
          ref={menuRef}
          onClick={() => setOpen(true)}
          className="-mr-1.5 flex size-11 items-center justify-center rounded-sm text-ink-2 hover:bg-raised hover:text-ink"
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          <Menu className="size-5" />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={closeMenu}>
          <div className="absolute inset-0 bg-[var(--brand-overlay)]" />
          <div
            ref={drawerRef}
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Main menu"
            className="elevate-3 absolute inset-y-0 left-0 w-72 border-r border-line bg-canvas"
            onClick={(e) => e.stopPropagation()}
          >
            <button ref={closeRef} onClick={closeMenu} className="absolute right-1 top-2 flex size-11 items-center justify-center rounded-sm text-ink-3 hover:bg-raised hover:text-ink" aria-label="Close menu">
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} onSignOut={requestSignOut} />
          </div>
        </div>
      )}

      {(workspace?.is_demo || backend.mode === 'local') && (
        <section aria-label={workspace?.is_demo ? 'Demo notice' : 'Local mode notice'} className="no-print flex items-start gap-2 border-b border-line-soft bg-sunken px-4 py-2 text-small text-ink-2 sm:px-8">
          <FlaskConical className="mt-[3px] size-3.5 shrink-0 text-ink-3" aria-hidden />
          {workspace?.is_demo ? (
            <p className="min-w-0 flex-1">
              <strong className="font-semibold text-ink">Demo data</strong>
              <span className="sm:hidden">: a fictional MSP{isDemoSession ? ', changes stay in this browser.' : '.'}</span>
              <span className="hidden sm:inline">. Northlight IT and its clients are fictional, built to show how Headroom works.</span>
              {isDemoSession && <span className="hidden text-ink-3 sm:inline"> Nothing you change here is saved to a server.</span>}
            </p>
          ) : (
            <p className="min-w-0 flex-1">
              <strong className="font-semibold text-ink">Local mode.</strong> Your data is stored only in this browser.
              {isDemoSession && <span className="hidden text-ink-3 sm:inline"> Nothing you change here is saved to a server.</span>}
            </p>
          )}
          {isDemoSession && (
            <Button variant="ghost" size="sm" className="-my-1 shrink-0" onClick={startOwnAudit}>
              Start your own audit
            </Button>
          )}
        </section>
      )}

      <main ref={mainRef} id="main" tabIndex={-1} inert={open} className="mx-auto max-w-[1200px] px-4 py-7 focus:outline-none sm:px-8 sm:py-10">
        <Outlet />
      </main>

      <Modal
        open={signingOut}
        onClose={() => !leaving && setSigningOut(false)}
        title="Sign out"
      >
        <div className="space-y-3 text-body text-ink-2">
          <p>
            {workspace?.name ?? 'This workspace'} is stored only in this browser, unencrypted. Signing out keeps it here, so anyone using this browser profile can still read it.
          </p>
          <p>Removing it deletes the workspace, its data and activity log, and your account record from this browser. It can't be undone. Download anything you need first.</p>
          <div className="flex flex-col gap-2 pt-2 sm:flex-row-reverse">
            <Button onClick={() => void doSignOut(false)} loading={leaving === 'keep'} disabled={!!leaving}>
              Sign out
            </Button>
            <Button variant="secondary" onClick={() => void doSignOut(true)} loading={leaving === 'remove'} disabled={!!leaving}>
              Sign out and remove data from this browser
            </Button>
          </div>
        </div>
      </Modal>

      {busy && (
        <div className="no-print fixed inset-0 z-[55] flex items-center justify-center bg-[var(--brand-overlay)] backdrop-blur-sm">
          <div className="elevate-3 flex items-center gap-3 rounded-lg border border-line bg-raised px-5 py-4 text-body font-medium text-ink" role="status">
            <Loader2 className="size-4 animate-spin text-accent" />
            {busy}
          </div>
        </div>
      )}
    </div>
  )
}
