import { useState } from 'react'
import { useStore } from '../../../data/store'
import { Button } from '../../../components/ui'
import { Callout } from '../data/kit'

// The workspace couldn't be loaded: say so, and offer the retry. Every page
// shows this before any empty state, so a failed load never reads as "nothing
// found".
export function LoadFailed({ className = 'mb-6' }: { className?: string }) {
  const { loadError, reload } = useStore()
  const [retrying, setRetrying] = useState(false)
  if (!loadError) return null
  return (
    <Callout tone="danger" alert className={className}>
      <p>{loadError}</p>
      <p className="mt-1 text-ink-3">Nothing below reflects your saved data until it loads.</p>
      <Button
        size="sm"
        variant="secondary"
        className="mt-2.5"
        loading={retrying}
        onClick={async () => {
          setRetrying(true)
          await reload()
          setRetrying(false)
        }}
      >
        Try again
      </Button>
    </Callout>
  )
}
