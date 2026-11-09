import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { bundle } from 'lightningcss'
import subsetFont from 'subset-font'
import type { Plugin, ResolvedConfig } from 'vite'
import { languageOf, type Language } from '../src/i18n/languages.ts'
import { fontCharacters, missingCharacters, unicodeRange } from './fontCoverage.ts'
import { lookup, type Messages, valuesFor, withFacts } from './htmlI18n.ts'

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

/**
 * A face embedded in the page, set from the first paint with no request and no swap: the glyphs of
 * a few messages, cut from one or more files of the same typeface (a Latin and a Cyrillic file),
 * pinned to one weight. Each file gives the glyphs it holds, declared by their unicode-range.
 */
export interface EmbeddedFace {
  readonly family: string
  /** Variable woff2 files the subset is cut from, in order of preference */
  readonly files: readonly string[]
  readonly weight: number
  /** Message keys whose text is set in this face from the first paint */
  readonly keys: readonly string[]
  /** Glyphs needed beyond those messages (the score counter's digits) */
  readonly extraGlyphs: string
}

/** The faces each script's pages embed */
export type EmbeddedFaces = Readonly<Record<Language['script'], readonly EmbeddedFace[]>>

/** The text a face must draw: its messages (facts filled) in both cases, and its extra glyphs */
export function faceText(face: EmbeddedFace, messages: Messages, language: Language): string {
  const facts = valuesFor(language).facts
  const text = face.keys
    .map((key) => withFacts(lookup(messages, key) ?? '', facts, `${language.code} ${key}`))
    .join(' ')
  return `${text}${text.toLocaleUpperCase(language.intl)}${face.extraGlyphs}`
}

/**
 * The @font-face rules of one embedded face: one per file that holds some of its glyphs, each
 * limited to those glyphs. A glyph none of the files holds fails the build: the browser would draw
 * it in another font, in the middle of the headline.
 */
export async function embeddedFace(
  face: EmbeddedFace,
  text: string,
  where: string,
): Promise<string> {
  // The space too: a face that did not claim it would leave the headline's spaces to the next
  // font, which swaps in later and moves the words
  let wanted = new Set([...text].map((character) => character.codePointAt(0) ?? 0))
  const rules: string[] = []
  for (const file of face.files) {
    const font = readFileSync(file)
    const held = fontCharacters(font)
    const glyphs = [...wanted].filter((code) => held.has(code))
    if (glyphs.length === 0) continue
    wanted = new Set([...wanted].filter((code) => !held.has(code)))
    const subset = await subsetFont(font, String.fromCodePoint(...glyphs), {
      targetFormat: 'woff2',
      variationAxes: { wght: face.weight },
    })
    rules.push(
      `@font-face{font-family:"${face.family}";` +
        `src:url(data:font/woff2;base64,${subset.toString('base64')}) format("woff2");` +
        `font-weight:${face.weight};font-display:block;unicode-range:${unicodeRange(glyphs)}}`,
    )
  }
  const missing = missingCharacters(String.fromCodePoint(...wanted), new Set())
  if (missing.length > 0) {
    throw new Error(`${where}: "${face.family}" has no glyph for ${missing.join(', ')}`)
  }
  return rules.join('')
}

/** Font URLs written `url(fonts/…)` become absolute under the base path (404.html is served anywhere). */
export function absoluteFontUrls(css: string, base: string): string {
  return css.replace(/url\((["']?)fonts\//g, (_, quote: string) => `url(${quote}${base}fonts/`)
}

const LANG_ATTRIBUTE = /<html\s+lang="([^"]*)"/

/**
 * The whole stylesheet (src/styles/index.css and its @imports) is inlined in every page: no
 * render-blocking request, and the first paint is complete. Minified in builds. Each page embeds
 * the faces of its own language's headline (read from its <html lang>).
 */
export function inlineStyles(options: {
  entry: string
  faces: EmbeddedFaces
  localesDir: string
}): Plugin {
  let config: ResolvedConfig
  const fontFaces = new Map<string, Promise<string>>()
  const stylesDir = dirname(resolve(options.entry))

  const facesFor = (language: Language): Promise<string> => {
    const cached = fontFaces.get(language.code)
    if (cached) return cached
    const messages = JSON.parse(
      readFileSync(resolve(options.localesDir, `${language.code}.json`), 'utf8'),
    ) as Messages
    const css = Promise.all(
      options.faces[language.script].map((face) =>
        embeddedFace(face, faceText(face, messages, language), language.code),
      ),
    ).then((rules) => rules.join(''))
    fontFaces.set(language.code, css)
    return css
  }

  return {
    name: 'inline-styles',
    configResolved(resolved) {
      config = resolved
    },
    configureServer(server) {
      server.watcher.add(stylesDir)
      server.watcher.on('change', (changed) => {
        if (changed.endsWith('.css') || changed.endsWith('.json')) {
          fontFaces.clear()
          server.ws.send({ type: 'full-reload' })
        }
      })
    },
    transformIndexHtml: {
      order: 'post',
      async handler(html) {
        const language = languageOf(LANG_ATTRIBUTE.exec(html)?.[1])
        const { code } = bundle({
          filename: resolve(options.entry),
          minify: config.command === 'build',
          targets: TARGETS,
        })
        const css = absoluteFontUrls(code.toString(), config.base)
        const faces = await facesFor(language)
        return html.replace('<!-- inline-styles -->', () => `<style>${faces}${css}</style>`)
      },
    },
  }
}
