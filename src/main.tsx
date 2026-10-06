import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { StoreProvider } from './data/store'
import { ToastProvider } from './components/toast'
import { IS_PREVIEW } from './lib/env'

// The hosted preview has no server-side routing, so it keeps routes in memory
// and opens straight into the demo.
const Router = ({ children }: { children: ReactNode }) =>
  IS_PREVIEW ? <MemoryRouter initialEntries={['/demo']}>{children}</MemoryRouter> : <BrowserRouter>{children}</BrowserRouter>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <ToastProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </ToastProvider>
    </Router>
  </StrictMode>,
)
