import { useId, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../../data/store'
import { Button, Field, Modal, inputCls } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { parseNumber } from '../../../data/importers'
import { ICONS } from '../../../brand/icons'
import { GENERIC_ERROR, mapError } from '../../../lib/errors'

const EMPTY = { name: '', mrr: '', users: '', devices: '', pkg: '', included: '', software: '' }

export function AddClientModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { createClient, data } = useStore()
  const toast = useToast()
  const nav = useNavigate()
  const formId = useId()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    setError(null)
    if (!form.name.trim()) return setError('Enter the client name.')
    if (data.clients.some((c) => c.name.toLowerCase() === form.name.trim().toLowerCase())) return setError('A client with this name already exists.')
    const mrr = parseNumber(form.mrr)
    if (mrr == null || mrr < 0) return setError('Enter the monthly recurring revenue as a number.')
    for (const [k, label] of [['users', 'Contracted users'], ['devices', 'Contracted devices'], ['included', 'Included hours'], ['software', 'Software cost']] as const)
      if (form[k] && parseNumber(form[k]) == null) return setError(`${label} must be a number.`)
    setBusy(true)
    try {
      const c = await createClient({
        name: form.name,
        monthly_recurring_revenue: mrr,
        contracted_users: parseNumber(form.users),
        contracted_devices: parseNumber(form.devices),
        package: form.pkg.trim() || null,
        included_hours: parseNumber(form.included),
        monthly_software_cost: parseNumber(form.software),
      })
      setForm(EMPTY)
      onClose()
      if (onCreated) return onCreated(c.id)
      toast(`${c.name} added. Upload their tickets and contract on the Analyses page, then run the analysis again.`)
      nav(`/app/clients/${c.id}`)
    } catch (e) {
      const message = mapError(e, 'save')
      setError(message === GENERIC_ERROR ? "We couldn't save this client. Nothing was changed. Try again." : message)
    } finally {
      setBusy(false)
    }
  }
  const Alert = ICONS.alerts
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add client"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={busy}>
            Add client
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Client name">
              <input className={inputCls} value={form.name} onChange={set('name')} autoFocus autoComplete="organization" />
            </Field>
          </div>
          <Field label="Monthly recurring revenue (£)">
            <input className={`${inputCls} tnum`} inputMode="decimal" value={form.mrr} onChange={set('mrr')} placeholder="1500" />
          </Field>
          <Field label="Package">
            <input className={inputCls} value={form.pkg} onChange={set('pkg')} placeholder="Business Pro" />
          </Field>
          <Field label="Contracted users">
            <input className={`${inputCls} tnum`} inputMode="numeric" value={form.users} onChange={set('users')} />
          </Field>
          <Field label="Contracted devices">
            <input className={`${inputCls} tnum`} inputMode="numeric" value={form.devices} onChange={set('devices')} />
          </Field>
          <Field label="Included hours / month" hint="Only for block-hours agreements">
            <input className={`${inputCls} tnum`} inputMode="decimal" value={form.included} onChange={set('included')} />
          </Field>
          <Field label="Software cost / month (£)" hint="Your cost for tools and licences">
            <input className={`${inputCls} tnum`} inputMode="decimal" value={form.software} onChange={set('software')} />
          </Field>
        </div>
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-small text-danger">
            <Alert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
      </form>
    </Modal>
  )
}
