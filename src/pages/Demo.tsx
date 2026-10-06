import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useStore } from '../data/store'
import { Button, Logo } from '../components/ui'

// One click from the landing page into a fully populated sandbox.
export default function Demo() {
  const { startDemo } = useStore()
  const nav = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    startDemo()
      .then(() => nav('/app', { replace: true }))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the demo.'))
  }, [startDemo, nav])
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-sunken px-4 text-center">
      <Logo />
      {error ? (
        <>
          <p className="max-w-sm text-body text-danger">{error}</p>
          <Button onClick={() => location.reload()}>Try again</Button>
        </>
      ) : (
        <div className="flex items-center gap-2 text-body text-ink-2">
          <Loader2 className="size-4 animate-spin" /> Loading the demo MSP and running the analysis…
        </div>
      )}
    </div>
  )
}
