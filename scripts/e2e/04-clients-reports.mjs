// Clients, a client profile with its contract against reality, the Contracts
// page, and the report with its downloads.
export default async function clientsReports({ page, SHOTS, shot, expect, until, step }) {
  step('clients + profitability')
  await page.getByRole('link', { name: 'Clients' }).first().click()
  await page.getByRole('tab', { name: 'profitability' }).click()
  await shot('06-clients')
  await page.getByRole('link', { name: 'Castle Accountancy' }).click()
  await page.getByText('Gross contribution').waitFor()
  await page.getByRole('heading', { name: 'Contract vs reality', exact: true }).waitFor()
  await shot('07-client-detail')

  step('contracts: every client, linked to its contract')
  await page.getByRole('link', { name: 'Contracts', exact: true }).first().click()
  await page.getByRole('heading', { name: 'Contracts', exact: true }).waitFor()
  await until(async () => (await page.locator('tbody tr').count()) === 15, 'contracts lists 15 clients')
  expect(await page.getByRole('link', { name: 'ABC Ltd' }).getAttribute('href').then((h) => h?.endsWith('#contract')), 'client links to its contract section')
  await shot('07b-contracts')

  step('report + PDF + CSV')
  await page.getByRole('link', { name: 'Reports' }).first().click()
  await page.getByRole('heading', { name: 'MSP Revenue Leakage Report' }).waitFor()
  expect(await page.getByText('How to read confidence').count(), 'report explains confidence')
  await shot('08-report')
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByTestId('download-pdf').click()])
  await pdf.saveAs(`${SHOTS}/report.pdf`)
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()])
  await csv.saveAs(`${SHOTS}/opportunities.csv`)
}
