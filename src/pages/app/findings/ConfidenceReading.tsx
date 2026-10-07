import { ConfidenceLevel } from '../../../components/ConfidenceLevel'
import { Badge, TextLink } from '../../../components/ui'
import { confidenceOf } from '../../../lib/confidence'
import type { Finding } from '../../../engine/types'

// How sure the analysis is about one opportunity: the level in words, and the
// one line it rests on. Values modelled from the rates in Settings say so,
// with a way to change those rates. Never a percentage.
export function ConfidenceReading({ finding }: { finding: Pick<Finding, 'confidence' | 'meta'> }) {
  const c = confidenceOf(finding)
  return (
    <>
      <ConfidenceLevel level={c.level} />
      <p className="mt-2 text-small leading-relaxed text-ink-2">{c.basis}</p>
      {c.estimate && (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Badge>Estimate</Badge>
          <TextLink to="/app/settings">Change assumptions</TextLink>
        </p>
      )}
    </>
  )
}
