// Plain formatters the engine writes into opportunities and the app shows
// beside them. Kept apart from analyse.ts so pages that only display an
// opportunity don't load the rules engine.

export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export function monthLabel(month: string, style: 'short' | 'long' = 'short'): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleString('en-GB', style === 'short' ? { month: 'short' } : { month: 'long', year: 'numeric' })
}

export function periodLabel(first: string, last: string): string {
  if (first === last) return monthLabel(first, 'long')
  const sameYear = first.slice(0, 4) === last.slice(0, 4)
  const start = sameYear ? monthLabel(first, 'long').replace(/ \d{4}$/, '') : monthLabel(first, 'long')
  return `${start} – ${monthLabel(last, 'long')}`
}

// A word joiner keeps a sign on the same line as its figure: "(+£47)" never
// breaks after the "+". Strip it where text leaves the browser (PDF, CSV).
export const WJ = '\u2060'
export const signed = (figure: string) => `+${WJ}${figure}`
export const stripJoiners = (text: string) => text.replace(/\u2060/g, '')
