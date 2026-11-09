import { LANGUAGES } from '../src/i18n/languages.ts'
import { settled } from './boot'
import { expect, test, type Page } from './fixtures'
import { watch } from './watch'

/** Where the site lives: canonical and alternate addresses are absolute */
const SITE = 'https://adamrodwebdev.github.io/plumb-darts/'

const FRENCH = LANGUAGES[1]
const RUSSIAN = LANGUAGES[2]

/** A chapter's left edge on screen: 0 when it holds the screen in the sideways journey */
async function leftOf(page: Page, id: string): Promise<number> {
  return page.evaluate((chapter) => {
    const element = document.getElementById(chapter)
    return element ? Math.round(element.getBoundingClientRect().left) : Number.NaN
  }, id)
}

for (const language of LANGUAGES) {
  test.describe(`the ${language.name} page (/${language.path})`, () => {
    test('opens in its language and scrolls to its end with no error, no CSP violation and no outside request', async ({
      page,
      baseURL,
    }) => {
      const seen = await watch(page, new URL(baseURL ?? '').origin)
      const response = await page.goto(language.path)

      expect(response?.ok()).toBe(true)
      await expect(page.locator('html')).toHaveAttribute('lang', language.code)
      await settled(page)
      await page.locator('.dusk').scrollIntoViewIfNeeded()
      await expect(page.locator('.dusk')).toBeInViewport()
      expect(seen.errors).toEqual([])
      expect(seen.outside).toEqual([])
    })

    test('names itself as canonical, and its six languages and the x-default as alternates', async ({
      page,
    }) => {
      await page.goto(language.path)

      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${SITE}${language.path}`,
      )
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((links) =>
          links.map((link) => `${link.getAttribute('hreflang')} ${link.getAttribute('href')}`),
        )
      expect(alternates).toEqual([
        ...LANGUAGES.map((other) => `${other.code} ${SITE}${other.path}`),
        `x-default ${SITE}`,
      ])
    })

    test('its language menu names every language in itself and marks this one as current', async ({
      page,
    }) => {
      await page.goto(language.path)
      const menu = page.locator('[data-lang-menu]')

      await menu.locator('summary').click()

      await expect(menu.getByRole('link')).toHaveCount(LANGUAGES.length)
      for (const other of LANGUAGES) {
        const link = menu.getByRole('link', { name: other.name, exact: true })
        await expect(link).toBeVisible()
        await expect(link).toHaveAttribute('lang', other.code)
        await expect(link).toHaveAttribute('hreflang', other.code)
      }
      await expect(menu.locator('[aria-current="page"]')).toHaveText(language.name)
    })
  })
}

test.describe('the language menu', () => {
  test('takes the reader to another language’s page', async ({ page }) => {
    await page.goto('')
    await settled(page)
    const menu = page.locator('[data-lang-menu]')

    await menu.locator('summary').click()
    await menu.getByRole('link', { name: 'Français' }).click()

    await expect(page).toHaveURL(/\/plumb-darts\/fr\/$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Le poids')
  })

  test('keeps the chapter on screen in the other language', async ({ page }) => {
    await page.goto(`${FRENCH?.path ?? ''}#weight`)
    await settled(page)
    await expect.poll(() => leftOf(page, 'weight')).toBe(0)
    const menu = page.locator('[data-lang-menu]')

    await menu.locator('summary').click()
    await menu.getByRole('link', { name: 'Русский' }).click()

    await expect(page).toHaveURL(/\/plumb-darts\/ru\/#weight$/)
    await settled(page)
    await expect.poll(() => leftOf(page, 'weight')).toBe(0)
  })

  test('closes on Escape and gives the focus back to its button', async ({ page }) => {
    await page.goto(RUSSIAN?.path ?? '')
    await settled(page)
    const menu = page.locator('[data-lang-menu]')
    const toggle = menu.locator('summary')

    await toggle.focus()
    await page.keyboard.press('Enter')
    await expect(menu.getByRole('link', { name: 'English' })).toBeVisible()
    // WebKit, like Safari by default, never tabs onto links: the focus is put on one directly
    await menu.getByRole('link', { name: 'English' }).focus()
    await page.keyboard.press('Escape')

    await expect(menu.getByRole('link', { name: 'English' })).toBeHidden()
    await expect(toggle).toBeFocused()
  })

  test('shows the hand on its button and its links, the arrow on the rest', async ({ page }) => {
    await page.goto('')
    const menu = page.locator('[data-lang-menu]')

    await expect(menu.locator('summary')).toHaveCSS('cursor', 'pointer')
    await menu.locator('summary').click()
    await expect(menu.getByRole('link', { name: 'Italiano' })).toHaveCSS('cursor', 'pointer')
    await expect(menu.locator('li').first()).toHaveCSS('cursor', 'default')
  })

  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('still opens, and still leads to each language', async ({ page }) => {
      await page.goto(RUSSIAN?.path ?? '')
      const menu = page.locator('[data-lang-menu]')

      await menu.locator('summary').click()
      await menu.getByRole('link', { name: 'Bahasa Indonesia' }).click()

      await expect(page).toHaveURL(/\/plumb-darts\/id\/$/)
      await expect(page.locator('html')).toHaveAttribute('lang', 'id')
    })
  })
})

test('the missing page, in English, leads home in every language', async ({ page }) => {
  await page.goto('404.html')
  const homes = page.getByRole('navigation', { name: 'The oche in your language' })

  for (const language of LANGUAGES) {
    const link = homes.getByRole('link', { name: language.name, exact: true })
    await expect(link).toHaveAttribute('href', `/plumb-darts/${language.path}`)
    await expect(link).toHaveAttribute('lang', language.code)
  }
})
