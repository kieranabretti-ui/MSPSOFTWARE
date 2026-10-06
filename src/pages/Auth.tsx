import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useStore, supabaseConfigured } from '../data/store'
import { Button, Field, inputCls, Logo } from '../components/ui'

function Shell({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sunken px-4 py-12">
      <Link to="/" className="mb-8">
        <Logo />
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-body text-ink-3">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <div className="mt-6 text-body text-ink-3">{footer}</div>
      {!supabaseConfigured && (
        <p className="mt-6 max-w-sm text-center text-caption text-ink-3">Running in local mode: accounts and data are stored in this browser only.</p>
      )}
    </div>
  )
}

export function Login() {
  const { signIn, sendMagicLink, backend, user, workspace, ready } = useStore()
  const nav = useNavigate()
  const loc = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  if (ready && user) return <Navigate to={workspace ? ((loc.state as { from?: string } | null)?.from ?? '/app') : '/onboarding'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    if (!password) return setError('Enter your password.')
    setLoading(true)
    try {
      await signIn(email, password)
      nav('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  const magic = async () => {
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter your email address first.')
    setLoading(true)
    try {
      await sendMagicLink(email)
      setMagicSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the link.')
    } finally {
      setLoading(false)
    }
  }

  if (magicSent)
    return (
      <Shell title="Check your email" subtitle={`We sent a sign-in link to ${email}.`} footer={<button className="underline" onClick={() => setMagicSent(false)}>Use a different email</button>}>
        <div className="flex items-center gap-3 rounded-md bg-sunken p-4 text-body text-ink-2">
          <Mail className="size-5 text-ink-3" /> Open the link on this device to sign in.
        </div>
      </Shell>
    )

  return (
    <Shell
      title="Sign in"
      subtitle="Welcome back to Headroom."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-medium text-ink underline-offset-2 hover:underline">
            Create an account
          </Link>{' '}
          or{' '}
          <Link to="/demo" className="font-medium text-ink underline-offset-2 hover:underline">
            view the demo
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Work email">
          <input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourmsp.co.uk" />
        </Field>
        <Field label="Password">
          <input className={inputCls} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
        {backend.supportsMagicLink && (
          <Button type="button" variant="secondary" className="w-full" onClick={magic} disabled={loading}>
            <Mail className="size-4" /> Email me a sign-in link
          </Button>
        )}
      </form>
    </Shell>
  )
}

export function Signup() {
  const { signUp, user, ready } = useStore()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)
  if (ready && user && !loading) return <Navigate to="/onboarding" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Enter your name.')
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    setLoading(true)
    try {
      const r = await signUp(email, password, name)
      if (r.needsConfirmation) setConfirm(true)
      else nav('/onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed.')
    } finally {
      setLoading(false)
    }
  }

  if (confirm)
    return (
      <Shell title="Confirm your email" subtitle={`We sent a confirmation link to ${email}.`} footer={<Link to="/login" className="underline">Back to sign in</Link>}>
        <p className="text-body text-ink-2">Click the link in the email, then sign in to set up your workspace.</p>
      </Shell>
    )

  return (
    <Shell
      title="Run a free revenue audit"
      subtitle="Create your account. No PSA integration or card needed."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-ink underline-offset-2 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Your name">
          <input className={inputCls} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Work email">
          <input className={inputCls} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourmsp.co.uk" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input className={inputCls} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">{error}</p>}
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
    </Shell>
  )
}
