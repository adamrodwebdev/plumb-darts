import AxeBuilder from '@axe-core/playwright'
import { settled } from './boot'
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

test('a clipping of the orbit is printed whole or not at all, at any turn of the ring', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('')
  await settled(page)
  const ring = page.locator('.orbit.is-3d [data-orbit-ring]')
  await expect(ring).toHaveCount(1)

  // Turns that leave a clipping near the side of the ring, where its print used to fade
  for (const turn of [25, 85, 149, 205, 266, 331]) {
    await ring.evaluate((element, degrees) => {
      element.style.setProperty('--turn', `${degrees}deg`)
    }, turn)
    await expect
      .poll(() =>
        ring.evaluate(
          (element) =>
            [...element.querySelectorAll('.clipping__paper > *')].filter((part) => {
              const opacity = Number.parseFloat(getComputedStyle(part).opacity)
              return opacity > 0.01 && opacity < 0.99
            }).length,
        ),
      )
      .toBe(0)
  }
})
