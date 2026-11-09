import { expect, type Page } from '@playwright/test'

/**
 * The deferred boot has settled: the 3D scene is on screen (its progress bar done) or the page
 * went on without it. Scroll effects pin the chapters before that, which lengthens the page by
 * several screens: measure or scroll only after this.
 */
export async function settled(page: Page): Promise<void> {
  await expect(page.locator('html.no-3d, html.has-3d [data-boot-progress].is-done')).toHaveCount(
    1,
    { timeout: 15_000 },
  )
}

export async function pageHeight(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollHeight)
}
