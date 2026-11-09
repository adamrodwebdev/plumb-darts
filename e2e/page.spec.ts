import { SOFTWARE, expect, test, type Page } from './fixtures'
import { settled } from './boot'

interface Watch {
  readonly errors: string[]
  readonly outside: string[]
}

/** The browser's own console line for a CSP refusal: the violation event below names its element */
const CSP_CONSOLE_LINE = /^Refused to /

/** Records console errors, uncaught errors, CSP violations and requests to another origin */
async function watch(page: Page, origin: string): Promise<Watch> {
  const seen: Watch = { errors: [], outside: [] }
  page.on('console', (message) => {
    if (message.type() === 'error' && !CSP_CONSOLE_LINE.test(message.text())) {
      seen.errors.push(message.text())
    }
  })
  page.on('pageerror', (error) => seen.errors.push(error.message))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol.startsWith('http') && url.origin !== origin) seen.outside.push(request.url())
  })
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const element = event.target instanceof Element ? event.target : null
      // WebKit on Windows styles its own <select> from inside: a style-src-attr refusal on a
      // select that carries no style attribute is the engine's, not the page's (seen 2026-11-09)
      const engine =
        element?.tagName === 'SELECT' &&
        !element.hasAttribute('style') &&
        event.violatedDirective === 'style-src-attr'
      if (!engine) {
        console.error(
          `CSP blocked ${event.blockedURI} (${event.violatedDirective}) on ${element?.tagName ?? 'the document'}`,
        )
      }
    })
  })
  return seen
}

test('the page opens and scrolls to its end with no error, no CSP violation and no outside request', async ({
  page,
  baseURL,
}) => {
  const seen = await watch(page, new URL(baseURL ?? '').origin)
  await page.goto('')

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await settled(page)
  await page.locator('.dusk').scrollIntoViewIfNeeded()
  await expect(page.locator('.dusk')).toBeInViewport()

  expect(seen.errors).toEqual([])
  expect(seen.outside).toEqual([])
})

/**
 * Opens the page and gives the widest its layout got until every entrance has played, sampled on
 * each frame from the first: a phone zooms the whole page out to show anything past its edge.
 */
async function widestWhileBooting(page: Page): Promise<number> {
  await page.addInitScript(() => {
    const sample = (): void => {
      window.widest = Math.max(window.widest ?? 0, window.innerWidth)
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.goto('')
  await settled(page)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
            .filter((animation) => animation.playState === 'running').length,
      ),
    )
    .toBe(0)
  return page.evaluate(() => window.widest ?? 0)
}

test('the page never grows wider than the screen while it boots, so a phone never zooms out', async ({
  page,
}) => {
  const widest = await widestWhileBooting(page)

  expect(widest).toBe(page.viewportSize()?.width)
})

/** The model files a page asks for, by path */
function modelRequests(page: Page): string[] {
  const paths: string[] = []
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname
    if (path.includes('/models/')) paths.push(path)
  })
  return paths
}

test('a device whose WebGL a GPU draws gets the 3D scene, built from its two model files', async ({
  page,
  browserName,
}) => {
  // eslint-disable-next-line playwright/no-skipped-test -- a precondition, not a parked test: on a CI runner Firefox opens no WebGL 2 and WebKit draws it too slowly for the frame-time probe (2026-11-09), so only Chromium can show the scene
  test.skip(browserName !== 'chromium', 'only Chromium draws WebGL fast enough on a CI runner')
  const models = modelRequests(page)
  await page.goto('')

  await expect(page.locator('html')).toHaveClass(/\bhas-3d\b/)
  // The canvas goes live once the dart and the board are loaded, checked and on the GPU; a file
  // refused or failed would send the page to its art without 3D instead
  await expect(page.locator('[data-stage]')).toHaveClass(/\bis-live\b/, { timeout: 15_000 })
  await expect(page.locator('html')).toHaveClass(/\bhas-3d\b/)
  expect(models).toHaveLength(2)
  expect(models).toContain('/plumb-darts/models/dart.glb')
  expect(models.some((path) => /\/models\/board(-1k)?\.glb$/.test(path))).toBe(true)
})

test.describe('on a device whose WebGL the processor draws', () => {
  test.use({ renderer: SOFTWARE })

  test('the page keeps its art without 3D, never loads the scene or its models, and logs no error', async ({
    page,
    baseURL,
  }) => {
    const seen = await watch(page, new URL(baseURL ?? '').origin)
    const scripts: string[] = []
    page.on('request', (request) => {
      if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname)
    })
    const models = modelRequests(page)
    await page.goto('')

    await settled(page)
    await expect(page.locator('html')).toHaveClass(/\bno-3d\b/)
    await page.locator('.dusk').scrollIntoViewIfNeeded()
    expect(scripts.filter((path) => /\/(createScene|GLTFLoader|meshopt)/.test(path))).toEqual([])
    // Nor a byte of the models: Lighthouse's lab machine draws with the processor, as here
    expect(models).toEqual([])
    expect(seen.errors).toEqual([])
  })

  // The drawn dart flying in from the right once zoomed phones out, then back in (2026-11-09)
  test('the drawn dart never makes the page wider than the screen', async ({ page }) => {
    const widest = await widestWhileBooting(page)

    expect(widest).toBe(page.viewportSize()?.width)
  })
})

test('the finish is played with the keyboard alone: three darts, then collected', async ({
  page,
}) => {
  await page.goto('#throw')
  const log = page.locator('[data-throw-log] li')
  const throwButton = page.getByRole('button', { name: 'Throw' })

  await page.getByLabel('Aim for').selectOption('T20')
  await throwButton.focus()
  await page.keyboard.press('Enter')
  await expect(log).toHaveCount(1)
  await expect(page.getByText('2 darts left')).toBeVisible()

  // The focus stays on Throw while the dart flies (a disabled button once lost it, 2026-11-09)
  await expect(throwButton).toBeFocused()
  await expect(throwButton).toBeEnabled()
  await page.keyboard.press('Enter')
  await expect(log).toHaveCount(2)
  await expect(throwButton).toBeFocused()
  await expect(throwButton).toBeEnabled()
  await page.keyboard.press('Enter')
  await expect(log).toHaveCount(3)

  // No dart left: the focus has moved on to collecting them, then back to throwing
  const collect = page.getByRole('button', { name: 'Collect the darts' })
  await expect(collect).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(log).toHaveCount(0)
  await expect(page.getByText('3 darts left')).toBeVisible()
  await expect(throwButton).toBeFocused()
})

test('the cursor shows only what can be clicked', async ({ page }) => {
  await page.goto('')

  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('cursor', 'default')
  await expect(page.locator('.chapter__body').first()).toHaveCSS('cursor', 'default')
  await expect(page.locator('a[href]').first()).toHaveCSS('cursor', 'pointer')
  await expect(page.getByLabel('Aim for')).toHaveCSS('cursor', 'pointer')
  await expect(page.getByRole('button', { name: 'Throw' })).toHaveCSS('cursor', 'pointer')
})

test('the missing page offers the way back to the oche', async ({ page }) => {
  await page.goto('404.html')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Missed the board.')
  await expect(page.getByRole('link', { name: 'Back to the oche' })).toHaveAttribute(
    'href',
    '/plumb-darts/',
  )
})
