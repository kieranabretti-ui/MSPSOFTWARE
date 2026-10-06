import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { FileText, Database, LayoutDashboard, ListChecks, LogOut, Menu, Search, Settings, Users, X, Loader2, FlaskConical } from 'lucide-react'
import { useStore } from '../data/store'
import { cx, Logo } from './ui'

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/findings', label: 'Findings', icon: Search },
  { to: '/app/clients', label: 'Clients', icon: Users },
  { to: '/app/reports', label: 'Reports', icon: FileText },
  { to: '/app/data', label: 'Data', icon: Database },
  { to: '/app/actions', label: 'Actions', icon: ListChecks },
  { to: '/app/settings', label: 'Settings', icon: Settings },
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
              cx('flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors', isActive ? 'bg-zinc-900/[0.06] text-zinc-900' : 'text-zinc-600 hover:bg-zinc-900/[0.04] hover:text-zinc-900')
            }
          >
            <n.icon className="size-4 opacity-80" />
            <span className="flex-1">{n.label}</span>
            {n.label === 'Findings' && openFindings > 0 && <span className="tnum rounded-md bg-zinc-200/70 px-1.5 text-[11px] text-zinc-700">{openFindings}</span>}
            {n.label === 'Actions' && openActions > 0 && <span className="tnum rounded-md bg-zinc-200/70 px-1.5 text-[11px] text-zinc-700">{openActions}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-zinc-200 p-3">
        <div className="rounded-lg px-2 py-2">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-zinc-900 text-[11px] font-semibold text-white">{(workspace?.name ?? 'W').slice(0, 2).toUpperCase()}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{workspace?.name}</div>
              <div className="truncate text-xs text-zinc-500">{user?.email}</div>
            </div>
            <button
              onClick={async () => {
                await signOut()
                navigate('/')
              }}
              className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900"
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
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 border-r border-zinc-200 bg-zinc-100/60 lg:block">
        <Sidebar />
      </aside>

      {/* mobile top bar */}
      <div className="no-print sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-zinc-950/30" />
          <div className="absolute inset-y-0 left-0 w-72 bg-zinc-50 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(false)} className="absolute right-3 top-4 rounded-md p-1.5 text-zinc-500 hover:bg-zinc-200" aria-label="Close menu">
              <X className="size-4" />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      {(workspace?.is_demo || backend.mode === 'local') && (
        <div className="no-print flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-orange-200/70 bg-orange-50 px-4 py-2 text-[13px] text-orange-900 sm:px-8">
          <FlaskConical className="size-3.5" />
          {workspace?.is_demo ? (
            <span>
              <strong className="font-semibold">Demo data.</strong> Northlight IT and its clients are fictional, built to show how MSP Leak works.
            </span>
          ) : (
            <span>
              <strong className="font-semibold">Local mode.</strong> Your data is stored only in this browser.
            </span>
          )}
          {isDemoSession && <span className="text-orange-800/80">Nothing you do here is saved to a server.</span>}
        </div>
      )}

      <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8 sm:py-8">
        <Outlet />
      </main>

      {busy && (
        <div className="no-print fixed inset-0 z-[55] flex items-center justify-center bg-white/70 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-5 py-4 text-sm font-medium shadow-lg">
            <Loader2 className="size-4 animate-spin" />
            {busy}
          </div>
        </div>
      )}
    </div>
  )
}
