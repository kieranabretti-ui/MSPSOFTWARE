// Rule-based extraction of commercially relevant clauses from contract text.
// Every clause keeps the exact sentence it came from so findings can quote it.

export type ClauseType =
  | 'company_devices_only'
  | 'excludes_hardware'
  | 'excludes_projects'
  | 'onsite_chargeable'
  | 'business_hours'
  | 'third_party_excluded'
  | 'new_user_chargeable'
  | 'new_device_chargeable'
  | 'included_hours'

export interface Clause {
  type: ClauseType
  sentence: string
  highlight: string
  value?: number
}

const PATTERNS: { type: ClauseType; re: RegExp }[] = [
  { type: 'company_devices_only', re: /(company[- ]owned|business[- ]owned|corporate)[^.]{0,60}(devices|equipment|hardware|endpoints)[^.]{0,40}(only|exclusively)|(only|limited to|restricted to|applies to)[^.]{0,40}(company[- ]owned|business[- ]owned|corporate)[^.]{0,30}(devices|equipment|hardware|endpoints)|personal(ly[- ]owned)? (devices|equipment)[^.]{0,60}(excluded|not (covered|included|supported))/i },
  { type: 'excludes_hardware', re: /(hardware (repair|replacement|faults?)|physical repair|replacement parts)[^.]{0,80}(excluded|not (covered|included)|chargeable|charged)|(excludes?|not (covered|included))[^.]{0,40}hardware (repair|replacement)/i },
  { type: 'excludes_projects', re: /(project work|projects|migrations?|installations?|upgrades?)[^.]{0,120}(excluded|not (covered|included)|chargeable|separately quoted|quoted separately|subject to (a )?separate)/i },
  { type: 'onsite_chargeable', re: /(on[- ]?site|site visits?|attendance at (the )?client)[^.]{0,100}(chargeable|charged|excluded|not (covered|included)|additional)/i },
  { type: 'business_hours', re: /(support|service)[^.]{0,60}(hours|available)[^.]{0,40}(\d{1,2}[:.]\d{2}|\d{1,2}(am|pm))[^.]{0,40}(monday|mon)|outside (of )?(these|business|normal|core) hours[^.]{0,80}(chargeable|charged|excluded|additional|premium)/i },
  { type: 'third_party_excluded', re: /(third[- ]party|line[- ]of[- ]business|vendor)[^.]{0,80}(applications?|software|systems?)[^.]{0,100}(excluded|not (covered|included)|best[- ]endeavou?rs|chargeable|vendor's responsibility)/i },
  { type: 'new_user_chargeable', re: /(new (user|starter|employee)s?|onboarding|user setup)[^.]{0,80}(chargeable|charged|excluded|not (covered|included)|at the (standard|prevailing) rate|per user setup fee)/i },
  { type: 'new_device_chargeable', re: /(new (device|laptop|pc|computer|workstation)s?|device (provisioning|builds?|setup))[^.]{0,80}(chargeable|charged|excluded|not (covered|included)|at the (standard|prevailing) rate)/i },
  { type: 'included_hours', re: /(includes?|inclusive of|up to)\s+(\d{1,3})\s+hours?[^.]{0,60}(support|per month|each month|monthly)/i },
]

export function splitSentences(text: string): string[] {
  return text
    .replace(/\r/g, '')
    .split(/(?<=[.;!?])\s+|\n{2,}|\n(?=\s*(?:\d+(?:\.\d+)*[.)]?|[-•*])\s)/)
    .map((s) => s.replace(/\s+/g, ' ').trim().replace(/^(?:\d+(?:\.\d+)*[.)]?|[-•*])\s+/, ''))
    .filter((s) => s.length > 12)
}

export function extractClauses(text: string): Clause[] {
  const clauses: Clause[] = []
  const seen = new Set<string>()
  for (const sentence of splitSentences(text)) {
    for (const { type, re } of PATTERNS) {
      const m = sentence.match(re)
      if (!m) continue
      const key = `${type}:${sentence}`
      if (seen.has(key)) continue
      seen.add(key)
      const clause: Clause = { type, sentence, highlight: m[0] }
      if (type === 'included_hours') clause.value = Number(m[2])
      clauses.push(clause)
    }
  }
  return clauses
}

export const CLAUSE_LABELS: Record<ClauseType, string> = {
  company_devices_only: 'Company-owned devices only',
  excludes_hardware: 'Hardware repair excluded',
  excludes_projects: 'Project work excluded',
  onsite_chargeable: 'Onsite visits chargeable',
  business_hours: 'Support limited to business hours',
  third_party_excluded: 'Third-party applications excluded',
  new_user_chargeable: 'New user setup chargeable',
  new_device_chargeable: 'New device setup chargeable',
  included_hours: 'Included support hours',
}
