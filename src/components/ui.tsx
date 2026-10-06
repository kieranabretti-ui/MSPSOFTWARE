import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import type { Severity } from '../engine/types'
import { HEALTH } from '../lib/labels'
import type { Health } from '../engine/types'

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm',
  secondary: 'bg-white text-zinc-900 border border-zinc-200 hover:bg-zinc-50 shadow-xs',
  ghost: 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100',
  danger: 'bg-white text-red-700 border border-red-200 hover:bg-red-50',
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : size === 'lg' ? 'h-11 px-5 text-[15px]' : 'h-9 px-4 text-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant = 'primary', size = 'md', className, children }: { to: string; variant?: Variant; size?: 'sm' | 'md' | 'lg'; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors whitespace-nowrap',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : size === 'lg' ? 'h-11 px-5 text-[15px]' : 'h-9 px-4 text-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-xl border border-zinc-200 bg-white', className)}>{children}</div>
}

export function CardHeader({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
      <div>
        <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-zinc-500">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

const SEV: Record<Severity, string> = {
  CRITICAL: 'bg-red-50 text-red-700 ring-red-200',
  HIGH: 'bg-orange-50 text-orange-700 ring-orange-200',
  MEDIUM: 'bg-amber-50 text-amber-800 ring-amber-200',
  LOW: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={cx('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold tracking-wide ring-1 ring-inset', SEV[severity])}>{severity}</span>
}

export function Badge({ children, tone = 'zinc' }: { children: ReactNode; tone?: 'zinc' | 'green' | 'amber' | 'red' | 'blue' | 'orange' }) {
  const tones = {
    zinc: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    red: 'bg-red-50 text-red-700 ring-red-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
    orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', tones[tone])}>{children}</span>
}

export function Confidence({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const tone = value >= 85 ? 'bg-zinc-900' : value >= 70 ? 'bg-zinc-600' : 'bg-zinc-400'
  return (
    <span className="inline-flex items-center gap-2" title={`Confidence ${value}%`}>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-zinc-200">
        <span className={cx('block h-full rounded-full', tone)} style={{ width: `${value}%` }} />
      </span>
      {showLabel && <span className="tnum text-xs text-zinc-600">{value}%</span>}
    </span>
  )
}

export function HealthDot({ health, withLabel = true }: { health: Health; withLabel?: boolean }) {
  const h = HEALTH[health]
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs font-medium', h.text)}>
      <span className={cx('size-2 rounded-full', h.dot)} aria-hidden />
      {withLabel ? h.label : <span className="sr-only">{h.label}</span>}
    </span>
  )
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 shadow-xs">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-zinc-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-zinc-500">{body}</p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal aria-label={title} className={cx('max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function Field({ label, hint, children, error }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-zinc-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
}

export const inputCls =
  'block w-full h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 shadow-xs focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-20 text-sm text-zinc-500">
      <Loader2 className="size-4 animate-spin" />
      {label ?? 'Loading…'}
    </div>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-semibold tracking-tight text-zinc-900', className)}>
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden>
        <rect width="32" height="32" rx="8" fill="#18181b" />
        <path d="M16 7c3.6 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.4-6.4 6-11z" fill="#f97316" />
      </svg>
      MSP Leak
    </span>
  )
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cx('text-xs text-zinc-500', className)}>
      Figures are estimates of potential revenue based on the data provided. They are not guaranteed to be recoverable and should be reviewed before acting.
    </p>
  )
}
