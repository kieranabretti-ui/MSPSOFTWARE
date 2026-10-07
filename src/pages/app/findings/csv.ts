import { toCsv } from '../../../lib/format'
import { confidenceOf } from '../../../lib/confidence'
import { formatCalculation } from '../../../lib/calculation'
import { CATEGORY_META, CONFIDENCE, FINDING_STATUS } from '../../../lib/labels'
import { stripJoiners } from '../../../engine/format'
import type { Finding } from '../../../engine/types'

// One row per opportunity, in the product's words. The raw stage and the
// confidence score stay alongside the labels for anyone re-sorting in a sheet.
export function findingsCsv(findings: Finding[], clientName: (id: string) => string) {
  return toCsv(
    findings.map((f) => ({
      id: f.id,
      client: clientName(f.client_id),
      category: CATEGORY_META[f.category].label,
      stage: FINDING_STATUS[f.status],
      status: f.status,
      confidence_level: CONFIDENCE[confidenceOf(f).level].short,
      confidence_score: f.confidence,
      priority: f.severity,
      title: f.title,
      description: stripJoiners(f.description),
      calculation: stripJoiners(formatCalculation(f)?.lines.join(' / ') ?? ''),
      estimated_value: f.estimated_value,
      monthly_value: f.monthly_value,
      annual_value: f.annual_value,
      recommended_action: stripJoiners(f.recommended_action),
      evidence: f.evidence.map((e) => `${e.label}: ${e.text.replace(/\n/g, ' / ')}`).join(' | '),
      source_data: f.source_data.map((s) => `${s.table}:${s.label}`).join('; '),
    })),
  )
}
