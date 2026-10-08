// Dismissing an opportunity takes it out of the total.
export default async function dismiss({ page, until, step }) {
  step('dismissing an opportunity lowers the total')
  await page.getByRole('link', { name: 'Opportunities' }).first().click()
  await page.getByPlaceholder('Search opportunities, clients, ticket #').waitFor()
  await page.locator('tbody tr').first().click()
  await page.getByRole('button', { name: 'Dismiss', exact: true }).click()
  await page.getByRole('dialog').getByText('The data is wrong').click()
  await page.getByRole('button', { name: 'Dismiss opportunity' }).click()
  await page.getByText('Dismissed. It no longer counts towards the potential total.').waitFor()
  await page.getByRole('link', { name: 'Overview' }).click()
  await until(async () => (await page.getByTestId('hero-total').innerText()) !== '£4,281', 'total changes after dismiss')
}
