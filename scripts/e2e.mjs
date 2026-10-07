// End-to-end smoke test of the core demo and upload flows (local mode).
// Usage: start `npm run dev` (or `npm run preview`), then `npm run e2e`.
// The steps live in scripts/e2e/*.mjs, one file per area, and run in filename
// order on one page, so each file picks up where the last one left off.
import { chromium } from 'playwright'
import { mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const STEPS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'e2e')
const steps = readdirSync(STEPS_DIR)
  .filter((f) => f.endsWith('.mjs'))
  .sort()
const BASE = process.env.BASE_URL ?? 'http://localhost:5173'
const SHOTS = process.env.SHOTS ?? 'screenshots'
mkdirSync(SHOTS, { recursive: true })
const errors = []
const step = (name) => console.log(`• ${name}`)
const expect = (cond, msg) => {
  if (!cond) throw new Error(`Assertion failed: ${msg}`)
}

const until = async (fn, msg, ms = 5000) => {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await fn()) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`Timed out: ${msg}`)
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {})
console.log(`browser: ${browser.version()}`)
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(`pageerror: ${e.stack ?? e.message}`))
page.on('console', (m) => m.type() === 'error' && !/fonts\.g/.test(m.text()) && errors.push(`console: ${m.text()}`))
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true })

try {
  for (const file of steps) {
    const { default: run } = await import(pathToFileURL(join(STEPS_DIR, file)).href)
    await run({ page, ctx, BASE, SHOTS, shot, expect, until, step })
  }
} catch (e) {
  await shot('zz-failure').catch(() => undefined)
  console.error(e)
  process.exitCode = 1
} finally {
  if (errors.length) {
    console.error('Browser errors:\n' + errors.join('\n'))
    process.exitCode = 1
  }
  await browser.close()
  if (!process.exitCode) console.log('All end-to-end checks passed.')
}
