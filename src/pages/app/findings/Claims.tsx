import type { Claim, ClaimType, Finding } from '../../../engine/types'

const TYPE_LABEL: Record<ClaimType, string> = {
  fact: 'Fact',
  observation: 'Observation',
  interpretation: 'Interpretation',
  recommendation: 'Recommendation',
}

function ClaimRow({ c }: { c: Claim }) {
  return (
    <li className="grid gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
      <span className="text-caption font-medium text-ink-3">
        {TYPE_LABEL[c.type]}
        {c.ai && <span className="text-ink-3"> · AI-assisted</span>}
      </span>
      <span className="tnum max-w-[72ch] text-body leading-relaxed text-ink">{c.text}</span>
    </li>
  )
}

// What the records say, kept apart from what it may mean. Facts and
// observations are read or worked out from the records; interpretations sit
// in their own block underneath and say so. Recommendations are shown in the
// Recommended action section, not here.
export function WhatWeFound({ finding: f }: { finding: Finding }) {
  const claims = f.claims ?? []
  const records = claims.filter((c) => c.type === 'fact' || c.type === 'observation')
  const readings = claims.filter((c) => c.type === 'interpretation')

  if (!claims.length)
    return (
      <section aria-labelledby="found-heading">
        <h2 id="found-heading" className="text-h3 text-ink">
          What we found
        </h2>
        <p className="mt-1.5 max-w-[68ch] text-body leading-relaxed text-ink-2">{f.description}</p>
        <p className="mt-2 text-caption text-ink-3">Run the analysis again to see the facts and the interpretation set out separately.</p>
      </section>
    )

  return (
    <section aria-labelledby="found-heading">
      <h2 id="found-heading" className="text-h3 text-ink">
        What we found
      </h2>
      <p className="mt-0.5 text-small text-ink-3">Read directly from your records, or worked out from them.</p>
      <ul className="mt-3 divide-y divide-line-soft">
        {records.map((c, i) => (
          <ClaimRow key={i} c={c} />
        ))}
      </ul>
      {readings.length > 0 && (
        <div className="mt-5 rounded-md border border-line-soft bg-sunken px-4 py-3.5">
          <h3 className="text-small font-semibold text-ink">What it may mean</h3>
          <p className="mt-0.5 text-caption text-ink-3">An interpretation, not a fact. Check it against the evidence before acting.</p>
          <ul className="mt-2.5 space-y-2">
            {readings.map((c, i) => (
              <li key={i} className="max-w-[72ch] text-body leading-relaxed text-ink-2">
                {c.ai && <span className="mr-1.5 text-caption font-medium text-ink-3">AI-assisted:</span>}
                {c.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

// The recommendation claims, or the stored recommended action for older rows.
export function recommendations(f: Finding): string[] {
  const recs = (f.claims ?? []).filter((c) => c.type === 'recommendation').map((c) => c.text)
  return recs.length ? recs : [f.recommended_action]
}
