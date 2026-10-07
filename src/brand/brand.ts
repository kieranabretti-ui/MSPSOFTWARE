// The product's name and lines, in one place.
export const BRAND = {
  name: 'Headroom',
  tagline: 'Find the work your MSP is doing for free.',
} as const

// Owner-supplied facts. Leave null until confirmed; the site hides anything null. Never invent these.
export const COMPANY = {
  descriptor: 'Commercial intelligence for MSPs',
  legalName: null as string | null,
  registeredAddress: null as string | null,
  contactEmail: null as string | null,
  securityEmail: null as string | null,
  privacyUrl: null as string | null,
  termsUrl: null as string | null,
  founder: null as null | { name: string; role: string; bio: string },
}
