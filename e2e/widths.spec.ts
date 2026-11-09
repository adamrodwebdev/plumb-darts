// Swept on the desktop engines; the phone projects keep their own device sizes (playwright.config.ts)
import { LANGUAGES } from '../src/i18n/languages.ts'
import { expect, test, type Page } from './fixtures'

/** From the smallest phone to a large desktop screen */
const WIDTHS = [320, 360, 390, 412, 768, 1024, 1280, 1440, 1920, 2560]

/** The phone widths where the masthead's row is tightest, the breakpoint's edges included */
const PHONE_WIDTHS = [320, 344, 360, 375, 383, 384, 390, 412]

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

/**
 * The masthead's items that leave the screen or run into the next one. A fixed row never scrolls
 * the page, so the sideways sweep cannot see it (bug lessons: a header row at 320 px)
 */
async function crowdedMasthead(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    const items = ['.brand', '.lang-menu__toggle', '[data-theme-toggle]', '[data-sound-toggle]']
      .map((selector) => ({
        selector,
        box: document.querySelector(selector)?.getBoundingClientRect(),
      }))
      .filter((item) => item.box !== undefined && item.box.width > 0)
    return items.flatMap(({ selector, box }, index) => {
      const next = items[index + 1]?.box
      const problems: string[] = []
      if (!box) return problems
      if (box.left < 0 || box.right > width) problems.push(`${selector} leaves the screen`)
      if (next && box.right > next.left) problems.push(`${selector} runs into the next item`)
      return problems
    })
  })
}

/** The headline's lines that reach past the screen's edge */
async function overflowingHeadline(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth
    return [...document.querySelectorAll<HTMLElement>('.hero__line, .hero__line--rest > span')]
      .filter((line) => {
        const range = document.createRange()
        range.selectNodeContents(line)
        return range.getBoundingClientRect().right > width
      })
      .map((line) => line.textContent ?? '')
  })
}

for (const language of LANGUAGES) {
  test.describe(`no horizontal scroll in ${language.name}`, () => {
    for (const width of WIDTHS) {
      test(`at ${width} px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 })
        await page.goto(language.path)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

        expect(await sideways(page)).toEqual([])
      })
    }

    test('at 320 × 256, the 400 % zoom of WCAG 1.4.10', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 256 })
      await page.goto(language.path)
      await expect(page.getByRole('heading', { level: 1 })).toBeAttached()

      expect(await sideways(page)).toEqual([])
    })
  })

  test(`the masthead holds its wordmark and controls on one line in ${language.name}, from 320 px`, async ({
    page,
  }) => {
    await page.goto(language.path)
    await expect(page.locator('[data-sound-toggle].is-ready')).toBeAttached()
    await page.evaluate(() => document.fonts.ready)

    for (const width of PHONE_WIDTHS) {
      await page.setViewportSize({ width, height: 800 })
      expect(await crowdedMasthead(page), `${width} px`).toEqual([])
    }
  })

  test(`the ${language.name} headline fits a 320 px screen`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto(language.path)
    // Set in its embedded face from the first paint, so no font load can move it later
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    expect(await overflowingHeadline(page)).toEqual([])
  })
}
