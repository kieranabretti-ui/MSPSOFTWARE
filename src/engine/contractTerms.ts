// Rule-based extraction of commercially relevant clauses from contract text.
// Every clause keeps the exact sentence it came from so findings can quote it,
// and where it sits: which contract, which numbered section and which page, so
// a finding can cite "Managed Services Agreement, section 3.1, page 2".

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
  | 'contracted_users'
  | 'contracted_devices'
  | 'hourly_rate'
  | 'out_of_hours_multiplier'

export interface Clause {
  type: ClauseType
  sentence: string
  highlight: string
  value?: number
  // The numbering the sentence sits under ("3.1"), or null when the contract
  // isn't numbered. Inherited from the nearest numbered heading above it.
  section: string | null
  // 1-based page, when the text kept page breaks (form feeds) from the PDF.
  page: number | null
  contract_id: string | null
  contract_title: string | null
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

// Quantities and rates the agreement states. Each needs a commercial context in
// the same sentence so "10 users reported the outage" is never read as a term.
const QUANTITY_CONTEXT = /(monthly charge|monthly fee|based on|covers?|contracted|this agreement|supported|licensed|the service)/i
const USERS_RE = /(\d{1,5})\s+(?:supported\s+|named\s+|licensed\s+|managed\s+)?(?:users?|seats?)\b/i
const DEVICES_RE = /(\d{1,5})\s+(?:supported\s+|managed\s+|monitored\s+)?(?:devices?|endpoints?|workstations?)\b/i
// "£60 per hour", "£60/h", "£60 an hour", "hourly rate is £60".
const RATE_RE = /£\s?(\d{1,4}(?:\.\d{1,2})?)\s*(?:per hour|an hour|\/\s?(?:hr|hour|h)\b|ph\b)|hourly rate (?:is|of) £\s?(\d{1,4}(?:\.\d{1,2})?)/i
const MULTIPLIER_RE = /(\d(?:\.\d{1,2})?)\s*(?:times|x|×)\s*(?:the\s+)?(?:standard\s+)?(?:hourly\s+)?rate/i

export interface ContractSegment {
  sentence: string
  section: string | null
  page: number | null
}

// A paragraph that starts with numbering: "3.1 ", "3. ", "3) ", "Section 4 ",
// "Clause 4.2 ". A bare "10 hours..." is not numbering.
const NUMBERING = /^(?:(?:section|clause)\s+(\d+(?:\.\d+)*)[.):]?|(\d+(?:\.\d+)+)[.)]?|(\d+)[.)])\s+/i
const BULLET = /^[-•*]\s+/

/**
 * Splits contract text into sentences, keeping the section number each one sits
 * under and its page. Pages are separated by form feeds (\f), which the PDF
 * reader writes between pages; text without them has page null.
 */
export function segmentContract(text: string): ContractSegment[] {
  const pages = text.replace(/\r/g, '').split('\f')
  const paged = pages.length > 1
  const out: ContractSegment[] = []
  let section: string | null = null
  pages.forEach((pageText, pi) => {
    const paragraphs = pageText.split(/\n{2,}|\n(?=\s*(?:(?:section|clause)\s+\d|\d+(?:\.\d+)*[.)]?\s|[-•*]\s))/i)
    for (const raw of paragraphs) {
      let p = raw.replace(/\s+/g, ' ').trim()
      const num = p.match(NUMBERING)
      if (num) {
        section = num[1] ?? num[2] ?? num[3]
        p = p.slice(num[0].length)
      } else p = p.replace(BULLET, '')
      for (const s of p.split(/(?<=[.;!?])\s+/)) {
        const sentence = s.trim()
        if (sentence.length > 12) out.push({ sentence, section, page: paged ? pi + 1 : null })
      }
    }
  })
  return out
}

// Kept for callers that only need the sentences.
export function splitSentences(text: string): string[] {
  return segmentContract(text).map((s) => s.sentence)
}

export function extractClauses(text: string, contract?: { id: string; title: string } | null): Clause[] {
  const clauses: Clause[] = []
  const seen = new Set<string>()
  for (const { sentence, section, page } of segmentContract(text)) {
    const push = (type: ClauseType, highlight: string, value?: number) => {
      const key = `${type}:${sentence}`
      if (seen.has(key)) return
      seen.add(key)
      clauses.push({ type, sentence, highlight, ...(value != null ? { value } : {}), section, page, contract_id: contract?.id ?? null, contract_title: contract?.title ?? null })
    }
    for (const { type, re } of PATTERNS) {
      const m = sentence.match(re)
      if (m) push(type, m[0], type === 'included_hours' ? Number(m[2]) : undefined)
    }
    if (QUANTITY_CONTEXT.test(sentence)) {
      const u = sentence.match(USERS_RE)
      if (u) push('contracted_users', u[0], Number(u[1]))
      const d = sentence.match(DEVICES_RE)
      if (d) push('contracted_devices', d[0], Number(d[1]))
    }
    const r = sentence.match(RATE_RE)
    if (r) push('hourly_rate', r[0], Number(r[1] ?? r[2]))
    const x = sentence.match(MULTIPLIER_RE)
    if (x && /outside|out of hours|after hours|evening|weekend/i.test(sentence)) push('out_of_hours_multiplier', x[0], Number(x[1]))
  }
  return clauses
}

/**
 * The single value an agreement states for a quantity or rate, or null when it
 * states none or more than one different value (then nothing is taken from it).
 */
export function statedValue(clauses: Clause[], type: ClauseType): { value: number; clause: Clause } | null {
  const hits = clauses.filter((c) => c.type === type && c.value != null)
  if (!hits.length) return null
  const values = new Set(hits.map((c) => c.value))
  return values.size === 1 ? { value: hits[0].value!, clause: hits[0] } : null
}

// "Managed Services Agreement, section 3.1, page 2"
export function clauseCitation(c: Pick<Clause, 'contract_title' | 'section' | 'page'>): string {
  return [c.contract_title ?? 'Agreement', c.section ? `section ${c.section}` : null, c.page ? `page ${c.page}` : null].filter(Boolean).join(', ')
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
  contracted_users: 'Contracted users',
  contracted_devices: 'Contracted devices',
  hourly_rate: 'Hourly rate',
  out_of_hours_multiplier: 'Out-of-hours rate multiplier',
}
