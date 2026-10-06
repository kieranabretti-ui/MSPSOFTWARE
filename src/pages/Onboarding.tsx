import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { Button, Field, inputCls, Spinner } from '../components/ui'
import { AuthShell, NextSteps } from './auth/AuthShell'

export default function Onboarding() {
  const { ready, user, workspace, createWorkspace } = useStore()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  if (!ready) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (workspace && !loading) return <Navigate to="/app" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Enter your MSP’s name.')
    setLoading(true)
    try {
      await createWorkspace(name)
      nav('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the workspace.')
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Create your MSP workspace"
      subtitle="Your clients, uploads and findings live here, isolated from every other workspace."
      asideBody="One workspace per MSP. Name it, then load the demo or your own exports and see where the money is going."
      aside={<NextSteps />}
      footer={
        <div className="flex items-center gap-3 border-t border-line-soft pt-5">
          <span className="flex shrink-0 gap-1" aria-hidden>
            <span className="h-1 w-6 rounded-full bg-ink" />
            <span className="h-1 w-6 rounded-full bg-line" />
          </span>
          <span className="text-caption text-ink-3">Step 1 of 2. Next: upload your exports or load the demo MSP.</span>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="MSP name" error={error} hint="Shown on your reports.">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northlight IT" autoFocus />
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          Create workspace
        </Button>
      </form>
    </AuthShell>
  )
}
