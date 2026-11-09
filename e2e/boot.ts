import { expect, type Page } from '@playwright/test'

/**
 * The deferred boot has settled: its progress bar is done, with or without the 3D scene. Scroll
 * effects pin the chapters before that, one task per chapter, which lengthens the page by several
 * screens: measure or scroll only after this (`html.no-3d` alone came before the pins, 2026-11-09).
 */
export async function settled(page: Page): Promise<void> {
  await expect(page.locator('html:is(.no-3d, .has-3d) [data-boot-progress].is-done')).toHaveCount(
    1,
    { timeout: 15_000 },
  )
}

export async function pageHeight(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollHeight)
}
