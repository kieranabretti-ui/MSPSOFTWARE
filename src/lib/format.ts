export const money = (n: number, opts: { decimals?: boolean } = {}) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: opts.decimals ? 2 : 0, minimumFractionDigits: opts.decimals ? 2 : 0 }).format(n)

export const num = (n: number, digits = 0) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: digits }).format(n)
export const pct = (n: number) => `${Math.round(n * 100)}%`
export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${num(n)} ${n === 1 ? word : pluralWord}`

export function hours(h: number) {
  return `${num(h, 1)}h`
}

export function dateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const hasTime = /T\d{2}:\d{2}/.test(iso)
  return d.toLocaleString('en-GB', hasTime ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' })
}

export function relative(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return dateTime(iso)
}

export function downloadFile(name: string, content: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}
