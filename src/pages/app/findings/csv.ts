import { toCsv } from '../../../lib/format'
import { CLASSIFICATION_DEFINITIONS, confidenceOf } from '../../../lib/confidence'
import { formatCalculation } from '../../../lib/calculation'
import { CATEGORY_META, CONFIDENCE, FINDING_STATUS } from '../../../lib/labels'
import { stripJoiners } from '../../../engine/format'
import type { Finding } from '../../../engine/types'

// One row per opportunity, in the product's words. Confidence is the band and
// the reason for it, never a number: the engine's internal score isn't a
// probability and isn't exported. toCsv neutralises cells that a spreadsheet
// would run as formulas (uploaded text reaches several columns).
export function findingsCsv(findings: Finding[], clientName: (id: string) => string) {
  return toCsv(
    findings.map((f) => {
      const c = confidenceOf(f)
      return {
        id: f.id,
        client: clientName(f.client_id),
        category: CATEGORY_META[f.category].label,
        stage: FINDING_STATUS[f.status],
        status: f.status,
        classification: CLASSIFICATION_DEFINITIONS[c.classification].split(':')[0],
        confidence: CONFIDENCE[c.level].short,
        confidence_basis: c.basis,
        title: f.title,
        description: stripJoiners(f.description),
        calculation: stripJoiners(formatCalculation(f)?.lines.join(' / ') ?? ''),
        estimated_value: f.estimated_value,
        monthly_value: f.monthly_value,
        annual_value: f.annual_value,
        recommended_action: stripJoiners(f.recommended_action),
        evidence: f.evidence.map((e) => `${e.label}: ${e.text.replace(/\r?\n/g, ' / ')}`).join(' | '),
        source_data: f.source_data.map((s) => `${s.table}:${s.label}`).join('; '),
        dismiss_reason: f.dismiss_reason ?? '',
        ai_assisted_note: f.ai_explanation ? 'Yes (AI-assisted, not used in any calculation)' : '',
      }
    }),
  )
}
