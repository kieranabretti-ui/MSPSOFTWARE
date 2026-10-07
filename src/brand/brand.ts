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
  privacyUrl: null as string | null,
  termsUrl: null as string | null,
  founder: null as null | { name: string; role: string; bio: string },
}
