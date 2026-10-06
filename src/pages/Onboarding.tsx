import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { Button, Field, inputCls, Logo, Spinner } from '../components/ui'

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
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <Logo className="mb-8" />
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Step 1 of 2</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Create your MSP workspace</h1>
        <p className="mt-1 text-sm text-zinc-500">Your clients, uploads and findings live here, isolated from every other workspace.</p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <Field label="MSP name" error={error}>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northlight IT" autoFocus />
          </Field>
          <Button type="submit" className="w-full" loading={loading}>
            Create workspace
          </Button>
        </form>
        <p className="mt-4 text-xs text-zinc-500">Next you’ll upload data or load the demo MSP.</p>
      </div>
    </div>
  )
}
