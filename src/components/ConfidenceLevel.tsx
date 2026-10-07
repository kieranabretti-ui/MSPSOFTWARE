import type { ConfidenceLevel as Level } from '../engine/types'
import { CONFIDENCE } from '../lib/labels'
import { cx } from './ui'

// Confidence as three marks and a word, in neutral ink: High fills all three,
// Low one. The word is always there, so the marks never carry meaning alone.
// The definition sits in the title. Used by the landing page, so it never
// imports the engine.
export function ConfidenceLevel({ level, short }: { level: Level; short?: boolean }) {
  const c = CONFIDENCE[level]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={c.definition}>
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className={cx('size-1.5 rounded-full', i < c.marks ? 'bg-ink-2' : 'bg-line-strong')} />
        ))}
      </span>
      <span className="text-caption font-medium text-ink-2">{short ? c.short : c.label}</span>
    </span>
  )
}
