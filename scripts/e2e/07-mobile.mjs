// Phone width: the drawer menu and the landing page without sideways scroll.
export default async function mobile({ page, BASE, shot, expect, step }) {
  step('mobile layout')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('link', { name: 'Overview' }).click()
  await shot('13-mobile-overview')
  await page.goto(BASE)
  await shot('14-mobile-landing')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(!overflow, 'no horizontal scroll on mobile landing')
}
