import { test as base } from '@playwright/test'

export { expect, type Page } from '@playwright/test'

declare global {
  interface Window {
    /** The widest the layout viewport got, recorded by a test's init script */
    widest?: number
  }
}

/** A GPU name, as the page reads it: a phone or a computer whose WebGL a GPU draws */
export const GPU = 'Test GPU'

/** What a headless Chrome without a usable GPU reports (seen 2026-11-09) */
export const SOFTWARE =
  'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)'

/**
 * The renderer the page sees. Headless browsers draw WebGL with the processor (SwiftShader,
 * llvmpipe), which the page refuses, as it should on a device without a usable GPU: the tests
 * stand for a device with one, unless a test names a software renderer with test.use().
 */
export const test = base.extend<{ renderer: string }>({
  renderer: [GPU, { option: true }],
  page: async ({ page, renderer }, use) => {
    await page.addInitScript((name: string) => {
      const RENDERER = 0x1f01
      const UNMASKED_RENDERER = 0x9246
      for (const type of [globalThis.WebGLRenderingContext, globalThis.WebGL2RenderingContext]) {
        if (typeof type !== 'function') continue
        const read = type.prototype.getParameter
        type.prototype.getParameter = function (this: WebGLRenderingContext, parameter: number) {
          return parameter === RENDERER || parameter === UNMASKED_RENDERER
            ? name
            : read.call(this, parameter)
        }
      }
    }, renderer)
    await use(page)
  },
})
