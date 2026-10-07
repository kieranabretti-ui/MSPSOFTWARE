// Clients, a client profile, and the report with its downloads.
export default async function clientsReports({ page, SHOTS, shot, step }) {
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
}
