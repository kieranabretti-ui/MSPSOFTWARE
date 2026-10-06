import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X, Loader2, FlaskConical } from 'lucide-react'
import { ICONS } from '../brand/icons'
import { useStore } from '../data/store'
import { cx, Logo } from './ui'

const NAV = [
  { to: '/app', label: 'Overview', icon: ICONS.overview, end: true },
  { to: '/app/findings', label: 'Findings', icon: ICONS.findings },
  { to: '/app/clients', label: 'Clients', icon: ICONS.clients },
  { to: '/app/reports', label: 'Reports', icon: ICONS.reports },
  { to: '/app/data', label: 'Data', icon: ICONS.data },
  { to: '/app/actions', label: 'Actions', icon: ICONS.actions },
  { to: '/app/settings', label: 'Settings', icon: ICONS.settings },
]

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { workspace, user, signOut, data } = useStore()
  const navigate = useNavigate()
  const openFindings = data.findings.filter((f) => f.status === 'open').length
  const openActions = data.actions.filter((a) => a.status === 'open' || a.status === 'in_progress').length
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-0.5 px-2" aria-label="Main">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx('group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-body font-medium transition-colors duration-150', isActive ? 'bg-raised text-ink [&>svg]:text-accent [&>svg]:opacity-100' : 'text-ink-2 hover:bg-raised/60 hover:text-ink')
            }
          >
            <n.icon className="size-4 opacity-70 transition-opacity group-hover:opacity-100" />
            <span className="flex-1">{n.label}</span>
            {n.label === 'Findings' && openFindings > 0 && <span className="tnum rounded-xs bg-line px-1.5 text-[11px] font-medium text-ink-2">{openFindings}</span>}
            {n.label === 'Actions' && openActions > 0 && <span className="tnum rounded-xs bg-line px-1.5 text-[11px] font-medium text-ink-2">{openActions}</span>}
          </NavLink>
        ))}
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
              onClick={async () => {
                await signOut()
                navigate('/')
              }}
              className="rounded-sm p-1.5 text-ink-3 transition-colors hover:bg-raised hover:text-ink"
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
  const { workspace, busy, backend, isDemoSession } = useStore()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  // Block body: newer browsers return a Promise from scrollTo, and React would
  // call an effect's return value as its cleanup.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])

  return (
    <div className="min-h-screen lg:pl-60 print:pl-0">
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 border-r border-line-soft bg-canvas lg:block">
        <Sidebar />
      </aside>

      {/* mobile top bar */}
      <div className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line-soft bg-canvas/85 px-4 backdrop-blur-md lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-sm p-2 text-ink-2 hover:bg-raised hover:text-ink" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-[var(--brand-overlay)]" />
          <div className="elevate-3 absolute inset-y-0 left-0 w-72 border-r border-line bg-canvas" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-sm p-1.5 text-ink-3 hover:bg-raised hover:text-ink" aria-label="Close menu">
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      {(workspace?.is_demo || backend.mode === 'local') && (
        <div className="no-print flex items-start gap-2 border-b border-line-soft bg-sunken px-4 py-2 text-small text-ink-2 sm:px-8">
          <FlaskConical className="mt-[3px] size-3.5 shrink-0 text-ink-3" aria-hidden />
          {workspace?.is_demo ? (
            <p className="min-w-0">
              <strong className="font-semibold text-ink">Demo data</strong>
              <span className="sm:hidden">: a fictional MSP{isDemoSession ? ', nothing is saved.' : '.'}</span>
              <span className="hidden sm:inline">. Northlight IT and its clients are fictional, built to show how Headroom works.</span>
              {isDemoSession && <span className="hidden text-ink-3 sm:inline"> Nothing you do here is saved to a server.</span>}
            </p>
          ) : (
            <p className="min-w-0">
              <strong className="font-semibold text-ink">Local mode.</strong> Your data is stored only in this browser.
              {isDemoSession && <span className="hidden text-ink-3 sm:inline"> Nothing you do here is saved to a server.</span>}
            </p>
          )}
        </div>
      )}

      <main className="mx-auto max-w-[1200px] px-4 py-7 sm:px-8 sm:py-10">
        <Outlet />
      </main>

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
