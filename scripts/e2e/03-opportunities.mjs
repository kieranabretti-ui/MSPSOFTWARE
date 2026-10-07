// Opportunities list, filter and detail, then the recovery queue.
export default async function opportunities({ page, BASE, shot, expect, until, step }) {
  step('findings list + filter')
  await page.getByRole('link', { name: 'Opportunities' }).first().click()
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
  await page.goto(`${BASE}/app/queue`)
  await page.getByLabel('Action status').first().selectOption('resolved')
  await page.getByText('Action resolved').waitFor()
  await shot('05-actions')
}
