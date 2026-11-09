// Swept on the desktop engines; the phone projects keep their own device sizes (playwright.config.ts)
import { expect, test, type Page } from './fixtures'

/** From the smallest phone to a large desktop screen */
const WIDTHS = [320, 360, 390, 412, 768, 1024, 1280, 1440, 1920, 2560]

/** Elements reaching past the right edge, named, when the page scrolls sideways; none otherwise */
async function sideways(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    if (document.documentElement.scrollWidth <= width) return []
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => element.getBoundingClientRect().right > width + 1)
      .slice(0, 8)
      .map(
        (element) =>
          `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}.${element.classList[0] ?? ''}`,
      )
  })
}

test.describe('no horizontal scroll', () => {
  for (const width of WIDTHS) {
    test(`at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('')
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

      expect(await sideways(page)).toEqual([])
    })
  }

  test('at 320 × 256, the 400 % zoom of WCAG 1.4.10', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 256 })
    await page.goto('')
    await expect(page.getByRole('heading', { level: 1 })).toBeAttached()

    expect(await sideways(page)).toEqual([])
  })
})
