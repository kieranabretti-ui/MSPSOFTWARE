import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { counted, useStore } from '../../data/store'
import { Badge, Button, Card, Field, PageHeader, TextLink, cx, inputCls } from '../../components/ui'
import { confidenceSplit } from '../../lib/confidence'
import { SPLIT_LABEL } from '../../lib/labels'
import { useToast } from '../../components/toast'
import { DEFAULT_SETTINGS, type WorkspaceSettings } from '../../engine/types'
import { mapError } from '../../lib/errors'
import { money } from '../../lib/format'
import { Callout } from './data/kit'
import { PlanBody } from './settings/PlanSection'
import { Section } from './settings/Section'
import { DataPrivacy } from './settings/DataPrivacy'
import { ActivityLog, TrustPanel } from './settings/Activity'
import { LoadFailed } from './overview/LoadFailed'

type NumKey = Exclude<keyof WorkspaceSettings, 'currency' | 'business_hours_start' | 'business_hours_end'>
type FieldDef = { key: NumKey; label: string; hint: string; pct?: boolean; prefix?: string; suffix?: string }

const FIELDS: FieldDef[] = [
  { key: 'labour_cost_per_hour', label: 'Internal labour cost', hint: 'Fully loaded technician cost. Used for client profitability.', prefix: '£', suffix: 'per hour' },
  { key: 'billable_rate_per_hour', label: 'Standard billable rate', hint: 'Used to value out-of-scope work, unbilled time and overage.', prefix: '£', suffix: 'per hour' },
  { key: 'after_hours_multiplier', label: 'Out-of-hours multiplier', hint: '1.5 for time and a half.' },
  { key: 'default_user_price', label: 'Default price per user', hint: 'Used for agreement drift when no per-user billing line exists.', prefix: '£', suffix: 'per month' },
  { key: 'default_device_price', label: 'Default price per device', hint: 'Used for device drift when no per-device billing line exists.', prefix: '£', suffix: 'per month' },
  { key: 'default_software_cost_per_user', label: 'Default software cost per user', hint: 'Used when a client has no software cost recorded.', prefix: '£', suffix: 'per month' },
  { key: 'target_margin', label: 'Target gross margin', hint: 'Clients below this are flagged as underpriced.', pct: true, suffix: '%' },
  { key: 'excessive_usage_threshold', label: 'Usage tolerance over included hours', hint: 'Usage above included hours plus this tolerance is flagged.', pct: true, suffix: '%' },
]
const byKey = (k: NumKey) => FIELDS.find((f) => f.key === k)!

const GROUPS: { title: string; body: string; keys: NumKey[] }[] = [
  { title: 'Rates', body: 'What an hour costs you, and what you charge for one. Every opportunity about time is valued with these.', keys: ['labour_cost_per_hour', 'billable_rate_per_hour', 'after_hours_multiplier'] },
  { title: 'Default prices', body: 'Used when a client has no matching billing line, so drift and licences can still be valued.', keys: ['default_user_price', 'default_device_price', 'default_software_cost_per_user'] },
  { title: 'Thresholds', body: 'How far a client can fall short, or run over, before it becomes an opportunity.', keys: ['target_margin', 'excessive_usage_threshold'] },
]

type ErrKey = NumKey | 'name' | 'hours'

// A number input with its unit drawn inside the control.
function UnitInput({ prefix, suffix, invalid, ...rest }: { prefix?: string; suffix?: string; invalid?: boolean; value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="relative max-w-[16rem]">
      {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-ink-3">{prefix}</span>}
      <input {...rest} className={cx(inputCls, 'tnum', !!prefix && 'pl-7', !!suffix && (suffix.length > 2 ? 'pr-24' : 'pr-9'), invalid && 'border-danger-line')} inputMode="decimal" aria-invalid={invalid || undefined} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-small text-ink-3">{suffix}</span>}
    </div>
  )
}

// Support hours as a 24-hour select of half-hour slots, styled like every other
// input. A saved time off the half hour stays selectable.
const SLOTS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

function TimeSelect({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const options = SLOTS.includes(value) || !value ? SLOTS : [...SLOTS, value].sort()
  return (
    <div className="relative max-w-[10rem]">
      <select
        className={cx(inputCls, 'tnum cursor-pointer appearance-none pr-9', invalid && 'border-danger-line')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
      >
        {options.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  )
}

export default function Settings() {
  const { workspace, user, updateSettings, runAnalysis, analysis, isDemoSession, data } = useStore()
  const toast = useToast()
  const s = workspace!.settings
  const initial = (): Record<string, string> => ({
    ...Object.fromEntries(FIELDS.map((f) => [f.key, String(f.pct ? Math.round(s[f.key] * 100) : s[f.key])])),
    business_hours_start: s.business_hours_start,
    business_hours_end: s.business_hours_end,
  })
  const [name, setName] = useState(workspace!.name)
  const [vals, setVals] = useState<Record<string, string>>(initial)
  const [error, setError] = useState<{ key: ErrKey; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  // The headline before the last re-run, so the result can say what moved:
  // High confidence on its own, then the labelled total.
  const split = confidenceSplit(data.findings.filter(counted))
  const [rerun, setRerun] = useState<{ high: number; total: number } | null>(null)
  const saved = initial()
  const dirty = name !== workspace!.name || Object.keys(saved).some((k) => saved[k] !== vals[k])

  const fail = (key: ErrKey, text: string) => setError({ key, text })

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setError(null)
    if (name.trim().length < 2) return fail('name', 'Workspace name is too short.')
    const patch: Partial<WorkspaceSettings> = {}
    for (const f of FIELDS) {
      const n = Number(vals[f.key])
      if (!Number.isFinite(n) || n < 0 || (f.pct && n > 100)) return fail(f.key, `${f.label} must be a valid number${f.pct ? ' between 0 and 100' : ''}.`)
      patch[f.key] = f.pct ? n / 100 : n
    }
    for (const k of ['business_hours_start', 'business_hours_end'] as const) {
      if (!/^\d{2}:\d{2}$/.test(vals[k])) return fail('hours', 'Business hours must be in HH:MM format.')
      patch[k] = vals[k]
    }
    if (vals.business_hours_start >= vals.business_hours_end) return fail('hours', 'Support hours must end after they start.')
    setSaving(true)
    setRerun(null)
    const before = { high: split.high.value, total: split.total.value }
    try {
      await updateSettings(patch, name.trim())
      if (analysis) {
        await runAnalysis({ source: 'settings' })
        setRerun(before)
      }
      toast(analysis ? 'Saved. The analysis has been re-run with your new rates.' : 'Saved. These apply the next time you run the analysis.')
    } catch (e) {
      toast(mapError(e, 'settings'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const restore = () =>
    setVals({
      ...Object.fromEntries(FIELDS.map((f) => [f.key, String(f.pct ? Math.round(DEFAULT_SETTINGS[f.key] * 100) : DEFAULT_SETTINGS[f.key])])),
      business_hours_start: DEFAULT_SETTINGS.business_hours_start,
      business_hours_end: DEFAULT_SETTINGS.business_hours_end,
    })

  const errFor = (k: ErrKey) => (error?.key === k ? error.text : null)
  const numField = (k: NumKey) => {
    const f = byKey(k)
    return (
      <Field key={k} label={f.label} hint={f.hint} error={errFor(k)}>
        <UnitInput prefix={f.prefix} suffix={f.suffix} invalid={!!errFor(k)} value={vals[k]} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />
      </Field>
    )
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="The assumptions the analysis uses, your plan, and how your data is stored, exported and deleted." />
      <LoadFailed />

      <div className="space-y-6">
        <Card>
          <form onSubmit={save} noValidate>
            <Section title="Workspace" body="The name on your reports and in the sidebar.">
              <div className="max-w-md">
                <Field label="Workspace name" error={errFor('name')}>
                  <input className={cx(inputCls, errFor('name') && 'border-danger-line')} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errFor('name') || undefined} autoComplete="organization" />
                </Field>
              </div>
            </Section>

            {GROUPS.map((g) => (
              <Section key={g.title} title={g.title} body={g.body}>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{g.keys.map(numField)}</div>
              </Section>
            ))}

            <Section title="Support hours" body="Work outside these hours is valued at the out-of-hours rate." last>
              <div className="grid grid-cols-2 gap-5 sm:max-w-md">
                <Field label="Start" error={errFor('hours')}>
                  <TimeSelect value={vals.business_hours_start} invalid={!!errFor('hours')} onChange={(v) => setVals({ ...vals, business_hours_start: v })} />
                </Field>
                <Field label="End">
                  <TimeSelect value={vals.business_hours_end} invalid={!!errFor('hours')} onChange={(v) => setVals({ ...vals, business_hours_end: v })} />
                </Field>
              </div>
            </Section>

            <div className="flex flex-col gap-3 rounded-b-lg border-t border-line bg-sunken px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0 text-small" aria-live="polite">
                {error ? (
                  <Callout tone="danger" className="py-1.5">
                    Fix the highlighted field, then save.
                  </Callout>
                ) : saving && analysis ? (
                  <span className="text-ink-2">Saving and re-running the analysis…</span>
                ) : dirty ? (
                  <span className="flex items-center gap-2 text-ink-2">
                    <span className="size-1.5 rounded-full bg-warning" aria-hidden /> Unsaved changes
                  </span>
                ) : rerun ? (
                  <span className="tnum text-ink-2">
                    Analysis re-run with these assumptions. {SPLIT_LABEL.high}: <span className="font-semibold text-ink">{money(split.high.value)}</span> (was {money(rerun.high)}). {SPLIT_LABEL.total}:{' '}
                    {money(split.total.value)} (was {money(rerun.total)}). <TextLink to="/app">View the overview</TextLink>
                  </span>
                ) : (
                  <span className="text-ink-3">{analysis ? 'Saving re-runs the analysis with these assumptions.' : 'These apply the next time you run the analysis.'}</span>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={restore}>
                  Restore defaults
                </Button>
                <Button type="submit" loading={saving}>
                  Save{analysis ? ' and re-run analysis' : ''}
                </Button>
              </div>
            </div>
          </form>
        </Card>

        <Card>
          <Section title="Plan" body="What this workspace is on, and the plans it can move to." last>
            <PlanBody isDemo={isDemoSession} />
          </Section>
        </Card>

        <Card>
          <Section title="Account" body="You are signed in as">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-line bg-raised text-small font-semibold text-ink-2" aria-hidden>
                {(user?.name ?? user?.email ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-body font-medium text-ink">{user?.name}</p>
                <p className="truncate text-small text-ink-3">{user?.email}</p>
              </div>
            </div>
          </Section>
          <Section title="Integrations" body="Direct connections to your tools." last>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-body text-ink-2">PSA, RMM and accounting</span>
                <Badge>Planned</Badge>
              </div>
              <p className="max-w-[68ch] text-small text-ink-3">
                Until then, upload the CSV exports you already have. <TextLink to="/app/analyses">Go to Analyses</TextLink>
              </p>
            </div>
          </Section>
        </Card>

        <div>
          <h2 className="mb-3 text-label font-semibold uppercase text-ink-3">Data and privacy</h2>
          <Card>
            <DataPrivacy />
          </Card>
        </div>

        <Card>
          <TrustPanel />
          <ActivityLog />
        </Card>
      </div>
    </>
  )
}
