import { useRef, useState, type DragEvent, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Check, CheckCircle2, ChevronDown, FileUp, Info, Loader2 } from 'lucide-react'
import { cx, inputCls } from '../../../components/ui'
import { ICONS } from '../../../brand/icons'

// Small primitives shared by Data, Actions and Settings. They live here, not in
// the shared kit, because only these pages use them so far.

// A native select with a drawn chevron and an optional leading mark (a status
// dot, say). It stays a real <select>, so labels, keyboard use and tests work.
export function Select({ className, lead, invalid, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { lead?: ReactNode; invalid?: boolean }) {
  return (
    <div className={cx('relative min-w-0', className)}>
      {lead && <span className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center">{lead}</span>}
      <select
        {...rest}
        aria-invalid={invalid || undefined}
        className={cx(inputCls, 'cursor-pointer appearance-none truncate pr-8', !!lead && 'pl-7', invalid && 'border-warning-line', rest.disabled && 'cursor-not-allowed')}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  )
}

// Inline messages. A full hairline in the tone, never a thick side stripe.
type CalloutTone = 'danger' | 'warning' | 'success' | 'info'
const CALLOUT: Record<CalloutTone, { box: string; icon: ReactNode }> = {
  danger: { box: 'border-danger-line bg-danger-soft text-danger', icon: <ICONS.alerts className="mt-0.5 size-4 shrink-0" aria-hidden /> },
  warning: { box: 'border-warning-line bg-warning-soft text-warning', icon: <ICONS.alerts className="mt-0.5 size-4 shrink-0" aria-hidden /> },
  success: { box: 'border-success-line bg-success-soft text-success', icon: <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> },
  info: { box: 'border-info-line bg-info-soft text-info', icon: <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> },
}

export function Callout({ tone, title, children, className, alert }: { tone: CalloutTone; title?: ReactNode; children?: ReactNode; className?: string; alert?: boolean }) {
  const t = CALLOUT[tone]
  return (
    <div role={alert ? 'alert' : undefined} className={cx('flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-small', t.box, className)}>
      {t.icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cx(!!title && 'mt-1 text-ink')}>{children}</div>}
      </div>
    </div>
  )
}

// A drop target that is also a keyboard-reachable button. The accent border
// appears only while a file is held over it.
export function Dropzone({ accept, onFile, label, hint, busy, busyLabel }: { accept: string; onFile: (f: File) => void; label: string; hint?: string; busy?: boolean; busyLabel?: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const browse = () => {
    if (!busy) ref.current?.click()
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    if (busy) return
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }
  return (
    <>
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy || undefined}
        aria-busy={busy || undefined}
        onClick={browse}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            browse()
          }
        }}
        onDragOver={(e) => {
          e.preventDefault()
          if (!over) setOver(true)
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
        }}
        onDrop={onDrop}
        className={cx(
          'flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-10 text-center transition-[border-color,background-color,box-shadow] duration-150 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-accent-soft',
          over ? 'border-accent bg-accent-soft ring-3 ring-accent-soft' : 'border-line-strong bg-sunken',
          busy ? 'cursor-progress' : !over && 'cursor-pointer hover:border-ink-4 hover:bg-hover',
        )}
      >
        <span className={cx('mb-4 flex size-10 items-center justify-center rounded-md border transition-colors duration-150', over ? 'border-accent-line bg-canvas text-accent' : 'border-line bg-raised text-ink-2')}>
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <FileUp className="size-5" aria-hidden />}
        </span>
        <p className="text-body font-medium text-ink">{busy ? (busyLabel ?? label) : over ? 'Drop to upload' : label}</p>
        <p className="mt-1 text-small text-ink-3">
          {busy ? 'This can take a few seconds for a long document.' : (
            <>
              Drag a file here, or <span className="font-medium text-ink-2 underline underline-offset-4">browse</span>
            </>
          )}
        </p>
        {hint && !busy && <p className="tnum mt-3 text-caption text-ink-3">{hint}</p>}
      </div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </>
  )
}

// Progress through a short, fixed sequence (the import flow). The numbers
// carry information here: where you are and what is left.
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Progress">
      {steps.map((s, i) => {
        const n = i + 1
        const done = current > n || (current === steps.length && n === steps.length)
        const here = current === n
        return (
          <li key={s} className="flex items-center gap-2" aria-current={here ? 'step' : undefined}>
            <span
              className={cx(
                'tnum flex size-5 items-center justify-center rounded-full text-[11px] font-semibold',
                done ? 'bg-success-soft text-success ring-1 ring-inset ring-success-line' : here ? 'bg-ink text-canvas' : 'text-ink-3 ring-1 ring-inset ring-line-strong',
              )}
            >
              {done ? <Check className="size-3" aria-hidden /> : n}
            </span>
            <span className={cx('text-small', here ? 'font-medium text-ink' : 'text-ink-3')}>{s}</span>
            {n < steps.length && <span className="mx-1 hidden h-px w-8 bg-line-strong sm:block" aria-hidden />}
          </li>
        )
      })}
    </ol>
  )
}
