import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { bundle } from 'lightningcss'
import subsetFont from 'subset-font'
import type { Plugin, ResolvedConfig } from 'vite'
import { lookup, type Messages } from './htmlI18n.ts'

/** lightningcss version encoding: major << 16 | minor << 8 */
const version = (major: number, minor = 0): number => (major << 16) | (minor << 8)

/**
 * Browsers the stylesheet must work in: Baseline widely available, plus Safari 16.4 for the
 * phones that stay behind. Newer syntax (nesting, light-dark()) is lowered for them.
 */
const TARGETS = {
  chrome: version(111),
  edge: version(111),
  firefox: version(128),
  safari: version(16, 4),
  ios_saf: version(16, 4),
}

export interface HeroFont {
  /** Variable woff2 the subset is cut from */
  file: string
  family: string
  weight: number
  /** Message keys whose text is set in this face from the first paint */
  keys: readonly string[]
  /** Glyphs needed beyond those messages (the score counter's digits) */
  extraGlyphs: string
  messagesFile: string
}

/**
 * The hero headline's face: only its glyphs, pinned to one weight and embedded as a data URL.
 * The first paint is already set in the brand face, with no request and no swap.
 */
export async function heroFontFace(font: HeroFont): Promise<string> {
  const messages = JSON.parse(readFileSync(font.messagesFile, 'utf8')) as Messages
  const text = font.keys.map((key) => lookup(messages, key) ?? '').join(' ')
  const glyphs = `${text}${text.toUpperCase()}${font.extraGlyphs}`
  const subset = await subsetFont(readFileSync(font.file), glyphs, {
    targetFormat: 'woff2',
    variationAxes: { wght: font.weight },
  })
  return (
    `@font-face{font-family:"${font.family}";` +
    `src:url(data:font/woff2;base64,${subset.toString('base64')}) format("woff2");` +
    `font-weight:${font.weight};font-display:block}`
  )
}

/** Font URLs written `url(fonts/…)` become absolute under the base path (404.html is served anywhere). */
export function absoluteFontUrls(css: string, base: string): string {
  return css.replace(/url\((["']?)fonts\//g, (_, quote: string) => `url(${quote}${base}fonts/`)
}

/**
 * The whole stylesheet (src/styles/index.css and its @imports) is inlined in every page: no
 * render-blocking request, and the first paint is complete. Minified in builds.
 */
export function inlineStyles(options: { entry: string; heroFont: HeroFont }): Plugin {
  let config: ResolvedConfig
  let fontFace: Promise<string> | undefined
  const stylesDir = dirname(resolve(options.entry))

  return {
    name: 'inline-styles',
    configResolved(resolved) {
      config = resolved
    },
    configureServer(server) {
      server.watcher.add(stylesDir)
      server.watcher.on('change', (changed) => {
        if (changed.endsWith('.css') || changed.endsWith('en.json')) {
          fontFace = undefined
          server.ws.send({ type: 'full-reload' })
        }
      })
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        fontFace ??= heroFontFace(options.heroFont)
        const { code } = bundle({
          filename: resolve(options.entry),
          minify: config.command === 'build',
          targets: TARGETS,
        })
        const css = absoluteFontUrls(code.toString(), config.base)
        return html.replace('<!-- inline-styles -->', `<style>${await fontFace}${css}</style>`)
      },
    },
  }
}
