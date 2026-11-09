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

/** The scroll story follows the wheel with a lag: the labels have come to rest */
async function restingLabels(page: Page): Promise<void> {
  let last = ''
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await shownLabels(page))
        const same = now === last
        last = now
        return same
      },
      { intervals: [250], timeout: 10_000 },
    )
    .toBe(true)
}

/** The labels showing cover neither the chapter's words, nor each other, nor the masthead */
async function expectClearLabels(page: Page): Promise<void> {
  const labels = await shownLabels(page)
  // The words themselves (label, title, paragraph), not their block, whose top padding keeps the
  // band for the object
  const words = await page.locator('#anatomy .chapter__text > *').evaluateAll((parts) =>
    parts.map((part) => {
      const box = part.getBoundingClientRect()
      return { x: box.x, y: box.y, width: box.width, height: box.height }
    }),
  )
  const masthead = await page.locator('.masthead').boundingBox()
  const below = (masthead?.y ?? 0) + (masthead?.height ?? 0)
  for (const [index, label] of labels.entries()) {
    expect(label.y, JSON.stringify({ label, below })).toBeGreaterThanOrEqual(below - 0.5)
    for (const part of words) expect(overlap(label, part), JSON.stringify({ label, part })).toBe(false)
    for (const other of labels.slice(index + 1)) {
      expect(overlap(label, other), JSON.stringify({ label, other })).toBe(false)
    }
  }
}

// Phones from the narrowest the site supports (320 px), sideways (tall enough) and stacked (320 × 568,
// 360 × 496): the labels sat on the anatomy's paragraph at 360 px wide in v0.2 (found by the
// marketing capture, 2026-11-09)
for (const { width, height } of [
  { width: 320, height: 568 },
  { width: 320, height: 640 },
  { width: 360, height: 640 },
  { width: 360, height: 496 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
]) {
  test(`at ${width} × ${height}, the anatomy's labels cover neither its words, nor each other, nor the masthead`, async ({
    page,
    browserName,
  }) => {
    // The 3D scene (and its labels) runs where the test's GPU stand-in works: Chromium
    // eslint-disable-next-line playwright/no-skipped-test -- the labels follow the 3D scene, which the test's GPU stand-in draws in Chromium only
    test.skip(browserName !== 'chromium', 'the labels follow the 3D scene, drawn in Chromium here')
    await page.setViewportSize({ width, height })
    await page.goto('#anatomy')
    await settled(page)
    // Through the chapter's hold, while the dart comes apart and once it is apart: the labels
    // showing at each point cover neither the words, nor each other, nor the masthead
    for (const share of [0.6, 0.3]) {
      await page.mouse.wheel(0, Math.round(height * share))
      await restingLabels(page)
      await expectClearLabels(page)
    }
    await page.mouse.wheel(0, Math.round(height * 0.3))
    await expect.poll(async () => (await shownLabels(page)).length, { timeout: 10_000 }).toBe(4)
    await restingLabels(page)
    await expectClearLabels(page)
  })
}
