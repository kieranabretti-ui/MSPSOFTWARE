import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { lazy, Suspense, type ReactNode } from 'react'
import { useStore } from './data/store'
import { Spinner } from './components/ui'
const Landing = lazy(() => import('./pages/Landing'))
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Signup })))
const Onboarding = lazy(() => import('./pages/Onboarding'))
const Demo = lazy(() => import('./pages/Demo'))
const AppLayout = lazy(() => import('./components/AppLayout'))
const Overview = lazy(() => import('./pages/app/Overview'))
const Findings = lazy(() => import('./pages/app/Findings'))
const FindingDetail = lazy(() => import('./pages/app/FindingDetail'))
const Clients = lazy(() => import('./pages/app/Clients'))
const ClientDetail = lazy(() => import('./pages/app/ClientDetail'))
const Reports = lazy(() => import('./pages/app/Reports'))
const DataPage = lazy(() => import('./pages/app/Data'))
const Actions = lazy(() => import('./pages/app/Actions'))
const Settings = lazy(() => import('./pages/app/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

function RequireWorkspace({ children }: { children: ReactNode }) {
  const { ready, user, workspace } = useStore()
  const loc = useLocation()
  if (!ready) return <Spinner />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (!workspace) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/demo" element={<Demo />} />
      <Route
        path="/app"
        element={
          <RequireWorkspace>
            <AppLayout />
          </RequireWorkspace>
        }
      >
        <Route index element={<Overview />} />
        <Route path="findings" element={<Findings />} />
        <Route path="findings/:id" element={<FindingDetail />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="data" element={<DataPage />} />
        <Route path="actions" element={<Actions />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  )
}
