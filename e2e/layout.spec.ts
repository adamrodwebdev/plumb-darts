import { expect, test, type Page } from './fixtures'
import { pageHeight, settled } from './boot'

/** Where a reader may stop: before, inside and after the chapters whose labels follow the 3D dart */
const PLACES = ['#grip', '#weight', '#anatomy', '#throw', '.dusk']

/** The tallest the page gets while the scene catches up with the scroll (scrub and labels) */
async function tallestWhileSettling(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let tallest = document.documentElement.scrollHeight
        const end = performance.now() + 1500
        const sample = (): void => {
          tallest = Math.max(tallest, document.documentElement.scrollHeight)
          if (performance.now() < end) requestAnimationFrame(sample)
          else resolve(tallest)
        }
        requestAnimationFrame(sample)
      }),
  )
}

// Labels moved by transforms once stretched the page from 10,000 to 29,000 px (bug lessons, 2026-11-09)
for (const place of PLACES) {
  test(`the story keeps its length when the reader stops at ${place}`, async ({ page }) => {
    await page.goto('')
    await settled(page)
    const length = await pageHeight(page)

    await page.locator(place).scrollIntoViewIfNeeded()

    expect((await tallestWhileSettling(page)) - length).toBeLessThan(200)
  })
}
