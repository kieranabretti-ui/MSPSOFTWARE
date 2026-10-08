import type { ReactNode } from 'react'
import { Check, Minus } from 'lucide-react'
import { Button, Modal, cx } from '../../../components/ui'
import { ConfidenceLevel } from '../../../components/ConfidenceLevel'
import { useStore } from '../../../data/store'
import { formatCalculation } from '../../../lib/calculation'
import { CONFIDENCE_DEFINITIONS, confidenceOf } from '../../../lib/confidence'
import { dateTime, plural } from '../../../lib/format'
import type { Finding } from '../../../engine/types'
import { CLASS_LABEL, classDefinition, SETTING_LABEL, SOURCE_META, allRefs, filesOf, groupEvidence, ruleInfo, rowRanges, sourceOf } from './rules'

export const CONFIDENCE_LINE = 'Confidence reflects the strength and completeness of the underlying evidence.'
export const AI_LINE = 'AI assists with interpretation. Financial calculations are deterministic.'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line-soft py-4 first:border-t-0 first:pt-0 last:pb-0">
      <h3 className="text-small font-semibold text-ink">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

// "Why was this flagged?": everything needed to check a finding without
// trusting the software. The rule that fired, the records it read, the sum,
// and the checks behind its confidence, met or not.
export default function EvidenceView({ finding: f, open, onClose }: { finding: Finding; open: boolean; onClose: () => void }) {
  const { data } = useStore()
  if (!open) return null
  const rule = ruleInfo(f.meta.rule)
  const conf = confidenceOf(f)
  const classification = f.classification ?? conf.classification
  const calc = formatCalculation(f)
  const groups = groupEvidence(f.evidence)
  const files = filesOf(allRefs(f), data.uploads)
  const clauses = [...new Map(allRefs(f).filter((r) => r.table === 'contracts').map((r) => [`${r.id}:${r.section ?? ''}`, r])).values()]
  const settingKeys = [...new Set(f.evidence.flatMap((e) => (sourceOf(e) === 'settings' ? (e.setting_keys ?? []) : [])))]
  const met = conf.criteria.filter((c) => c.met).length
  const assumed = conf.criteria.filter((c) => !c.met)
  const analysis = data.analyses.find((a) => a.id === f.analysis_id)

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Why was this flagged?"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="text-small leading-relaxed text-ink-2">
        <p className="mb-4 text-body text-ink">Don't take our word for it. Check the evidence.</p>

        <Section title="Rule applied">
          <p className="text-ink">
            {rule?.name ?? 'Rule'} <code className="ml-1 rounded-xs bg-raised px-1.5 py-0.5 font-mono text-caption text-ink-2">{f.meta.rule}</code>
          </p>
          {rule && (
            <>
              <p className="mt-1.5 max-w-[72ch]">Flags when: {rule.fires}</p>
              <p className="mt-1 max-w-[72ch]">Value: {rule.value}</p>
            </>
          )}
          <p className="mt-1.5 text-caption text-ink-3">
            A fixed rule in the analysis engine, the same for every workspace{analysis ? `. This run: ${dateTime(analysis.created_at)}` : ''}.
          </p>
        </Section>

        <Section title="Data sources">
          <ul className="space-y-1.5">
            {groups.map((g) => (
              <li key={g.source} className="grid gap-x-4 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                <span className="font-medium text-ink">{SOURCE_META[g.source].label}</span>
                <span className="min-w-0">
                  {g.source === 'agreement' && clauses.length
                    ? clauses.map((r) => r.label).join('; ')
                    : g.source === 'settings' && settingKeys.length
                      ? settingKeys.map((k) => SETTING_LABEL[k] ?? k).join(', ')
                      : `${SOURCE_META[g.source].blurb} (${plural(g.items.length, 'line')})`}
                </span>
              </li>
            ))}
          </ul>
          {files.length > 0 && (
            <ul className="tnum mt-2.5 space-y-1 border-t border-line-soft pt-2.5 text-caption text-ink-3">
              {files.map((s) => (
                <li key={s.key}>
                  <span className="font-medium text-ink-2">{s.file_name}</span>: {plural(s.count, 'record')}
                  {s.rows.length ? `, ${s.rows.length === 1 ? 'row' : 'rows'} ${rowRanges(s.rows)}` : ''}
                  {s.upload ? `, imported ${dateTime(s.upload.created_at)}` : ''}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Calculation">
          {calc ? (
            <>
              <ul className="tnum space-y-1 text-ink">
                {calc.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
              <p className="tnum mt-2 border-t border-line-soft pt-2 font-semibold text-ink">{calc.result}</p>
              <p className="mt-1.5 text-caption text-ink-3">
                {calc.basis === 'estimate' ? 'A modelled estimate, worked out by fixed formula from the inputs above.' : 'Worked out by fixed arithmetic from the records. No AI is involved in any figure.'}
              </p>
            </>
          ) : (
            <p>Run the analysis again to see the full calculation.</p>
          )}
        </Section>

        <Section title="Evidence strength">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <ConfidenceLevel level={conf.level} />
            {conf.criteria.length > 0 && <span className="tnum text-caption text-ink-3">{`${met} of ${conf.criteria.length} checks met`}</span>}
          </div>
          <p className="mt-2 max-w-[72ch] text-ink">{conf.basis}</p>
          {conf.criteria.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {conf.criteria.map((c) => (
                <li key={c.id} className="flex items-start gap-2.5">
                  <span className={cx('mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset', c.met ? 'bg-raised text-ink ring-line-strong' : 'text-ink-3 ring-line')}>
                    {c.met ? <Check className="size-3" strokeWidth={2.5} aria-hidden /> : <Minus className="size-3" strokeWidth={2.5} aria-hidden />}
                  </span>
                  <span className="min-w-0">
                    <span className="sr-only">{c.met ? 'Met: ' : 'Not met: '}</span>
                    <span className={c.met ? 'text-ink-2' : 'text-ink'}>{c.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {assumed.length > 0 && (
            <p className="mt-2.5 text-caption text-ink-3">
              {assumed.length === 1 ? 'The unmet check is' : 'The unmet checks are'} what keeps this from a higher level, and what to look at first.
            </p>
          )}
          <p className="mt-3 text-caption text-ink-3">
            {CONFIDENCE_LINE} {conf.level[0] + conf.level.slice(1).toLowerCase()}: {CONFIDENCE_DEFINITIONS[conf.level]}
          </p>
        </Section>

        <Section title="Classification">
          <p className="font-medium text-ink">{CLASS_LABEL[classification]}</p>
          <p className="mt-1 max-w-[72ch]">{classDefinition(classification)}</p>
        </Section>

        <Section title="AI">
          <p className="max-w-[72ch]">
            {AI_LINE} This opportunity was found and valued by the fixed rules above.
            {f.ai_explanation ? ' The explanation on the page is labelled AI-assisted and is not used in any figure.' : ' No AI was used.'}
          </p>
          <p className="mt-1.5 text-caption text-ink-3">Recommendations require MSP review before action.</p>
        </Section>
      </div>
    </Modal>
  )
}
