import { settled } from './boot'
import { expect, test, type Page } from './fixtures'

interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

const overlap = (a: Box, b: Box): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** The part labels shown on screen (their opacity follows the exploded view), as boxes */
async function shownLabels(page: Page): Promise<Box[]> {
  return page.locator('#anatomy .marker--part').evaluateAll((markers) =>
    markers
      .filter((marker) => Number.parseFloat(getComputedStyle(marker).opacity) > 0.5)
      .map((marker) => {
        const box = marker.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      }),
  )
}

// Phones tall enough for the sideways journey: the labels sat on the anatomy's paragraph at 360 px
// wide in v0.2 (found by the marketing capture, 2026-11-09). The stacked layout of short screens
// (360 × 496) lands differently and comes with its own case
for (const { width, height } of [
  { width: 320, height: 640 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`at ${width} × ${height}, the anatomy's labels never cover its words`, async ({
    page,
    browserName,
  }) => {
    // The 3D scene (and its labels) runs where the test's GPU stand-in works: Chromium
    // eslint-disable-next-line playwright/no-skipped-test -- the labels follow the 3D scene, which the test's GPU stand-in draws in Chromium only
    test.skip(browserName !== 'chromium', 'the labels follow the 3D scene, drawn in Chromium here')
    await page.setViewportSize({ width, height })
    await page.goto('#anatomy')
    await settled(page)
    // Further into the chapter's hold: the dart explodes and its labels come on
    await page.mouse.wheel(0, Math.round(height * 1.2))
    await expect.poll(async () => (await shownLabels(page)).length, { timeout: 10_000 }).toBe(4)

    // The words themselves (label, title, paragraph), not their block, whose top padding keeps
    // the band for the object
    const words = await page.locator('#anatomy .chapter__text > *').evaluateAll((parts) =>
      parts.map((part) => {
        const box = part.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      }),
    )
    expect(words.length).toBeGreaterThan(0)
    for (const label of await shownLabels(page)) {
      for (const part of words) {
        expect(overlap(label, part), JSON.stringify({ label, part })).toBe(false)
      }
    }
  })
}
