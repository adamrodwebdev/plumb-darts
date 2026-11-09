import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from './fixtures'

/** WCAG 2.2 AA, the level the project promises */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

/** Each violation as "rule: element, element" so a failure names what to fix */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  )
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the page meets WCAG 2.2 AA in the ${colorScheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
    await page.goto('')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    // Enhanced parts stay hidden until their script marks them ready: scan once they are shown.
    // The orbit's controls stay hidden under reduced motion, where the clippings are a flat grid
    await expect(
      page.locator('[data-enhance]:not(.is-ready):not([data-orbit-controls])'),
    ).toHaveCount(0)
    // WebKit shows a button's label a few frames after its form (46 ms under reduced motion, seen
    // 2026-11-09): axe would meet a visible button whose name is still hidden
    await expect(page.locator('[data-throw-panel] .button__label').first()).toBeVisible()
    await expect(page.locator('[data-throw-panel] .button__label').last()).toBeVisible()

    expect(await violations(page)).toEqual([])
  })
}

test('the missing page meets WCAG 2.2 AA', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('404.html')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  expect(await violations(page)).toEqual([])
})
