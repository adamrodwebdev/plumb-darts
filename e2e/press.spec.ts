import { settled } from './boot'
import { expect, test, type Page } from './fixtures'

interface Box {
  readonly top: number
  readonly bottom: number
  readonly left: number
  readonly right: number
}

/** What the press chapter shows while it holds the screen, as boxes on screen */
interface PressView {
  readonly masthead: number
  readonly screen: { readonly width: number; readonly height: number }
  readonly counter: Box
  readonly controls: Box[]
  /** The intro's words, when they show (they step aside while the chapter holds its end) */
  readonly words: Box[]
  /** The headline, when it sits above the ring (a phone) rather than inside it */
  readonly headline: Box | null
  /** The clippings that print (the one in front, and on a wide screen its neighbours) */
  readonly printed: Box[]
  /** Every clipping that shows, printed or blank */
  readonly shown: Box[]
}

const overlap = (a: Box, b: Box): boolean =>
  a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1

async function pressView(page: Page): Promise<PressView> {
  return page.evaluate(() => {
    const box = (element: Element): Box => {
      const rect = element.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }
    }
    const opaque = (element: Element): boolean =>
      Number.parseFloat(getComputedStyle(element).opacity) > 0.5
    const press = document.querySelector('#press')
    const masthead = document.querySelector('.masthead')
    const counter = document.querySelector('.hud__toggle')
    const title = press?.querySelector('.orbit__title')
    const intro = press?.querySelector('.press__intro')
    if (!press || !masthead || !counter || !title || !intro) {
      throw new Error('the press chapter is missing')
    }
    const clippings = [...press.querySelectorAll('.clipping')]
    return {
      masthead: box(masthead).bottom,
      screen: { width: window.innerWidth, height: window.innerHeight },
      counter: box(counter),
      controls: [...press.querySelectorAll('.orbit__controls > *')].map(box),
      words: opaque(intro) ? [...intro.children].map(box) : [],
      headline: getComputedStyle(title).position === 'static' ? box(title) : null,
      printed: clippings
        .filter((clipping) => {
          const headline = clipping.querySelector('.clipping__headline')
          return headline !== null && opaque(headline)
        })
        .map(box),
      shown: clippings.filter(opaque).map(box),
    }
  })
}

/** The ring follows the scroll with a lag, then the print switches: read once two reads agree */
async function restingView(page: Page): Promise<PressView> {
  let last = ''
  let view: PressView | null = null
  await expect
    .poll(
      async () => {
        view = await pressView(page)
        const now = JSON.stringify(view)
        const same = now === last
        last = now
        return same
      },
      { intervals: [300], timeout: 10_000 },
    )
    .toBe(true)
  if (!view) throw new Error('the press chapter was never read')
  return view
}

/**
 * The clippings stay in their place: below the masthead, clear of the intro's words, the
 * controls, the counter and the screen's edges, and on a phone clear of the headline above them
 */
function expectClear(view: PressView): void {
  const context = (part: unknown): string => JSON.stringify({ part, view })
  const controlsTop = Math.min(...view.controls.map((control) => control.top))
  expect(view.printed.length, context('printed')).toBeGreaterThan(0)
  for (const paper of view.printed) {
    expect(paper.top, context(paper)).toBeGreaterThanOrEqual(view.masthead - 1)
    expect(paper.bottom, context(paper)).toBeLessThanOrEqual(controlsTop + 1)
    expect(paper.left, context(paper)).toBeGreaterThanOrEqual(-1)
    expect(paper.right, context(paper)).toBeLessThanOrEqual(view.screen.width + 1)
    expect(overlap(paper, view.counter), context(paper)).toBe(false)
  }
  for (const paper of view.shown) {
    for (const word of view.words) {
      expect(overlap(paper, word), context({ paper, word })).toBe(false)
    }
    if (view.headline) expect(overlap(paper, view.headline), context(paper)).toBe(false)
  }
  for (const control of view.controls) {
    expect(overlap(control, view.counter), context(control)).toBe(false)
    expect(control.bottom, context(control)).toBeLessThanOrEqual(view.screen.height + 1)
  }
}

/** Lands on the press chapter, then brings each clipping to the front with Next */
async function expectClearAtEveryFront(page: Page): Promise<void> {
  await page.goto('#press')
  await settled(page)
  await expect(page.locator('.orbit.is-3d')).toHaveCount(1)
  const status = page.locator('[data-orbit-status]')
  const count = await page.locator('#press .clipping').count()
  for (let front = 1; front <= count; front += 1) {
    await expect(status).toContainText(`${front}`)
    expectClear(await restingView(page))
    if (front < count) await page.getByRole('button', { name: 'Next clipping' }).click()
  }
}

test('each clipping brought to the front keeps clear of the intro, the controls and the counter', async ({
  page,
}) => {
  await expectClearAtEveryFront(page)
})

test.describe('at the sizes of real screens', () => {
  // Every engine runs the test above at its project's own size; here only the size changes
  // eslint-disable-next-line playwright/no-skipped-test -- one engine is enough for the sizes
  test.skip(
    ({ browserName, isMobile }) => browserName !== 'chromium' || isMobile,
    'one engine, on its desktop project, for the size sweep',
  )

  for (const [width, height] of [
    [320, 568],
    [375, 548],
    [390, 844],
    [1280, 720],
    [1366, 657],
    [1920, 1080],
  ] as const) {
    test(`at ${width} × ${height}, each clipping keeps clear of the rest`, async ({ page }) => {
      await page.setViewportSize({ width, height })
      await expectClearAtEveryFront(page)
    })
  }
})

test('a phone on its side lays the clippings flat, and the ring comes back upright', async ({
  page,
  browserName,
  isMobile,
}) => {
  // eslint-disable-next-line playwright/no-skipped-test -- turning the screen is the same code in every engine
  test.skip(
    browserName !== 'chromium' || isMobile,
    'one engine, on its desktop project, for the turn',
  )
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto('')
  await settled(page)
  await expect(page.locator('.orbit')).not.toHaveClass(/is-3d/)

  // Flat, the chapter scrolls with the page instead of holding the screen
  const press = page.locator('#press')
  const topOf = (): Promise<number> =>
    press.evaluate((section) => Math.round(section.getBoundingClientRect().top))
  const top = await press.evaluate(
    (section) => section.getBoundingClientRect().top + window.scrollY,
  )
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(top))
  await expect.poll(topOf).toBe(0)
  await page.evaluate(() => window.scrollBy(0, 200))
  await expect.poll(topOf).toBe(-200)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('.orbit.is-3d')).toHaveCount(1)
  await expectClearAtEveryFront(page)
})
