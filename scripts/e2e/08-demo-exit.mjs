// From inside the demo, the audit button ends the demo and opens sign-up
// rather than looping back into the demo.
export default async function demoExit({ page, BASE, shot, expect, step }) {
  step('demo exit to the free audit')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/demo`)
  await page.getByTestId('hero-total').waitFor({ timeout: 20000 })
  await page.goto(BASE)
  await page.locator('a, button').filter({ hasText: 'Get a Free Revenue Leakage Audit' }).first().click()
  await page.waitForURL(/\/signup/)
  expect(page.url().includes('/signup'), `audit button opened ${page.url()}`)
  await page.getByRole('heading', { name: 'Get your free revenue leakage audit' }).waitFor()
  expect(await page.getByLabel('Your name').isVisible(), 'sign-up form shown, not the demo')
  await shot('15-demo-exit-signup')
}
