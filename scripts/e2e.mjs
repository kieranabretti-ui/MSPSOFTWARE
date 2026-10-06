// End-to-end smoke test of the core demo and upload flows (local mode).
// Usage: start `npm run dev` (or `npm run preview`), then `npm run e2e`.
import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'

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
  step('landing page')
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'How much money is your MSP giving away?' }).waitFor()
  await shot('01-landing')

  step('view demo → dashboard shows £4,281')
  const t0 = Date.now()
  await page.getByRole('link', { name: 'View Demo' }).first().click()
  await page.getByTestId('hero-total').waitFor({ timeout: 20000 })
  const hero = await page.getByTestId('hero-total').innerText()
  expect(hero === '£4,281', `hero total was ${hero}`)
  expect(await page.getByText('£356').count(), 'monthly recurring £356')
  expect(await page.getByText('£4,272').count(), 'annualised £4,272')
  console.log(`  demo ready in ${Date.now() - t0}ms`)
  await shot('02-overview')

  step('findings list + filter')
  await page.getByRole('link', { name: 'Findings' }).first().click()
  await page.getByRole('heading', { name: 'Findings' }).waitFor()
  await page.getByLabel('Category').selectOption('OUT_OF_SCOPE')
  await until(async () => (await page.locator('tbody tr').count()) === 12, 'out of scope count 12')
  await shot('03-findings')

  step('finding detail #18492')
  await page.getByPlaceholder('Search findings, clients, ticket #').fill('18492')
  await until(async () => (await page.locator('tbody tr').count()) === 1, 'search narrows to one')
  await page.locator('tbody tr').first().click()
  await page.getByTestId('finding-value').waitFor()
  expect((await page.getByTestId('finding-value').innerText()) === '£80', 'finding value £80')
  expect(await page.getByText('94%').count(), 'confidence 94%')
  expect(await page.getByText('James Smith').count(), 'technician')
  await shot('04-finding')

  step('mark valid + create action')
  await page.getByRole('button', { name: 'Mark as valid' }).click()
  await page.getByRole('button', { name: 'Create action' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Create action' }).click()
  await page.getByText('Action created.').waitFor()

  step('actions page: move to resolved')
  await page.getByRole('link', { name: 'Actions' }).first().click()
  await page.getByLabel('Action status').first().selectOption('resolved')
  await page.getByText('Action resolved').waitFor()
  await shot('05-actions')

  step('clients + profitability')
  await page.getByRole('link', { name: 'Clients' }).first().click()
  await page.getByRole('tab', { name: 'profitability' }).click()
  await shot('06-clients')
  await page.getByRole('link', { name: 'Castle Accountancy' }).click()
  await page.getByText('Gross contribution').waitFor()
  await shot('07-client-detail')

  step('report + PDF + CSV')
  await page.getByRole('link', { name: 'Reports' }).first().click()
  await page.getByRole('heading', { name: 'MSP Revenue Leakage Report' }).waitFor()
  await shot('08-report')
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()])
  await pdf.saveAs(`${SHOTS}/report.pdf`)
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()])
  await csv.saveAs(`${SHOTS}/findings.csv`)

  step('dismiss a finding lowers the total')
  await page.getByRole('link', { name: 'Findings' }).first().click()
  await page.getByPlaceholder('Search findings, clients, ticket #').waitFor()
  await page.locator('tbody tr').first().click()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await page.getByRole('link', { name: 'Overview' }).click()
  await until(async () => (await page.getByTestId('hero-total').innerText()) !== '£4,281', 'total changes after dismiss')

  step('sign out, sign up, create workspace')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.goto(`${BASE}/signup`)
  await page.getByLabel('Your name').fill('Test User')
  await page.getByLabel('Work email').fill(`test${Date.now()}@example.com`)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('MSP name').fill('Acme IT')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await page.getByText('Find out where your MSP is losing money').waitFor()
  await shot('09-empty')

  step('CSV upload with column mapping')
  await page.getByRole('link', { name: 'Data' }).first().click()
  const clientsCsv = 'Company Name,MRR,Seats,Endpoints,Plan\nRedwood Dental,"£1,200",10,12,Essentials\nOak & Co,800,6,8,Essentials\n'
  writeFileSync(`${SHOTS}/clients.csv`, clientsCsv)
  await page.getByTestId('upload-clients').click()
  await page.getByTestId('file-input').setInputFiles(`${SHOTS}/clients.csv`)
  await page.getByText('All 2 rows look valid.').waitFor()
  expect((await page.getByLabel('Column for Client name').inputValue()) === 'Company Name', 'automap client')
  await shot('10-mapping')
  await page.getByRole('button', { name: /^Import 2 rows/ }).click()
  await page.getByText('Imported 2 rows.').waitFor()
  await page.getByRole('button', { name: 'Done' }).click()

  const ticketsCsv = [
    'Ref,Customer,Opened,Engineer,Title,Notes,Mins,Chargeable,Extra',
    '501,Redwood Dental,03/09/2026 10:15,Sam,Set up new laptop for receptionist,,90,No,x',
    '502,Redwood Dental,04/09/2026 11:00,Sam,Password reset,,15,No,x',
    '503,Oak & Co,05/09/2026 12:00,Jo,Configure director\'s personal iPhone,,45,No,x',
    '504,Oak & Co,bad date,Jo,Printer offline,,20,No,x',
  ].join('\n')
  writeFileSync(`${SHOTS}/tickets.csv`, ticketsCsv)
  await page.getByTestId('upload-tickets').click()
  await page.getByTestId('file-input').setInputFiles(`${SHOTS}/tickets.csv`)
  await page.getByText('Map the required fields').waitFor()
  await page.getByLabel('Column for Ticket ID').selectOption('Ref')
  await page.getByLabel('Column for Date').selectOption('Opened')
  await page.getByLabel('Column for Subject').selectOption('Title')
  await page.getByLabel('Column for Time spent (minutes)').selectOption('Mins')
  await page.getByText('1 row will be skipped').waitFor()
  await page.getByRole('button', { name: /^Import 3 rows/ }).click()
  await page.getByText('Imported 3 rows.').waitFor()
  await page.getByRole('button', { name: 'Done' }).click()

  step('PDF contract upload')
  const [samplePdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Sample contract PDF' }).click()])
  await samplePdf.saveAs(`${SHOTS}/contract.pdf`)
  await page.getByRole('button', { name: 'Upload PDF' }).click()
  await page.getByRole('dialog').getByRole('combobox').first().selectOption({ label: 'Oak & Co' })
  await page.getByTestId('file-input').setInputFiles(`${SHOTS}/contract.pdf`)
  await page.getByText('Company-owned devices only').first().waitFor({ timeout: 15000 })
  await shot('11-contract')
  await page.getByRole('button', { name: 'Save contract' }).click()
  await page.getByText('Contract saved').waitFor()

  step('run analysis on uploaded data')
  await page.getByTestId('run-analysis').click()
  await page.getByTestId('hero-total').waitFor({ timeout: 15000 })
  const own = await page.getByTestId('hero-total').innerText()
  console.log(`  uploaded data total ${own}`)
  expect(own !== '£0', 'found leakage in uploaded data')
  await page.getByRole('link', { name: 'Findings' }).first().click()
  expect(await page.getByText('Personal device supported free of charge').count(), 'personal device OOS from PDF contract')
  expect(await page.getByText(/Potentially billable new device setup/).count(), 'unbilled new laptop')
  await shot('12-own-findings')

  step('mobile layout')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('link', { name: 'Overview' }).click()
  await shot('13-mobile-overview')
  await page.goto(BASE)
  await shot('14-mobile-landing')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(!overflow, 'no horizontal scroll on mobile landing')
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
