// Landing page, then into the demo.
export default async function landing({ page, BASE, shot, step }) {
  step('landing page')
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'Find the work your MSP is doing for free.' }).waitFor()
  await shot('01-landing')

  step('explore the demo')
  const t0 = Date.now()
  await page.getByRole('link', { name: 'Explore the demo' }).first().click()
  await page.getByTestId('hero-total').waitFor({ timeout: 20000 })
  console.log(`  demo ready in ${Date.now() - t0}ms`)
}
