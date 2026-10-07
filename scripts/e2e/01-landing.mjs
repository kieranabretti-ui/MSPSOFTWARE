// Landing page, then into the demo.
export default async function landing({ page, BASE, shot, step, expect }) {
  step('landing page')
  await page.goto(BASE)
  // The pricing section repeats the tagline as its h2, so the hero is the level-1 heading.
  await page.getByRole('heading', { level: 1, name: 'Find the work your MSP is doing for free.' }).waitFor()
  await shot('01-landing')

  step('pricing: monthly and annual')
  const pricing = page.locator('#pricing')
  await pricing.scrollIntoViewIfNeeded()
  const growth = pricing.getByTestId('price-growth')
  const monthly = await growth.textContent()
  expect(await pricing.getByRole('link', { name: 'Start Monitoring' }).isVisible(), 'Growth button visible')
  const box = await growth.boundingBox()
  await pricing.locator('label', { hasText: 'Annual' }).click()
  expect(await pricing.getByRole('radio', { name: /^Annual/ }).isChecked(), 'Annual is checked')
  const annual = await growth.textContent()
  expect(annual !== monthly, `annual shows a per-month equivalent (${monthly} -> ${annual})`)
  expect((await growth.boundingBox()).y === box.y, 'the toggle does not move the price')
  await pricing.locator('label', { hasText: 'Monthly' }).click()

  step('explore the demo')
  const t0 = Date.now()
  await page.getByRole('link', { name: 'Explore the demo' }).first().click()
  await page.getByTestId('hero-total').waitFor({ timeout: 20000 })
  console.log(`  demo ready in ${Date.now() - t0}ms`)
}
