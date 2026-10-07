import { BRAND } from './brand'
import { color } from './tokens'

const cx = (...xs: (string | false | null | undefined)[]) => xs.filter(Boolean).join(' ')

// The mark: a solid square whose top-right quarter has been lifted clear, in
// lime. The missing piece, found, and raised into the headroom above.
// Drawn on a 32-unit grid: the square spans 6–26 × 8–28, the notch is cut one
// 2-unit channel wider than the piece, and the piece is lifted 4 units. Every
// edge lands on a whole pixel at 16px. brand/logo/*.svg use the same paths.
export const MARK_BODY = 'M9 8H13A1 1 0 0 1 14 9V19A1 1 0 0 0 15 20H25A1 1 0 0 1 26 21V25A3 3 0 0 1 23 28H9A3 3 0 0 1 6 25V11A3 3 0 0 1 9 8Z'
export const MARK_PIECE = 'M17 4H23A3 3 0 0 1 26 7V13A1 1 0 0 1 25 14H17A1 1 0 0 1 16 13V5A1 1 0 0 1 17 4Z'

// Bare mark on the 20 × 24 content box, coloured by --brand-mark tokens so it
// flips to ink and deep lime on paper. `tile` draws the app-icon version: the
// mark on an ink tile, the same in every context. `mono` drops the lime.
export function LogoMark({ className, title, tile = false, mono = false }: { className?: string; title?: string; tile?: boolean; mono?: boolean }) {
  const body = tile ? color.bone : 'var(--brand-mark)'
  const piece = mono ? body : tile ? color.accent : 'var(--brand-mark-accent)'
  return (
    <svg
      viewBox={tile ? '0 0 32 32' : '6 4 20 24'}
      className={cx('shrink-0', tile ? 'size-6' : 'h-6 w-5', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {tile && <rect width="32" height="32" rx="7" fill={color.ink} />}
      <path d={MARK_BODY} fill={body} />
      <path d={MARK_PIECE} fill={piece} />
    </svg>
  )
}

// The lockup: the mark is 1em tall and sits on the wordmark's baseline, so the
// body stands level with the ascenders and the lime piece rises above them.
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-flex items-baseline gap-[0.3em] text-[15px] font-semibold tracking-[-0.02em] text-ink', className)}>
      <LogoMark className="h-[1em] w-auto self-baseline" />
      {BRAND.name}
    </span>
  )
}
