import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { DOWNLOAD_BLOCKED } from '../lib/format'

interface Toast {
  id: number
  text: string
  tone: 'ok' | 'error'
}
const Ctx = createContext<(text: string, tone?: 'ok' | 'error') => void>(() => undefined)
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3500)
  }, [])
  useEffect(() => {
    const blocked = () => push('Downloads are turned off in this hosted preview. Run MSP Leak locally to download files.', 'error')
    window.addEventListener(DOWNLOAD_BLOCKED, blocked)
    return () => window.removeEventListener(DOWNLOAD_BLOCKED, blocked)
  }, [push])
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-4 sm:translate-x-0" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-start gap-2.5 rounded-xl bg-zinc-900 px-4 py-3 text-sm text-white shadow-lg">
            {t.tone === 'ok' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" /> : <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
