// The demo overview's pinned figures.
export default async function overview({ page, shot, expect, step }) {
  step('dashboard shows £4,281')
  await page.getByTestId('hero-total').waitFor({ timeout: 20000 })
  const hero = await page.getByTestId('hero-total').innerText()
  expect(hero === '£4,281', `hero total was ${hero}`)
  expect(await page.getByText('£356').count(), 'monthly recurring £356')
  expect(await page.getByText('£4,272').count(), 'annualised £4,272')
  await shot('02-overview')
}
