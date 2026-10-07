import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactElement, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, X } from 'lucide-react'
import type { Health, Severity } from '../engine/types'
import { HEALTH } from '../lib/labels'
export { Logo, LogoMark } from '../brand/Logo'

export const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

// Buttons. Primary is bone on ink; the lime accent is kept for the one action
// on a screen that leads to money (find, recover, run).
type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger'
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-canvas hover:bg-white',
  accent: 'bg-accent text-accent-ink hover:bg-accent-hover',
  secondary: 'bg-raised text-ink border border-line hover:border-line-strong hover:bg-hover',
  ghost: 'text-ink-2 hover:text-ink hover:bg-raised',
  danger: 'bg-danger-soft text-danger border border-danger-line hover:bg-danger/20',
}
type Size = 'sm' | 'md' | 'lg'
const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-small gap-1.5',
  md: 'h-9 px-4 text-body gap-2',
  lg: 'h-11 px-5 text-[15px] gap-2',
}
const buttonBase =
  'inline-flex items-center justify-center rounded-md font-medium whitespace-nowrap [&>svg]:shrink-0 transition-[background-color,border-color,color,box-shadow] duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-45'

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button {...rest} disabled={rest.disabled || loading} aria-busy={loading || undefined} className={cx(buttonBase, SIZES[size], VARIANTS[variant], className)}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function ButtonLink({ to, variant = 'primary', size = 'md', className, onClick, children }: { to: string; variant?: Variant; size?: Size; className?: string; onClick?: () => void; children: ReactNode }) {
  return (
    <Link to={to} onClick={onClick} className={cx(buttonBase, SIZES[size], VARIANTS[variant], className)}>
      {children}
    </Link>
  )
}

// Containers
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-lg border border-line bg-surface', className)}>{children}</div>
}

// The heading level follows the page outline (h2 under the page's h1, h3 when
// the card sits inside a section); the visual size stays the same.
export function CardHeader({ title, subtitle, right, as: Heading = 'h2' }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; as?: 'h2' | 'h3' }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
      <div className="min-w-0">
        <Heading className="text-h3 text-ink">{title}</Heading>
        {subtitle && <p className="mt-0.5 text-small text-ink-3">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-h1 text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 text-body text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

// A text link in the product's voice: quiet until hovered.
export function TextLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cx('text-small font-medium text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline', className)}>
      {children}
    </Link>
  )
}

// Money and other headline figures. Tabular, tight, and bone unless the figure
// is money recovered or recoverable, which may take the accent.
export function Figure({ children, size = 'lg', tone = 'default', className, testId }: { children: ReactNode; size?: 'xl' | 'lg' | 'md'; tone?: 'default' | 'accent' | 'muted'; className?: string; testId?: string }) {
  return (
    <span
      data-testid={testId}
      className={cx(
        'tnum',
        size === 'xl' ? 'text-[clamp(3rem,7vw,var(--type-data-xl))] font-semibold leading-[0.95] tracking-[-0.045em]' : size === 'lg' ? 'text-data-lg' : 'text-data-md',
        tone === 'accent' ? 'text-accent' : tone === 'muted' ? 'text-ink-2' : 'text-ink',
        className,
      )}
    >
      {children}
    </span>
  )
}

// Severity: a plain label plus a bar count, never a pill, so a column of
// findings stays calm. Only Critical takes colour, and only in its bars.
const SEV: Record<Severity, { label: string; text: string; bar: string; bars: number }> = {
  CRITICAL: { label: 'Critical', text: 'text-ink', bar: 'bg-danger', bars: 3 },
  HIGH: { label: 'High', text: 'text-ink-2', bar: 'bg-ink-2', bars: 2 },
  MEDIUM: { label: 'Medium', text: 'text-ink-2', bar: 'bg-ink-3', bars: 1 },
  LOW: { label: 'Low', text: 'text-ink-3', bar: 'bg-ink-3', bars: 0 },
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEV[severity]
  return (
    <span className={cx('inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap text-caption font-medium', s.text)}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cx('w-[2px] rounded-full', i < s.bars ? s.bar : 'bg-line-strong')} style={{ height: 4 + i * 2 }} />
        ))}
      </span>
      {s.label}
    </span>
  )
}

export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
const TONES: Record<Tone, string> = {
  neutral: 'bg-raised text-ink-2 ring-line',
  accent: 'bg-accent-soft text-accent ring-accent-line',
  success: 'bg-success-soft text-success ring-success-line',
  warning: 'bg-warning-soft text-warning ring-warning-line',
  danger: 'bg-danger-soft text-danger ring-danger-line',
  info: 'bg-info-soft text-info ring-info-line',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={cx('inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-xs px-1.5 text-[11px] font-medium ring-1 ring-inset', TONES[tone])}>{children}</span>
}

export function Confidence({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const tone = value >= 85 ? 'bg-ink' : value >= 70 ? 'bg-ink-3' : 'bg-ink-4'
  return (
    <span className="inline-flex items-center gap-2" title={`Confidence ${value}%`}>
      <span className="h-1 w-12 overflow-hidden rounded-full bg-line">
        <span className={cx('block h-full rounded-full', tone)} style={{ width: `${value}%` }} />
      </span>
      {showLabel && <span className="tnum text-caption text-ink-2">{value}%</span>}
    </span>
  )
}

// Client health, kept calm: a neutral label, with the one danger dot reserved
// for At risk. The mark keeps its slot when empty so labels line up in a column.
export function HealthDot({ health, withLabel = true }: { health: Health; withLabel?: boolean }) {
  const h = HEALTH[health]
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-caption font-medium', h.text)}>
      <span className={cx('size-1.5 shrink-0 rounded-full', h.dot)} aria-hidden />
      {withLabel ? h.label : <span className="sr-only">{h.label}</span>}
    </span>
  )
}

// An empty or no-match state in the ledger voice: left-aligned, a title, one
// line of explanation and at most a couple of actions. No icon tile.
export function EmptyState({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <div className="px-5 py-10 sm:px-6">
      <h3 className="text-h3 text-ink">{title}</h3>
      <p className="mt-1.5 max-w-[60ch] text-body text-ink-3">{body}</p>
      {action && <div className="mt-5 flex flex-wrap gap-2">{action}</div>}
    </div>
  )
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
export const focusables = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0)

// Keeps Tab and Shift+Tab cycling inside root, for modal surfaces.
export function trapTab(e: KeyboardEvent, root: HTMLElement) {
  if (e.key !== 'Tab') return
  const els = focusables(root)
  if (!els.length) return e.preventDefault()
  const i = els.indexOf(document.activeElement as HTMLElement)
  if (e.shiftKey && i <= 0) {
    e.preventDefault()
    els[els.length - 1].focus()
  } else if (!e.shiftKey && (i === -1 || i === els.length - 1)) {
    e.preventDefault()
    els[0].focus()
  }
}

// A modal dialog: focus moves in when it opens, Tab stays inside, Escape
// closes, and focus goes back to whatever opened it.
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  // Note the opener while rendering the open, before a field inside the dialog
  // can take focus with autoFocus.
  const [shown, setShown] = useState(false)
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  if (open !== shown) {
    setShown(open)
    setOpener(open && document.activeElement instanceof HTMLElement ? document.activeElement : null)
  }

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (dialog && !dialog.contains(document.activeElement)) ((bodyRef.current && focusables(bodyRef.current)[0]) || titleRef.current)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closeRef.current()
        return
      }
      if (dialog) trapTab(e, dialog)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [open, opener])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--brand-overlay)] p-0 backdrop-blur-[3px] sm:items-center sm:p-6" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx('elevate-3 max-h-[92vh] w-full overflow-y-auto rounded-t-xl border border-line bg-surface sm:rounded-xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="text-h3 text-ink focus:outline-none">
            {title}
          </h2>
          <button onClick={onClose} className="-my-2.5 -mr-2.5 flex size-11 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-raised hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        <div ref={bodyRef} className="px-5 py-5">
          {children}
        </div>
        {footer && <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

// A labelled control. The label wraps the control so it names it; the hint or
// error sits outside the label and is tied to a single input, select or
// textarea with aria-describedby, so it is read as a description, not the name.
export function Field({ label, hint, children, error }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = error ? errorId : hint ? hintId : undefined
  let control = children
  if (Children.count(children) === 1 && isValidElement(children) && (children.type === 'input' || children.type === 'select' || children.type === 'textarea')) {
    const el = children as ReactElement<{ 'aria-describedby'?: string; 'aria-invalid'?: boolean | 'true' | 'false' }>
    control = cloneElement(el, {
      'aria-describedby': [el.props['aria-describedby'], describedBy].filter(Boolean).join(' ') || undefined,
      'aria-invalid': error ? true : el.props['aria-invalid'],
    })
  }
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-small font-medium text-ink-2">{label}</span>
        {control}
      </label>
      {hint && !error && (
        <span id={hintId} className="mt-1.5 block text-caption text-ink-3">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} className="mt-1.5 block text-caption text-danger">
          {error}
        </span>
      )}
    </div>
  )
}

export const inputCls =
  'block w-full h-9 rounded-md border border-line-strong bg-sunken px-3 text-body text-ink placeholder:text-ink-3 transition-[border-color,box-shadow] duration-150 hover:border-ink-4 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-line disabled:opacity-50'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-20 text-body text-ink-3" role="status">
      <Loader2 className="size-4 animate-spin text-accent" />
      {label ?? 'Loading…'}
    </div>
  )
}

// The loading state for a whole page: the shape of a page, no words on screen.
export function PageSkeleton() {
  return (
    <div className="min-h-dvh bg-canvas px-4 py-7 sm:px-8 sm:py-10" role="status" aria-busy="true">
      <span className="sr-only">Loading Headroom</span>
      <div className="mx-auto max-w-[1200px] space-y-4" aria-hidden>
        <div className="h-8 w-56 max-w-full rounded-md bg-raised motion-safe:animate-pulse" />
        <div className="h-40 rounded-lg bg-raised motion-safe:animate-pulse" />
        <div className="h-64 rounded-lg bg-raised motion-safe:animate-pulse" />
      </div>
    </div>
  )
}

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cx('text-caption text-ink-3', className)}>
      Figures are estimates of potential revenue based on the data provided. They are not guaranteed to be recoverable and should be reviewed before acting.
    </p>
  )
}
