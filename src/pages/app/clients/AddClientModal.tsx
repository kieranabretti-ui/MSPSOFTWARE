import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../../../data/store'
import { Button, Field, Modal, cx, inputCls } from '../../../components/ui'
import { useToast } from '../../../components/toast'
import { parseNumber } from '../../../data/importers'
import { ICONS } from '../../../brand/icons'
import { GENERIC_ERROR, mapError } from '../../../lib/errors'

const EMPTY = { name: '', mrr: '', users: '', devices: '', pkg: '', included: '', software: '' }
type Key = keyof typeof EMPTY
const ORDER: Key[] = ['name', 'mrr', 'pkg', 'users', 'devices', 'included', 'software']

export function AddClientModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { createClient, data } = useStore()
  const toast = useToast()
  const nav = useNavigate()
  const formId = useId()
  const [form, setForm] = useState(EMPTY)
  // A save that fails; field checks sit under their own field.
  const [error, setError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({})
  const refs = useRef<Partial<Record<Key, HTMLInputElement | null>>>({})
  const [busy, setBusy] = useState(false)
  const set = (k: Key) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [k]: e.target.value })
    if (errors[k]) setErrors({ ...errors, [k]: undefined })
  }
  const input = (k: Key) => ({ ref: (el: HTMLInputElement | null) => void (refs.current[k] = el), value: form[k], onChange: set(k), className: cx(inputCls, errors[k] && 'border-danger-line') })
  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy) return
    setError(null)
    const errs: Partial<Record<Key, string>> = {}
    if (!form.name.trim()) errs.name = 'Enter the client name.'
    else if (data.clients.some((c) => c.name.toLowerCase() === form.name.trim().toLowerCase())) errs.name = 'A client with this name already exists.'
    const mrr = parseNumber(form.mrr)
    if (mrr == null || mrr < 0) errs.mrr = 'Enter the monthly recurring revenue as a number.'
    for (const [k, label] of [['users', 'Contracted users'], ['devices', 'Contracted devices'], ['included', 'Included hours'], ['software', 'Software cost']] as const)
      if (form[k] && parseNumber(form[k]) == null) errs[k] = `${label} must be a number.`
    setErrors(errs)
    const first = ORDER.find((k) => errs[k])
    if (first || mrr == null) {
      if (first) refs.current[first]?.focus()
      return
    }
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
            <Field label="Client name" error={errors.name}>
              <input {...input('name')} autoFocus autoComplete="organization" />
            </Field>
          </div>
          <Field label="Monthly recurring revenue (£)" error={errors.mrr}>
            <input {...input('mrr')} className={cx(input('mrr').className, 'tnum')} inputMode="decimal" placeholder="1500" />
          </Field>
          <Field label="Package">
            <input {...input('pkg')} placeholder="Business Pro" />
          </Field>
          <Field label="Contracted users" error={errors.users}>
            <input {...input('users')} className={cx(input('users').className, 'tnum')} inputMode="numeric" />
          </Field>
          <Field label="Contracted devices" error={errors.devices}>
            <input {...input('devices')} className={cx(input('devices').className, 'tnum')} inputMode="numeric" />
          </Field>
          <Field label="Included hours / month" hint="Only for block-hours agreements" error={errors.included}>
            <input {...input('included')} className={cx(input('included').className, 'tnum')} inputMode="decimal" />
          </Field>
          <Field label="Software cost / month (£)" hint="Your cost for tools and licences" error={errors.software}>
            <input {...input('software')} className={cx(input('software').className, 'tnum')} inputMode="decimal" />
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
