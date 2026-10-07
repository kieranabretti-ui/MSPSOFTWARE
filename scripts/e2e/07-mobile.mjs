// Phone width: the app's drawer menu, then the landing page's menu and no sideways scroll.
export default async function mobile({ page, BASE, shot, expect, step }) {
  step('mobile layout')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('link', { name: 'Overview' }).click()
  await shot('13-mobile-overview')
  await page.goto(BASE)
  await shot('14-mobile-landing')

  step('landing menu')
  const menu = page.getByRole('button', { name: 'Menu' })
  await menu.click()
  const panel = page.locator(`[id="${await menu.getAttribute('aria-controls')}"]`)
  await panel.getByRole('link', { name: 'Pricing' }).waitFor()
  expect(await panel.getByRole('link', { name: 'Pricing' }).isVisible(), 'Pricing link visible in the menu')
  await page.keyboard.press('Escape')
  expect((await menu.getAttribute('aria-expanded')) === 'false', 'Escape closes the menu')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(!overflow, 'no horizontal scroll on mobile landing')
}
