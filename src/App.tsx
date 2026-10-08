import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { useStore } from './data/store'
import { PageSkeleton } from './components/ui'
// The landing page is the front door, so it ships in the entry chunk rather
// than behind a loading state. Everything else loads on demand.
import Landing from './pages/Landing'
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Signup })))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Demo = lazy(() => import('./pages/Demo'))
const TrustCentre = lazy(() => import('./pages/trust/TrustCentre'))
const Privacy = lazy(() => import('./pages/legal/LegalPage').then((m) => ({ default: m.Privacy })))
const Terms = lazy(() => import('./pages/legal/LegalPage').then((m) => ({ default: m.Terms })))
const AppLayout = lazy(() => import('./components/AppLayout'))
const Overview = lazy(() => import('./pages/app/Overview'))
const Opportunities = lazy(() => import('./pages/app/Opportunities'))
const FindingDetail = lazy(() => import('./pages/app/FindingDetail'))
const RecoveryQueue = lazy(() => import('./pages/app/RecoveryQueue'))
const Clients = lazy(() => import('./pages/app/Clients'))
const ClientDetail = lazy(() => import('./pages/app/ClientDetail'))
const Contracts = lazy(() => import('./pages/app/Contracts'))
const Analyses = lazy(() => import('./pages/app/Analyses'))
const Reports = lazy(() => import('./pages/app/Reports'))
const Settings = lazy(() => import('./pages/app/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RequireWorkspace({ children }: { children: ReactNode }) {
  const { ready, user, workspace } = useStore()
  const loc = useLocation()
  if (!ready) return <PageSkeleton />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (!workspace) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

// Old addresses still work: fill in route params, keep the query and hash, so
// a saved /app/findings?category=OUT_OF_SCOPE lands on the same filtered list.
function RedirectKeepingQuery({ to }: { to: string }) {
  const params = useParams()
  const { search, hash } = useLocation()
  const path = to.replace(/:(\w+)/g, (_, k: string) => encodeURIComponent(params[k] ?? ''))
  return <Navigate to={`${path}${search}${hash}`} replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/demo" element={<Demo />} />
      <Route path="/trust" element={<TrustCentre />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      {/* The security page is now the Trust Centre's first section. */}
      <Route path="/security" element={<Navigate to="/trust#security" replace />} />
      <Route path="/dpa" element={<Navigate to="/privacy#dpa" replace />} />
      <Route
        path="/app"
        element={
          <RequireWorkspace>
            <AppLayout />
          </RequireWorkspace>
        }
      >
        <Route index element={<Overview />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="opportunities/:id" element={<FindingDetail />} />
        <Route path="queue" element={<RecoveryQueue />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="contracts" element={<Contracts />} />
        <Route path="analyses" element={<Analyses />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="findings" element={<RedirectKeepingQuery to="/app/opportunities" />} />
        <Route path="findings/:id" element={<RedirectKeepingQuery to="/app/opportunities/:id" />} />
        <Route path="actions" element={<RedirectKeepingQuery to="/app/queue" />} />
        <Route path="data" element={<RedirectKeepingQuery to="/app/analyses" />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  )
}
