// Dismissing an opportunity takes it out of the total.
export default async function dismiss({ page, until, step }) {
  step('dismissing an opportunity lowers the total')
  await page.getByRole('link', { name: 'Opportunities' }).first().click()
  await page.getByPlaceholder('Search opportunities, clients, ticket #').waitFor()
  await page.locator('tbody tr').first().click()
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await page.getByRole('link', { name: 'Overview' }).click()
  await until(async () => (await page.getByTestId('hero-total').innerText()) !== '£4,281', 'total changes after dismiss')
}
