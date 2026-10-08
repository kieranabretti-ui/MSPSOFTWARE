// Deterministic ticket classification. Each category returns the phrases that
// triggered it so the UI can highlight them as evidence.

export type WorkCategory =
  | 'personal_device'
  | 'hardware_repair'
  | 'third_party_app'
  | 'project_work'
  | 'new_user'
  | 'new_device'
  | 'onsite'
  | 'unsupported_software'
  | 'after_hours'

export interface Classification {
  category: WorkCategory
  confidence: number // 0..100, how sure we are the ticket is this kind of work
  matches: string[]
}

interface Rule {
  category: WorkCategory
  strong: RegExp[]
  weak: RegExp[]
}

const RULES: Rule[] = [
  {
    category: 'personal_device',
    strong: [
      /\b(personal|private|home|own)\s+(macbook|laptop|iphone|ipad|phone|mobile|pc|computer|tablet|printer|device)\b/i,
      /\b(employee|user|director|partner|staff member)'?s\s+(own|personal|home|private)\s+\w+/i,
      /\bbyod\b/i,
      /\b(son|daughter|wife|husband|partner|family|kid)'?s\s+(laptop|pc|computer|ipad|phone|xbox|playstation)\b/i,
    ],
    weak: [/\bpersonal\s+(email|account)\b/i, /\bat home\b/i],
  },
  {
    category: 'hardware_repair',
    strong: [
      /\b(replace|replaced|replacing|repair|repaired|fix)\w*\s+(the\s+)?(cracked\s+|broken\s+|faulty\s+)?(screen|keyboard|battery|hinge|motherboard|hard drive|ssd|fan|power supply|psu|charging port)\b/i,
      /\b(cracked|smashed|broken)\s+(screen|display|hinge)\b/i,
      /\bhardware (fault|failure|repair)\b/i,
    ],
    weak: [/\b(dead|faulty)\s+(laptop|pc|monitor)\b/i, /\bwarranty (claim|repair)\b/i],
  },
  {
    category: 'third_party_app',
    strong: [
      /\b(sage 50|sage payroll|dentally|software of excellence|soe exact|iris|clio|leap|autocad|revit|xero practice|quickbooks desktop|opera pms|vectorworks)\b/i,
      /\b(line[- ]of[- ]business|lob) (app|application|software|system)\b/i,
    ],
    weak: [/\bvendor (support|update|patch)\b/i, /\bthird[- ]party (app|software)\b/i],
  },
  {
    category: 'project_work',
    strong: [
      /\b(migrat(e|ion|ing)|rollout|roll out|implementation|implement new)\b/i,
      /\b(office move|relocation|new server|server replacement|tenant to tenant|sharepoint migration|intune rollout|network upgrade|firewall replacement)\b/i,
    ],
    weak: [/\bupgrade (to|all)\b/i, /\bproject\b/i],
  },
  {
    category: 'new_user',
    strong: [/\bnew (starter|user|employee|joiner)\b/i, /\bonboard(ing)?\b/i, /\bset ?up (account|accounts|user) for\b/i],
    weak: [/\bcreate (account|mailbox|user)\b/i],
  },
  {
    category: 'new_device',
    strong: [/\b(build|set ?up|provision|deploy|configure)\s+(a\s+|the\s+)?new\s+(laptop|pc|desktop|workstation|device|macbook|surface)\b/i, /\bnew (laptop|pc|desktop|workstation) (build|setup|set up)\b/i],
    weak: [/\bautopilot enrol/i],
  },
  {
    category: 'onsite',
    strong: [/\b(on[- ]?site|site visit|attended site|visit to site|engineer to attend)\b/i],
    weak: [/\btravel(led)? to\b/i],
  },
  {
    category: 'unsupported_software',
    strong: [/\b(steam|xbox|playstation|netflix|spotify|fortnite|minecraft|gaming)\b/i],
    weak: [],
  },
  {
    category: 'after_hours',
    strong: [/\b(out of hours|after hours|out-of-hours|overnight|weekend work|sunday|saturday)\b/i],
    weak: [/\b(evening|late night|bank holiday)\b/i],
  },
]

// Negation. A keyword only counts when the ticket doesn't say the opposite:
// "no onsite", "not a new user", "onsite visit not required". The words just
// before a match, or just after it, in the same clause are checked.
const NEGATED_BEFORE = /\b(?:no|not|non|without|never|nor|isn'?t|wasn'?t|aren'?t|weren'?t|didn'?t|doesn'?t|don'?t|no need (?:for|to)|not (?:an?|the|any))\s+(?:(?:an?|the|any|need(?:ed)? (?:for|to)?|require(?:d)?|for)\s+)*$/i
const NEGATED_AFTER = /^[\w\s'-]{0,24}?\b(?:not|no longer|never)\s+(?:required|needed|necessary|attended|done|carried out)\b|^[\w\s'-]{0,24}?\b(?:unnecessary|not needed)\b/i
// A ticket that says the work was remote only was not an onsite visit.
const REMOTE_ONLY = /\bremote(?:ly)?(?:\s+(?:support|session|fix|access))?\s+only\b|\b(?:fixed|resolved|done|completed|handled)\s+remotely\b/i
const CLAUSE_BREAK = /[.;!?\n]|\bbut\b/i
// "could not be fixed remotely" says the opposite: the remote fix failed.
const REMOTE_FAILED_BEFORE = /\b(?:not|never|unable to|cannot|can'?t|couldn'?t|wasn'?t|isn'?t)\b[\w\s']{0,12}$/i

function saysRemoteOnly(text: string): boolean {
  const g = new RegExp(REMOTE_ONLY.source, 'gi')
  for (const m of text.matchAll(g)) {
    const { before } = clauseAround(text, m.index, m[0].length)
    if (!REMOTE_FAILED_BEFORE.test(before)) return true
  }
  return false
}

function clauseAround(text: string, index: number, length: number): { before: string; after: string } {
  let before = text.slice(Math.max(0, index - 40), index)
  const cut = before.split(CLAUSE_BREAK)
  before = cut[cut.length - 1]
  let after = text.slice(index + length, index + length + 40)
  after = after.split(CLAUSE_BREAK)[0]
  return { before, after }
}

function isNegated(text: string, index: number, length: number): boolean {
  const { before, after } = clauseAround(text, index, length)
  return NEGATED_BEFORE.test(before) || NEGATED_AFTER.test(after)
}

// The first occurrence of a pattern that isn't negated, or null.
function firstPositive(text: string, re: RegExp): string | null {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  for (const m of text.matchAll(g)) if (!isNegated(text, m.index, m[0].length)) return m[0]
  return null
}

export function classifyText(text: string): Classification[] {
  const out: Classification[] = []
  const remoteOnly = saysRemoteOnly(text)
  for (const rule of RULES) {
    if (rule.category === 'onsite' && remoteOnly) continue
    const strong = rule.strong.map((r) => firstPositive(text, r)).filter((m): m is string => !!m)
    const weak = rule.weak.map((r) => firstPositive(text, r)).filter((m): m is string => !!m)
    if (!strong.length && !weak.length) continue
    const confidence = strong.length ? Math.min(98, 86 + (strong.length - 1) * 5 + weak.length * 3) : Math.min(68, 52 + weak.length * 8)
    out.push({ category: rule.category, confidence, matches: [...strong, ...weak] })
  }
  return out
}

// The workspace's time zone. Business hours are judged on UK wall-clock time,
// never the browser's own zone, so the same data gives the same findings
// wherever it is analysed.
export const WORKSPACE_TIME_ZONE = 'Europe/London'
const TZ_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i
const wallClockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: WORKSPACE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/**
 * A timestamp as UK wall-clock time, "YYYY-MM-DDTHH:MM:00". A timestamp with a
 * zone (Z or ±hh:mm) is converted; one without is already wall-clock time and
 * is returned unchanged. Null when it can't be read.
 */
export function toWorkspaceWallClock(iso: string): string | null {
  const s = iso.trim()
  if (!TZ_SUFFIX.test(s)) return s
  const t = Date.parse(s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2'))
  if (Number.isNaN(t)) return null
  const p = Object.fromEntries(wallClockFmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00`
}

export function isOutsideHours(iso: string, start: string, end: string): boolean {
  if (!/T\d{2}:\d{2}/.test(iso)) return false // date only: can't tell
  const wall = toWorkspaceWallClock(iso)
  const m = wall?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return false
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()
  if (Number.isNaN(day)) return false
  if (day === 0 || day === 6) return true
  const mins = Number(m[4]) * 60 + Number(m[5])
  const toMins = (s: string) => {
    const [h, mm] = s.split(':').map(Number)
    return h * 60 + (mm || 0)
  }
  return mins < toMins(start) || mins >= toMins(end)
}

export const CATEGORY_LABELS: Record<WorkCategory, string> = {
  personal_device: 'Personal device',
  hardware_repair: 'Hardware repair',
  third_party_app: 'Third-party application',
  project_work: 'Project work',
  new_user: 'New user',
  new_device: 'New device',
  onsite: 'Onsite work',
  unsupported_software: 'Non-supported software',
  after_hours: 'After-hours work',
}

// How each category reads inside a sentence ("this looks like …").
export const CATEGORY_NOUNS: Record<WorkCategory, string> = {
  personal_device: 'work on a personal device',
  hardware_repair: 'hardware repair',
  third_party_app: 'support for a third-party application',
  project_work: 'project work',
  new_user: 'new user setup',
  new_device: 'new device setup',
  onsite: 'an onsite visit',
  unsupported_software: 'support for non-supported software',
  after_hours: 'out-of-hours work',
}

export const OUT_OF_SCOPE_TITLES: Record<WorkCategory, string> = {
  personal_device: 'Personal device work logged as non-billable',
  hardware_repair: 'Hardware repair logged as non-billable',
  third_party_app: 'Third-party application support logged as non-billable',
  project_work: 'Project work logged as non-billable',
  new_user: 'New user setup logged as non-billable',
  new_device: 'New device setup logged as non-billable',
  onsite: 'Onsite visit logged as non-billable',
  unsupported_software: 'Unsupported software work logged as non-billable',
  after_hours: 'Out-of-hours work logged as non-billable',
}
