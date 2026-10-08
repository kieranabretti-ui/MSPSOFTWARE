// The product's name and lines, in one place.
export const BRAND = {
  name: 'Headroom',
  tagline: 'Find the work your MSP is doing for free.',
} as const

// Owner-supplied facts. Leave null until confirmed; the site hides anything null. Never invent these.
export const COMPANY = {
  descriptor: 'Commercial intelligence for MSPs',
  // Companies House, checked 7 October 2026.
  legalName: 'A-IT & Cyber Group Ltd' as string | null,
  companyNumber: '17473234' as string | null,
  registeredIn: 'England and Wales' as string | null,
  registeredAddress: '26 Balston Road, Poole, BH14 0QH' as string | null,
  // Where workspace data (database and files) is hosted. Confirmed by the owner, 7 October 2026.
  hostingRegion: 'the United Kingdom' as string | null,
  contactEmail: null as string | null,
  securityEmail: null as string | null,
  // Internal routes (src/pages/legal), effective 8 October 2026.
  privacyUrl: '/privacy' as string | null,
  termsUrl: '/terms' as string | null,
  founder: null as null | { name: string; role: string; bio: string },
}

// The trust lines, worded once so the landing page, Trust Centre, app and
// report say the same thing.
export const TRUST_COPY = {
  evidenceBacked: 'Evidence-backed opportunity',
  calculationShown: 'Calculation shown',
  confidence: 'Confidence reflects the strength and completeness of the underlying evidence.',
  ai: 'AI assists with interpretation. Financial calculations are deterministic.',
  review: 'Recommendations require MSP review before action.',
  checkEvidence: "Don't take our word for it. Check the evidence.",
  decides: 'The software recommends. The MSP decides.',
  freeAudit: 'See exactly what we find before you pay.',
} as const

// Hosted (Supabase keys present) or evaluation mode (data in this browser).
// Public claims about server-side controls read this, so they are only made
// where the deployment has them. The demo always runs in the browser.
export const HOSTED = !!(import.meta.env?.VITE_SUPABASE_URL && import.meta.env?.VITE_SUPABASE_ANON_KEY)
