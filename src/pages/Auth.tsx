import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useStore } from '../data/store'
import { Button, Field, TextLink, inputCls } from '../components/ui'
import { AuthShell, DemoProof, FormError } from './auth/AuthShell'

const EMAIL = /^\S+@\S+\.\S+$/

const WHAT_IT_DOES =
  'Headroom reads the exports your PSA, RMM and billing system already produce, then shows the out-of-scope work, unbilled time and agreement drift behind every pound.'

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
    if (!EMAIL.test(email)) return setError('Enter a valid email address.')
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
    if (!EMAIL.test(email)) return setError('Enter your email address first.')
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
      <AuthShell
        title="Check your email"
        subtitle={`We sent a sign-in link to ${email}.`}
        asideBody={WHAT_IT_DOES}
        aside={<DemoProof />}
        footer={
          <button
            type="button"
            className="text-small font-medium text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline"
            onClick={() => setMagicSent(false)}
          >
            Use a different email
          </button>
        }
      >
        <p className="flex items-start gap-2.5 rounded-md border border-line bg-sunken px-3.5 py-3 text-small text-ink-2">
          <Mail className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          Open the link on this device to sign in. It expires in an hour.
        </p>
      </AuthShell>
    )

  return (
    <AuthShell
      title="Sign in"
      subtitle="Your workspace, findings and reports are where you left them."
      asideBody={WHAT_IT_DOES}
      aside={<DemoProof />}
      footer={
        <>
          New here? <TextLink to="/signup">Create an account</TextLink> or <TextLink to="/demo">view the demo</TextLink>
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
        {error && <FormError>{error}</FormError>}
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
        {backend.supportsMagicLink && (
          <Button type="button" variant="secondary" className="w-full" onClick={magic} disabled={loading}>
            <Mail className="size-4" aria-hidden /> Email me a sign-in link
          </Button>
        )}
      </form>
    </AuthShell>
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
    if (!EMAIL.test(email)) return setError('Enter a valid email address.')
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
      <AuthShell
        title="Confirm your email"
        subtitle={`We sent a confirmation link to ${email}.`}
        asideBody={WHAT_IT_DOES}
        aside={<DemoProof />}
        footer={<TextLink to="/login">Back to sign in</TextLink>}
      >
        <p className="flex items-start gap-2.5 rounded-md border border-line bg-sunken px-3.5 py-3 text-small text-ink-2">
          <Mail className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          Open the link in that email, then sign in to set up your workspace.
        </p>
      </AuthShell>
    )

  return (
    <AuthShell
      title="Run a free revenue audit"
      subtitle="Upload a ticket export and a contract. No PSA integration or card needed."
      asideBody="Upload the exports you already have. Headroom checks every ticket, device and billing line against the agreement, then shows what you could be charging for."
      aside={<DemoProof />}
      footer={
        <>
          Already have an account? <TextLink to="/login">Sign in</TextLink>
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
        {error && <FormError>{error}</FormError>}
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
    </AuthShell>
  )
}
