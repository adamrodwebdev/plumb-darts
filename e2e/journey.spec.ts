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
    expect(await stacked(page, 'grip', 'weight')).toBe(true)
    // The chapters are pinned again one task at a time (slower in WebKit): wait for the end, where
    // the anatomy's top is back near the top of the screen
    await expect
      .poll(() =>
        page.locator('#anatomy').evaluate((element) => {
          const top = element.getBoundingClientRect().top
          return top >= -1 && top < 250
        }),
      )
      .toBe(true)
  })
})
