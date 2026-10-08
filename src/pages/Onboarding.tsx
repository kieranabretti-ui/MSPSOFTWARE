import { useId, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { DEFAULT_SETTINGS } from '../engine/types'
import { Button, Field, PageSkeleton, cx, inputCls } from '../components/ui'
import { mapError } from '../lib/errors'
import { AuthShell, FormError, NextSteps } from './auth/AuthShell'

// Two short steps: name the workspace, then the three rates every opportunity
// is valued with. The rates can be skipped; the defaults are sensible.
export default function Onboarding() {
  const { ready, user, workspace } = useStore()
  // The rates step is in the address, so a reload carries on with it.
  const [params, setParams] = useSearchParams()
  const [step, setStep] = useState<1 | 2>(params.get('step') === 'rates' ? 2 : 1)
  const [creating, setCreating] = useState(false)
  if (!ready) return <PageSkeleton />
  if (!user) return <Navigate to="/login" replace />
  // Someone who already has a workspace has nothing to set up. The workspace
  // step 1 is creating doesn't count: step 2 carries on here.
  if (workspace && step === 1 && !creating) return <Navigate to="/app" replace />
  // A reload on the rates step before any workspace exists starts from the name.
  return step === 1 || !workspace ? (
    <NameStep
      creating={creating}
      onCreating={setCreating}
      onCreated={() => {
        setStep(2)
        setCreating(false)
        setParams({ step: 'rates' }, { replace: true })
      }}
    />
  ) : (
    <RatesStep />
  )
}

function Progress({ step, next }: { step: 1 | 2; next?: string }) {
  return (
    <div className="border-t border-line-soft pt-5">
      <div className="flex items-center gap-2.5">
        <span className="flex shrink-0 gap-1" aria-hidden>
          <span className="h-1 w-7 rounded-full bg-ink" />
          <span className={cx('h-1 w-7 rounded-full', step === 2 ? 'bg-ink' : 'bg-line')} />
        </span>
        <span className="text-caption font-medium text-ink-2">
          Step {step} of 2{next && <span className="font-normal text-ink-3"> · Next: {next}</span>}
        </span>
      </div>
    </div>
  )
}

function NameStep({ creating, onCreating, onCreated }: { creating: boolean; onCreating: (v: boolean) => void; onCreated: () => void }) {
  const { createWorkspace, backend } = useStore()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (name.trim().length < 2) return setError('Enter your MSP’s name.')
    setError(null)
    onCreating(true)
    try {
      await createWorkspace(name.trim())
      onCreated()
    } catch (err) {
      setError(mapError(err, 'workspace'))
      onCreating(false)
    }
  }

  return (
    <AuthShell
      title="Create your MSP workspace"
      subtitle={
        backend.mode === 'supabase'
          ? 'Your clients, uploads and opportunities live here. Row-level security keeps them to this workspace.'
          : "Your clients, uploads and opportunities live here, in this browser only. It's an evaluation mode: use sample or anonymised data."
      }
      asideBody="One workspace per MSP. Name it, set your rates, then load the demo or your own exports and check the evidence behind each opportunity."
      aside={<NextSteps />}
      footer={<Progress step={1} next="your rates." />}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="MSP name" error={error} hint="Shown on your reports.">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Northlight IT" autoFocus />
        </Field>
        <Button type="submit" className="w-full" loading={creating}>
          Create workspace
        </Button>
      </form>
    </AuthShell>
  )
}

type RateKey = 'labour' | 'billable' | 'margin'
const RATES: { key: RateKey; label: string; hint: string; prefix?: string; suffix: string }[] = [
  { key: 'labour', label: 'Internal labour cost', hint: 'What an hour of technician time costs you, fully loaded.', prefix: '£', suffix: 'per hour' },
  { key: 'billable', label: 'Standard billable rate', hint: 'What you charge per hour for chargeable work.', prefix: '£', suffix: 'per hour' },
  { key: 'margin', label: 'Target gross margin', hint: 'Clients below this are flagged as underpriced.', suffix: '%' },
]

// A number with its unit drawn inside the control. Written out rather than
// wrapped in Field so the hint and error stay tied to the input itself.
function RateInput({ label, hint, prefix, suffix, value, error, onChange }: { label: string; hint: string; prefix?: string; suffix: string; value: string; error?: string; onChange: (v: string) => void }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-small font-medium text-ink-2">
        {label}
      </label>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-3">{prefix}</span>}
        <input
          id={id}
          className={cx(inputCls, 'tnum', prefix && 'pl-7', suffix.length > 2 ? 'pr-24' : 'pr-9', error && 'border-danger-line')}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${id}-note`}
          aria-invalid={error ? true : undefined}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-small text-ink-3">{suffix}</span>
      </div>
      <span id={`${id}-note`} className={cx('mt-1.5 block text-caption', error ? 'text-danger' : 'text-ink-3')}>
        {error ?? hint}
      </span>
    </div>
  )
}

function RatesStep() {
  const { workspace, updateSettings } = useStore()
  const nav = useNavigate()
  const s = { ...DEFAULT_SETTINGS, ...workspace?.settings }
  const [vals, setVals] = useState<Record<RateKey, string>>({
    labour: String(s.labour_cost_per_hour),
    billable: String(s.billable_rate_per_hour),
    margin: String(Math.round(s.target_margin * 100)),
  })
  const [errors, setErrors] = useState<Partial<Record<RateKey, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const n = (k: RateKey) => Number(vals[k].replace(/[£,%\s]/g, ''))
    const next: Partial<Record<RateKey, string>> = {}
    if (!(n('labour') > 0)) next.labour = 'Enter a cost above £0.'
    if (!(n('billable') > 0)) next.billable = 'Enter a rate above £0.'
    if (!(n('margin') >= 1 && n('margin') <= 90)) next.margin = 'Enter a margin between 1% and 90%.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setFormError(null)
    try {
      await updateSettings({ labour_cost_per_hour: n('labour'), billable_rate_per_hour: n('billable'), target_margin: n('margin') / 100 })
      nav('/app', { replace: true })
    } catch (err) {
      setFormError(mapError(err, 'settings'))
      setSaving(false)
    }
  }

  return (
    <AuthShell
      title="Your rates"
      subtitle="Headroom values time-based opportunities with these, and every calculation shows which rate it used. You can change them later in Settings."
      asideBody="Unbilled and out-of-scope time is valued at your billable rate. Client margins use your labour cost, and any client below your target margin is flagged as underpriced."
      aside={<NextSteps />}
      footer={<Progress step={2} />}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {RATES.map((r) => (
          <RateInput
            key={r.key}
            label={r.label}
            hint={r.hint}
            prefix={r.prefix}
            suffix={r.suffix}
            value={vals[r.key]}
            error={errors[r.key]}
            onChange={(v) => setVals({ ...vals, [r.key]: v })}
          />
        ))}
        {formError && <FormError>{formError}</FormError>}
        <div className="flex flex-col gap-2 pt-1">
          <Button type="submit" className="w-full" loading={saving}>
            Save and continue
          </Button>
          <Button type="button" variant="ghost" className="w-full" disabled={saving} onClick={() => nav('/app', { replace: true })}>
            Use these defaults
          </Button>
        </div>
      </form>
    </AuthShell>
  )
}
