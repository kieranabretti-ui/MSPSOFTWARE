import type { ReactNode } from 'react'
import { Check, ChevronRight, Minus } from 'lucide-react'
import { Badge, Figure, cx } from '../../components/ui'
import { ConfidenceLevel } from '../../components/ConfidenceLevel'
import { HOSTED, TRUST_COPY } from '../../brand/brand'
import { money } from '../../lib/format'
import { CATEGORY_META, CLASSIFICATION, FINDING_STATUS } from '../../lib/labels'
import type { ClaimType, EvidenceSource } from '../../engine/types'
import { DEMO } from './demoSnapshot'
import { AuditCta } from './chrome'
import { Highlighted, Section, SectionIntro } from './primitives'

// "Don't take our word for it. Check the evidence." One opportunity laid out
// the way the finding page lays it out: the claims kept apart by type, every
// evidence line with the file and row it came from, the calculation, the
// confidence and the checks behind it. The figures are the engine's own
// output on the brief's drift case (see evidenceExample.ts), which also runs
// as a known-answer test, so nothing here is drawn by hand.

const SOURCE_LABEL: Record<EvidenceSource, string> = {
  agreement: 'Agreement',
  psa: 'PSA',
  billing: 'Billing',
  asset_register: 'Users list',
  client_record: 'Client record',
  settings: 'Settings',
  derived: 'Derived',
}

const CLAIM_LABEL: Record<ClaimType, string> = { fact: 'Fact', observation: 'Observation', interpretation: 'Interpretation', recommendation: 'Recommendation' }

function Block({ title, aside, children, className }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cx('border-t border-line-soft py-5 first:border-t-0 first:pt-0', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h4 className="text-label uppercase text-ink-3">{title}</h4>
        {aside}
      </div>
      {children}
    </div>
  )
}

export function CheckTheEvidence() {
  const x = DEMO.evidenceExample
  const facts = x.claims.filter((c) => c.type === 'fact' || c.type === 'observation')
  const interpretation = x.claims.filter((c) => c.type === 'interpretation')
  const recommendation = x.claims.find((c) => c.type === 'recommendation')?.text ?? x.recommendedAction

  return (
    <Section id="evidence" label="evidence-title">
      <SectionIntro id="evidence-title" title={TRUST_COPY.checkEvidence}>
        <p>
          Every commercial finding is backed by the underlying data, the calculation used to produce it and a confidence level. AI can help interpret your data, but it doesn't get to invent the
          numbers.
        </p>
      </SectionIntro>

      <figure className="mt-12 lg:mt-16">
        <article aria-labelledby="evidence-example-title" className="overflow-hidden rounded-xl border border-line bg-surface">
          {/* Header: what, who, how much, how sure, what stage */}
          <header className="grid grid-cols-1 gap-x-8 gap-y-5 border-b border-line px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{CATEGORY_META[x.category].short}</Badge>
                <Badge>{CLASSIFICATION[x.classification].label}</Badge>
                <ConfidenceLevel level={x.level} />
              </div>
              <h3 id="evidence-example-title" className="mt-3 text-h1 text-balance text-ink">
                {x.title}
              </h3>
              <p className="mt-1 text-small text-ink-3">
                {x.client} · {TRUST_COPY.evidenceBacked} · Status: {FINDING_STATUS.open}
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-x-8 border-t border-line-soft pt-4 lg:border-t-0 lg:pt-0 lg:text-right">
              <div>
                <dt className="text-caption text-ink-3">A month</dt>
                <dd className="mt-1">
                  <Figure size="md">{money(x.monthly)}</Figure>
                </dd>
              </div>
              <div>
                <dt className="text-caption text-ink-3">A year</dt>
                <dd className="mt-1">
                  <Figure size="md">{money(x.annual)}</Figure>
                </dd>
              </div>
            </dl>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            {/* What we found: facts and observations, kept apart from what they may mean */}
            <div className="min-w-0 border-b border-line px-4 py-5 sm:px-6 lg:border-b-0 lg:border-r">
              <Block title="What we found">
                <ul className="space-y-2.5">
                  {facts.map((c) => (
                    <li key={c.text} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 text-small">
                      <span className="text-caption font-medium text-ink-3">{CLAIM_LABEL[c.type]}</span>
                      <span className="tnum text-ink">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </Block>
              {interpretation.length > 0 && (
                <Block title="Interpretation">
                  {interpretation.map((c) => (
                    <p key={c.text} className="border-l-2 border-line pl-3 text-small text-ink-2">
                      {c.text}
                    </p>
                  ))}
                </Block>
              )}
              <Block title="Recommended action">
                <p className="tnum text-small text-ink">{recommendation}</p>
                <p className="mt-1.5 text-caption text-ink-3">{TRUST_COPY.review}</p>
              </Block>
            </div>

            {/* Evidence, calculation and confidence */}
            <div className="min-w-0 px-4 py-5 sm:px-6">
              <Block title="Evidence" aside={<span className="text-caption text-ink-3">Each line names its source record</span>}>
                <ul className="divide-y divide-line-soft">
                  {x.evidence.map((e) => (
                    <li key={e.reference} className="grid grid-cols-1 gap-x-4 gap-y-1 py-2.5 first:pt-0 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
                      <span className="text-small font-medium text-ink">{SOURCE_LABEL[e.source]}</span>
                      <span className="min-w-0">
                        <span className="tnum block text-small text-ink-2">
                          {e.source === 'agreement' ? (
                            <>
                              “<Highlighted text={e.text} highlights={e.highlights} />”
                            </>
                          ) : (
                            e.text
                          )}
                        </span>
                        <span className="tnum mt-0.5 block text-caption text-ink-3">{e.reference}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Block>
              <Block title="Calculation" aside={<span className="text-caption text-ink-3">{TRUST_COPY.calculationShown}</span>}>
                <div className="rounded-md bg-sunken px-3.5 py-3">
                  {x.calculation.lines.map((line) => (
                    <p key={line} className="tnum text-body text-ink">
                      {line}
                    </p>
                  ))}
                </div>
              </Block>
              <Block title="Confidence">
                <ConfidenceLevel level={x.level} />
                <p className="mt-1.5 text-small text-ink-2">{x.basis}</p>
                <details className="group mt-4 rounded-md border border-line">
                  <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md px-3.5 py-2 text-small font-medium text-ink transition-colors hover:bg-raised [&::-webkit-details-marker]:hidden">
                    <ChevronRight className="size-4 text-ink-3 transition-transform duration-150 group-open:rotate-90" aria-hidden />
                    Why was this flagged?
                  </summary>
                  <div className="border-t border-line-soft px-3.5 pb-3.5 pt-3 text-small">
                    <p className="text-ink-2">
                      Rule <code className="rounded-xs bg-sunken px-1 py-0.5 text-caption text-ink">{x.rule}</code>: more active users than the agreement covers, valued at the client's own
                      per-user billing line.
                    </p>
                    <p className="mt-3 text-caption font-medium text-ink-3">Evidence checks</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {x.checks.map((c) => (
                        <li key={c.text} className="flex items-start gap-2 text-ink-2">
                          {c.met ? <Check className="mt-0.5 size-3.5 shrink-0 text-ink-2" aria-label="Met" /> : <Minus className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-label="Not met" />}
                          <span className="tnum">{c.text}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-caption text-ink-3">Data sources: {x.files.join(', ')}.</p>
                  </div>
                </details>
              </Block>
            </div>
          </div>

          <ul className="grid grid-cols-1 gap-px border-t border-line bg-line-soft sm:grid-cols-2 lg:grid-cols-4">
            {[TRUST_COPY.calculationShown + '. Every figure can be checked by hand.', TRUST_COPY.confidence, TRUST_COPY.ai, TRUST_COPY.decides].map((t) => (
              <li key={t} className="bg-sunken px-4 py-3.5 text-caption text-ink-2 sm:px-6">
                {t}
              </li>
            ))}
          </ul>
        </article>
        <figcaption className="mt-3 max-w-[80ch] text-caption text-ink-3">
          Sample data: {x.client} is fictional. This is Headroom's actual output for a three-file sample (an agreement, a users list and a billing export), and the same case runs as an automated
          known-answer test.
        </figcaption>
      </figure>

      <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-6 border-t border-line pt-10 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <h3 className="text-h1 text-balance text-ink">{TRUST_COPY.freeAudit}</h3>
          <p className="mt-3 max-w-[56ch] text-body text-ink-2">
            {HOSTED
              ? 'The first audit is free. Upload your own exports and you see every opportunity, its evidence and its calculation before you decide whether Headroom is worth paying for.'
              : 'The first audit is free. This site runs in evaluation mode, so data stays in your browser: try it with the demo or anonymised sample exports, and see every opportunity, its evidence and its calculation before you decide whether Headroom is worth paying for.'}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:justify-end">
          {/* Bone, not lime: the hero and Growth keep the lime buttons. */}
          <AuditCta location="evidence" label="Start a free audit" variant="primary" size="md" />
        </div>
      </div>
    </Section>
  )
}
