import { LANGUAGES } from '../src/i18n/languages.ts'
import { JOURNEY_CHAPTERS, JOURNEY_HOLDS, JOURNEY_MOVE, planJourney } from '../src/rules/journey.ts'
import { settled } from './boot'
import { expect, test, type Page } from './fixtures'

/** A chapter's left edge on screen: 0 when it holds the screen in the sideways journey */
async function leftOf(page: Page, id: string): Promise<number> {
  return page.evaluate((chapter) => {
    const element = document.getElementById(chapter)
    return element ? Math.round(element.getBoundingClientRect().left) : Number.NaN
  }, id)
}

async function isSideways(page: Page): Promise<boolean> {
  return page.locator('[data-journey]').evaluate((frame) => frame.classList.contains('is-sideways'))
}

/** Chapters stacked one under the other: the second starts below the first one's top */
async function stacked(page: Page, upper: string, lower: string): Promise<boolean> {
  return page.evaluate(
    ([first, second]) => {
      const a = document.getElementById(first ?? '')?.getBoundingClientRect()
      const b = document.getElementById(second ?? '')?.getBoundingClientRect()
      return a !== undefined && b !== undefined && b.top >= a.bottom - 1
    },
    [upper, lower],
  )
}

test.describe('the journey of chapters 3 to 7', () => {
  test('travels sideways on a tall screen: the chapter menu brings each chapter on', async ({
    page,
  }) => {
    await page.goto('')
    await settled(page)
    expect(await isSideways(page)).toBe(true)

    await page.locator('[data-hud-toggle]').click()
    await page.locator('a[data-chapter-link="weight"]').click()

    await expect.poll(() => leftOf(page, 'weight')).toBe(0)
    expect(await leftOf(page, 'grip')).toBeLessThan(0)
    expect(await leftOf(page, 'anatomy')).toBeGreaterThan(0)
  })

  test('a link to one of its chapters lands on it and keeps it in the address', async ({
    page,
  }) => {
    await page.goto('#anatomy')
    await settled(page)

    await expect.poll(() => leftOf(page, 'anatomy')).toBe(0)
    await expect(page).toHaveURL(/#anatomy$/)
  })

  test('keyboard focus brings an off-screen chapter on, its control above the counter', async ({
    page,
  }) => {
    await page.goto('')
    await settled(page)

    const aim = page.getByLabel('Aim for')
    await aim.focus()

    await expect.poll(() => leftOf(page, 'throw')).toBe(0)
    // On a short phone the chapter's text also scrolls up, with the scrub's lag: wait for it
    await expect
      .poll(async () => {
        const control = await aim.boundingBox()
        const counter = await page.locator('.hud').boundingBox()
        if (!control || !counter) return false
        return control.y + control.height <= counter.y
      })
      .toBe(true)
  })

  test('stays stacked under reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('')
    await settled(page)

    expect(await isSideways(page)).toBe(false)
    expect(await stacked(page, 'grip', 'weight')).toBe(true)
  })

  test('turns stacked when the screen gets short, and keeps the reader in the same chapter', async ({
    page,
  }) => {
    await page.goto('#anatomy')
    await settled(page)
    await expect.poll(() => leftOf(page, 'anatomy')).toBe(0)
    const width = page.viewportSize()?.width ?? 1280

    // A phone turned to landscape, a laptop window made short: under 40rem the chapters stack
    await page.setViewportSize({ width, height: 500 })

    await expect.poll(() => isSideways(page)).toBe(false)
    // The chapters are pinned again one task at a time, at the old scroll position until the
    // landing: on the way a pinned chapter covers the next one (WebKit in CI read it there, twice,
    // 2026-11-09). The end state is read at once: the chapters stacked, the anatomy's top back near
    // the top of the screen
    await expect
      .poll(async () => {
        const anatomyOnTop = await page.locator('#anatomy').evaluate((element) => {
          const top = element.getBoundingClientRect().top
          return top >= -1 && top < 250
        })
        return anatomyOnTop && (await stacked(page, 'grip', 'weight'))
      })
      .toBe(true)
  })
})

/** The journey's holds, as the page plans them: one unit is one screen of scrolling */
const PLAN = planJourney(JOURNEY_CHAPTERS, JOURNEY_HOLDS, JOURNEY_MOVE)

/** Just before a chapter's hold ends: its text has scrolled all it ever scrolls (it stops at 0.9) */
const HOLD_END = 0.98

/**
 * Where a chapter's text block ends and where the score counter begins, once the scrubbed strip
 * and the text's own scrolling have come to rest (two reads apart give the same transform)
 */
async function restingText(page: Page, id: string): Promise<{ bottom: number; counter: number }> {
  let previous = ''
  await expect
    .poll(
      async () => {
        const now = await page.evaluate((chapter) => {
          const panel = document.getElementById(chapter)
          const text = panel?.querySelector('.chapter__text')
          if (!panel || !text) return 'missing'
          return `${getComputedStyle(text).transform} ${panel.getBoundingClientRect().left}`
        }, id)
        const resting = now === previous
        previous = now
        return resting
      },
      // The scrub eases for 0.6 s, and longer while a phone draws the 3D scene in software
      { intervals: [200], timeout: 15_000 },
    )
    .toBe(true)
  return page.evaluate((chapter) => {
    const text = document.getElementById(chapter)?.querySelector('.chapter__text')
    const counter = document.querySelector('.hud__toggle')
    return {
      bottom: text?.getBoundingClientRect().bottom ?? Number.NaN,
      counter: counter?.getBoundingClientRect().top ?? Number.NaN,
    }
  }, id)
}

// Longer copy (Russian and Indonesian run a fifth past the English) must still fit each hold
for (const language of LANGUAGES) {
  test(`in ${language.name}, each chapter’s last line is read above the counter by the end of its hold`, async ({
    page,
  }) => {
    // Five landings, each waiting for the strip and the text to rest: one landing never took more
    // than a few seconds, but five of them ran past the default 30 s on Mobile Chrome while the
    // whole suite ran (2026-11-09)
    test.slow()
    await page.goto(language.path)
    await settled(page)
    expect(await isSideways(page)).toBe(true)

    for (const stop of PLAN.stops) {
      // In screens of scrolling from the journey's start, as ScrollEffects maps them
      const at = stop.start + (stop.end - stop.start) * HOLD_END
      await page.evaluate((screens) => {
        const journey = document.querySelector('[data-journey]')
        const start = (journey?.getBoundingClientRect().top ?? 0) + window.scrollY
        window.scrollTo({
          top: Math.round(start + screens * window.innerHeight),
          behavior: 'instant',
        })
      }, at)
      await expect.poll(() => leftOf(page, stop.id)).toBe(0)

      const { bottom, counter } = await restingText(page, stop.id)
      expect(
        bottom,
        `${stop.id}: its text ends at ${bottom}, the counter starts at ${counter}`,
      ).toBeLessThanOrEqual(counter)
    }
  })
}

test('on a short screen, a link to a chapter lands on it once the chapters are pinned', async ({
  page,
}) => {
  // Stacked (under 40rem tall): the browser jumped before the pins added their room above the
  // chapter, and landed 2531 px short of the anatomy at 360 × 496 (2026-11-09)
  await page.setViewportSize({ width: 360, height: 496 })
  await page.goto('#anatomy')
  await settled(page)

  await expect
    .poll(() =>
      page.locator('#anatomy').evaluate((element) => Math.round(element.getBoundingClientRect().top)),
    )
    .toBeLessThan(120)
  expect(
    await page.locator('#anatomy').evaluate((element) => element.getBoundingClientRect().bottom),
  ).toBeGreaterThan(0)
})
