import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { useStore } from '../data/store'
import { Button, Field, TextLink, inputCls } from '../components/ui'
import { mapError } from '../lib/errors'
import { track } from '../lib/track'
import { AuthShell, DemoProof, FormError } from './auth/AuthShell'

const EMAIL = /^\S+@\S+\.\S+$/

const WHAT_IT_DOES =
  'Headroom reads the exports your PSA, RMM and billing system already produce, then shows the out-of-scope work, unbilled work and agreement drift behind every pound.'

// The planned tiers a pricing button can carry through to sign-up.
const PLAN_NAMES: Record<string, string> = { starter: 'Starter', growth: 'Growth', pro: 'Pro' }

function useTitle(title: string) {
  useEffect(() => {
    const before = document.title
    document.title = `${title} · Headroom`
    return () => {
      document.title = before
    }
  }, [title])
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
  useTitle('Sign in')
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
      setError(mapError(err, 'signin'))
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
      setError(mapError(err, 'magic_link'))
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
      subtitle="Your workspace, opportunities and reports are where you left them."
      asideBody={WHAT_IT_DOES}
      aside={<DemoProof />}
      footer={
        <>
          New here? <TextLink to="/signup">Create an account</TextLink> or <TextLink to="/demo">explore the demo</TextLink>
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
  const { signUp, signOut, user, ready, isDemoSession } = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const intent = params.get('intent') ?? undefined
  const plan = params.get('plan') ?? undefined
  const planName = plan ? PLAN_NAMES[plan] : undefined
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [confirm, setConfirm] = useState(false)
  useTitle('Create account')
  // Someone in the demo keeps their place here: the account starts once they choose to end it.
  if (ready && user && !loading && !isDemoSession) return <Navigate to="/onboarding" replace />

  const endDemo = async () => {
    setError(null)
    setLeaving(true)
    try {
      await signOut()
    } catch (err) {
      setError(mapError(err, 'signout'))
    } finally {
      setLeaving(false)
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!name.trim()) return setError('Enter your name.')
    if (!EMAIL.test(email)) return setError('Enter a valid email address.')
    if (password.length < 8) return setError('Use at least 8 characters for your password.')
    setLoading(true)
    try {
      const r = await signUp(email, password, name, intent ? { intent } : undefined)
      if (intent === 'audit') track('audit_request', planName ? { plan: plan! } : {})
      if (r.needsConfirmation) setConfirm(true)
      else nav('/onboarding')
    } catch (err) {
      setError(mapError(err, 'signup'))
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
      title="Get your free revenue leakage audit"
      subtitle="Start with your client list (MRR, users and devices) and a ticket export. No PSA integration or card needed."
      asideBody="Upload the exports you already have. Headroom checks every ticket, device and billing line against the agreement, then shows what you could be charging for."
      aside={<DemoProof />}
      footer={
        isDemoSession ? undefined : (
          <>
            Already have an account? <TextLink to="/login">Sign in</TextLink>
          </>
        )
      }
    >
      {isDemoSession ? (
        <div className="space-y-4">
          <p className="rounded-md border border-line bg-sunken px-3.5 py-3 text-small text-ink-2">You're in the demo. Creating an account ends the demo.</p>
          {error && <FormError>{error}</FormError>}
          <Button className="w-full" loading={leaving} onClick={endDemo}>
            End the demo and create an account
          </Button>
          <p className="text-small text-ink-3">
            Or <TextLink to="/app">go back to the demo</TextLink>.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {planName && <p className="text-small text-ink-3">You picked {planName}. Pricing isn't live yet, so nothing is charged.</p>}
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
      )}
    </AuthShell>
  )
}
