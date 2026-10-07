// Writes the demo MSP as upload-ready files in samples/ so the CSV import,
// column mapping and PDF contract flows can be tried with realistic data.
//   npm run samples
import { mkdirSync, writeFileSync } from 'node:fs'
import { generateDemo } from '../src/demo/generate'
import { SCHEMAS, KIND_ORDER } from '../src/data/importers'
import { textToPdf } from '../src/lib/pdf'
import { toCsv } from '../src/lib/format'

const out = new URL('../samples/', import.meta.url)
mkdirSync(new URL('contracts/', out), { recursive: true })

const raw = generateDemo()
const FILES = { clients: 'clients.csv', tickets: 'tickets.csv', time_entries: 'time-entries.csv', assets: 'users-and-devices.csv', billing: 'billing.csv' } as const

for (const kind of KIND_ORDER) {
  const keys = SCHEMAS[kind].fields.map((f) => f.key)
  const rows = raw[kind].map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? ''])))
  writeFileSync(new URL(FILES[kind], out), toCsv(rows) + '\n')
  console.log(`${FILES[kind]}: ${rows.length} rows`)
}

for (const c of raw.contracts) {
  const name = `${c.client.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
  const pdf = await textToPdf(c.title, c.text)
  writeFileSync(new URL(`contracts/${name}`, out), Buffer.from(await pdf.arrayBuffer()))
}
console.log(`contracts/: ${raw.contracts.length} PDFs`)
