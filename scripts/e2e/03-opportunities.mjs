// Opportunities list, filter and detail, then the recovery queue.
export default async function opportunities({ page, shot, expect, until, step }) {
  step('opportunities list + filter')
  await page.getByRole('link', { name: 'Opportunities' }).first().click()
  await page.getByRole('heading', { name: 'Opportunities' }).waitFor()
  await page.getByLabel('Category').selectOption('OUT_OF_SCOPE')
  await until(async () => (await page.locator('tbody tr').count()) === 12, 'out of scope count 12')
  await shot('03-opportunities')

  step('opportunity detail #18492')
  await page.getByPlaceholder('Search opportunities, clients, ticket #').fill('18492')
  await until(async () => (await page.locator('tbody tr').count()) === 1, 'search narrows to one')
  await page.locator('tbody tr').first().click()
  await page.getByTestId('finding-value').waitFor()
  expect((await page.getByTestId('finding-value').innerText()) === '£80', 'opportunity value £80')
  // Only a keyword match links the ticket to personal-device work: Medium.
  expect(await page.getByText('Medium confidence').count(), 'medium confidence')
  expect(await page.getByText('James Smith').count(), 'technician')
  await shot('04-opportunity')

  step('move through the stages')
  await page.getByRole('button', { name: 'Start review' }).click()
  await page.getByText('Moved to Reviewing.').waitFor()
  await page.getByRole('button', { name: 'Approve' }).click()
  await page.getByText('Approved.').waitFor()

  step('recovery queue: mark actioned')
  await page.getByRole('link', { name: 'Recovery queue' }).click()
  await page.getByRole('tab', { name: /Approved/ }).click()
  await page.getByRole('button', { name: 'Mark actioned' }).first().click()
  await page.getByText('Marked as actioned.').waitFor()
  await shot('05-queue')
}
