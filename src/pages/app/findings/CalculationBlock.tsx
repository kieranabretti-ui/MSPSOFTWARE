import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../../../data/store'
import { formatCalculation } from '../../../lib/calculation'
import type { Finding } from '../../../engine/types'

const link = 'font-medium text-ink underline decoration-ink-4 underline-offset-4 transition-colors hover:decoration-ink'

// Links to other opportunities, as "A", "A and B" or "A, B and C".
function OpportunityLinks({ findings }: { findings: Finding[] }) {
  return (
    <>
      {findings.map((o, i) => (
        <Fragment key={o.id}>
          {i > 0 && (i === findings.length - 1 ? ' and ' : ', ')}
          <Link to={`/app/opportunities/${o.id}`} className={link}>
            {o.title}
          </Link>
        </Fragment>
      ))}
    </>
  )
}

// The sum behind the value, written out so it can be checked by hand, with
// the result as the total line. Opportunities that cover the same money are
// named here, on both sides, rather than netted off.
export function CalculationBlock({ finding: f }: { finding: Finding }) {
  const { data } = useStore()
  const calc = formatCalculation(f)
  const keys = new Set(f.meta.overlaps ?? [])
  const overlapsWith = data.findings.filter((o) => o.id !== f.id && keys.has(o.finding_key))
  const overlappedBy = data.findings.filter((o) => o.id !== f.id && !keys.has(o.finding_key) && o.meta.overlaps?.includes(f.finding_key))

  return (
    <section aria-labelledby="calc-heading">
      <h2 id="calc-heading" className="text-h3 text-ink">
        Calculation
      </h2>
      <p className="mt-0.5 text-small text-ink-3">
        {calc?.basis === 'estimate' ? 'A modelled estimate from a fixed formula, shown so you can check it.' : 'Fixed arithmetic on the records above, shown so you can check it by hand.'}
      </p>
      {calc ? (
        <>
          <ul className="tnum mt-3 space-y-1.5 text-body text-ink">
            {calc.lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
          <p className="tnum mt-2.5 border-t border-line-soft pt-2.5 text-body font-semibold text-ink">{calc.result}</p>
          {calc.note && <p className="tnum mt-1.5 text-caption text-ink-3">{calc.note}</p>}
        </>
      ) : (
        <p className="mt-1.5 text-body text-ink-3">Run the analysis again to see the full calculation.</p>
      )}
      {overlapsWith.length > 0 && (
        <p className="mt-3.5 text-small leading-relaxed text-ink-2">
          Overlaps with <OpportunityLinks findings={overlapsWith} />. Acting on {overlapsWith.length === 1 ? 'that' : 'those'} restores the target margin, so don't count both.
        </p>
      )}
      {overlappedBy.length > 0 && (
        <p className="mt-3.5 text-small leading-relaxed text-ink-2">
          Overlaps with <OpportunityLinks findings={overlappedBy} />. Acting on this one restores the target margin there, so don't count both.
        </p>
      )}
    </section>
  )
}
