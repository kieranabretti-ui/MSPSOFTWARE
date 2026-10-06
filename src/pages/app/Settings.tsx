import { useState } from 'react'
import { useStore, supabaseConfigured } from '../../data/store'
import { Badge, Button, Card, CardHeader, Field, PageHeader, inputCls } from '../../components/ui'
import { useToast } from '../../components/toast'
import { DEFAULT_SETTINGS, type WorkspaceSettings } from '../../engine/types'

type NumKey = Exclude<keyof WorkspaceSettings, 'currency' | 'business_hours_start' | 'business_hours_end'>
const FIELDS: { key: NumKey; label: string; hint: string; pct?: boolean; prefix?: string }[] = [
  { key: 'labour_cost_per_hour', label: 'Internal labour cost per hour', hint: 'Fully loaded technician cost. Used for client profitability.', prefix: '£' },
  { key: 'billable_rate_per_hour', label: 'Standard billable rate per hour', hint: 'Used to value out-of-scope work, unbilled time and overage.', prefix: '£' },
  { key: 'after_hours_multiplier', label: 'Out-of-hours multiplier', hint: 'e.g. 1.5 for time and a half.' },
  { key: 'default_user_price', label: 'Default price per user / month', hint: 'Used for agreement drift when no per-user billing line exists.', prefix: '£' },
  { key: 'default_device_price', label: 'Default price per device / month', hint: 'Used for device drift when no per-device billing line exists.', prefix: '£' },
  { key: 'default_software_cost_per_user', label: 'Default software cost per user / month', hint: 'Used when a client has no software cost recorded.', prefix: '£' },
  { key: 'target_margin', label: 'Target gross margin', hint: 'Clients below this are flagged as underpriced.', pct: true },
  { key: 'excessive_usage_threshold', label: 'Usage tolerance over included hours', hint: 'Usage above included hours plus this tolerance is flagged.', pct: true },
]

export default function Settings() {
  const { workspace, user, updateSettings, runAnalysis, analysis, backend } = useStore()
  const toast = useToast()
  const s = workspace!.settings
  const [name, setName] = useState(workspace!.name)
  const [vals, setVals] = useState<Record<string, string>>(() => ({
    ...Object.fromEntries(FIELDS.map((f) => [f.key, String(f.pct ? Math.round(s[f.key] * 100) : s[f.key])])),
    business_hours_start: s.business_hours_start,
    business_hours_end: s.business_hours_end,
  }))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setError(null)
    if (name.trim().length < 2) return setError('Workspace name is too short.')
    const patch: Partial<WorkspaceSettings> = {}
    for (const f of FIELDS) {
      const n = Number(vals[f.key])
      if (!Number.isFinite(n) || n < 0 || (f.pct && n > 100)) return setError(`${f.label} must be a valid number${f.pct ? ' between 0 and 100' : ''}.`)
      patch[f.key] = f.pct ? n / 100 : n
    }
    for (const k of ['business_hours_start', 'business_hours_end'] as const) {
      if (!/^\d{2}:\d{2}$/.test(vals[k])) return setError('Business hours must be in HH:MM format.')
      patch[k] = vals[k]
    }
    setSaving(true)
    try {
      await updateSettings(patch, name.trim())
      if (analysis) await runAnalysis()
      toast(analysis ? 'Settings saved and analysis re-run.' : 'Settings saved.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save settings.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Settings" subtitle="Assumptions the analysis uses. Changing them re-runs the analysis." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Workspace & analysis assumptions" />
          <div className="space-y-5 p-5">
            <Field label="Workspace name">
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <Field key={f.key} label={f.label + (f.pct ? ' (%)' : '')} hint={f.hint}>
                  <div className="relative">
                    {f.prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">{f.prefix}</span>}
                    <input className={`${inputCls} ${f.prefix ? 'pl-7' : ''}`} inputMode="decimal" value={vals[f.key]} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
                  </div>
                </Field>
              ))}
              <Field label="Support hours start" hint="Work outside contracted hours is valued at the out-of-hours rate.">
                <input className={inputCls} type="time" value={vals.business_hours_start} onChange={(e) => setVals({ ...vals, business_hours_start: e.target.value })} />
              </Field>
              <Field label="Support hours end">
                <input className={inputCls} type="time" value={vals.business_hours_end} onChange={(e) => setVals({ ...vals, business_hours_end: e.target.value })} />
              </Field>
            </div>
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} loading={saving}>
                Save{analysis ? ' and re-run analysis' : ''}
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setVals({
                    ...Object.fromEntries(FIELDS.map((f) => [f.key, String(f.pct ? Math.round(DEFAULT_SETTINGS[f.key] * 100) : DEFAULT_SETTINGS[f.key])])),
                    business_hours_start: DEFAULT_SETTINGS.business_hours_start,
                    business_hours_end: DEFAULT_SETTINGS.business_hours_end,
                  })
                }
              >
                Restore defaults
              </Button>
            </div>
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Account" />
            <div className="space-y-1 p-5 text-sm">
              <p className="font-medium">{user?.name}</p>
              <p className="text-zinc-500">{user?.email}</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Storage" />
            <div className="space-y-3 p-5 text-sm text-zinc-600">
              <div className="flex items-center justify-between">
                <span>Backend</span>
                {backend.mode === 'supabase' ? <Badge tone="green">Supabase</Badge> : <Badge tone="amber">This browser only</Badge>}
              </div>
              {backend.mode === 'local' && (
                <p className="text-xs text-zinc-500">
                  {supabaseConfigured
                    ? 'This is the demo sandbox. Sign out and create an account to keep data in your workspace.'
                    : 'Supabase is not configured for this deployment, so data stays in this browser. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable accounts and shared storage.'}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span>Integrations</span>
                <span className="text-xs text-zinc-500">PSA, RMM and accounting coming soon</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
