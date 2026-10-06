import { BRAND } from './brand'

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

// The symbol. Placeholder until the logo system lands.
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cx('size-6 shrink-0', className)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <rect width="32" height="32" rx="8" fill="var(--brand-secondary)" />
      <rect x="8" y="9" width="16" height="4" rx="1" fill="var(--brand-primary)" />
      <rect x="8" y="19" width="9" height="4" rx="1" fill="var(--brand-primary)" />
      <rect x="19" y="19" width="5" height="4" rx="1" fill="var(--brand-accent)" stroke="var(--brand-primary)" strokeWidth="1.2" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-2.5 text-[15px] font-semibold tracking-[-0.02em] text-ink', className)}>
      <LogoMark />
      {BRAND.name}
    </span>
  )
}
