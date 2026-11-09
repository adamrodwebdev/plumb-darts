import type { Page } from '@playwright/test'

export interface Watch {
  readonly errors: string[]
  readonly outside: string[]
}

/** The browser's own console line for a CSP refusal: the violation event below names its element */
const CSP_CONSOLE_LINE = /^Refused to /

/** Records console errors, uncaught errors, CSP violations and requests to another origin */
export async function watch(page: Page, origin: string): Promise<Watch> {
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
