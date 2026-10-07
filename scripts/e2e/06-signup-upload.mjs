// A new account: sign up, create a workspace and set its rates, upload CSVs
// (and one again, which updates rather than duplicates) and a contract PDF,
// then run the analysis on that data.
import { writeFileSync } from 'node:fs'

export default async function signupUpload({ page, BASE, SHOTS, shot, expect, until, step }) {
  step('sign out, sign up, create workspace')
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.goto(`${BASE}/signup`)
  await page.getByLabel('Your name').fill('Test User')
  await page.getByLabel('Work email').fill(`test${Date.now()}@example.com`)
  await page.getByLabel('Password').fill('password123')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByLabel('MSP name').fill('Acme IT')
  await page.getByRole('button', { name: 'Create workspace' }).click()
  await page.getByRole('button', { name: 'Save and continue' }).click()
  await page.getByText('Find out where your MSP is losing money').waitFor()
  await shot('09-empty')

  step('CSV upload with column mapping')
  await page.getByRole('link', { name: 'Analyses' }).first().click()
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

  step('re-upload the same tickets: updated, not duplicated')
  await page.getByTestId('upload-tickets').click()
  await page.getByTestId('file-input').setInputFiles(`${SHOTS}/tickets.csv`)
  await page.getByText('1 row will be skipped').waitFor()
  expect((await page.getByText(/already imported/).count()) > 0, 'duplicate upload notice')
  await page.getByRole('button', { name: /^Import 3 rows/ }).click()
  await page.getByText('Imported 3 rows (3 already imported were updated).').waitFor()
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
  await page.getByText('Analysis complete').waitFor({ timeout: 15000 })
  await page.getByRole('link', { name: 'View overview' }).click()
  await page.getByTestId('hero-total').waitFor({ timeout: 15000 })
  const own = await page.getByTestId('hero-total').innerText()
  console.log(`  uploaded data total ${own}`)
  expect(own !== '£0', 'found leakage in uploaded data')
  await page.getByRole('link', { name: 'Opportunities' }).first().click()
  await page.getByPlaceholder('Search opportunities, clients, ticket #').waitFor()
  expect(await page.getByText('Personal device supported free of charge').count(), 'personal device OOS from PDF contract')
  expect(await page.getByText(/Potentially billable new device setup/).count(), 'unbilled new laptop')
  await shot('12-own-findings')
  await page.getByPlaceholder('Search opportunities, clients, ticket #').fill('501')
  await until(async () => (await page.locator('tbody tr').count()) === 1, 'ticket #501 appears in exactly one row')
}
