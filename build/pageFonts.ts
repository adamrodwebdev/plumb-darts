import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import subsetFont from 'subset-font'
import type { Language } from '../src/i18n/languages.ts'
import { fontCharacters, missingCharacters, unicodeRange } from './fontCoverage.ts'
import { type Messages, valuesFor } from './htmlI18n.ts'

/**
 * The faces that set a page's copy below its headline (titles, figures, small print), cut at build
 * to the characters of that page's language and to the weights its styles ask for. A Latin page
 * fetches about 22 kB of fonts instead of 59, the Russian page 33 instead of 80: fonts asked for
 * before the first paint weigh in Lighthouse's simulated paint (lighthouse.md, section 2).
 */
export interface CopyFace {
  readonly family: string
  /** Variable WOFF2 files, in order of preference: each gives the glyphs it holds */
  readonly files: readonly string[]
  /** The weights the styles ask for, kept on the variable axis */
  readonly weight: { readonly min: number; readonly max: number }
}

/** One file of a page's face, ready to be written under fonts/ and declared */
export interface FontFile {
  readonly fileName: string
  readonly source: Buffer
  readonly family: string
  readonly weight: CopyFace['weight']
  readonly unicodeRange: string
}

const textsOf = (tree: Messages): string[] =>
  Object.values(tree).flatMap((node) => (typeof node === 'string' ? [node] : textsOf(node)))

/**
 * Everything a language's pages can show in their copy faces: every message (plural forms and
 * text shown by the scripts included, placeholders left out), the dart's facts, the months its
 * dates use, digits and the punctuation of figures, in both cases (labels are set in capitals)
 */
export function shownText(language: Language, messages: Messages): string {
  const { facts } = valuesFor(language)
  const copy = textsOf(messages).map((text) => text.replace(/\{\w+\}/g, ''))
  const months = new Intl.DateTimeFormat(language.intl, { month: 'short', timeZone: 'UTC' })
  const dates = Array.from({ length: 12 }, (_, month) =>
    months.format(new Date(Date.UTC(2026, month, 1))),
  )
  const shown = [...copy, ...Object.values(facts), ...dates, '0123456789 .,:;%×'].join(' ')
  return `${shown}${shown.toLocaleUpperCase(language.intl)}`
}

const slug = (family: string): string => family.toLowerCase().replace(/[^a-z0-9]+/g, '-')

/**
 * A face cut to a text: one file per source file that holds some of its characters, each limited
 * to those characters and named by its content. A character none of the files holds fails the
 * build: the browser would set it in another font in the middle of a word.
 */
export async function cutFace(face: CopyFace, text: string, where: string): Promise<FontFile[]> {
  let wanted = new Set([...text].map((character) => character.codePointAt(0) ?? 0))
  for (const code of [...wanted]) if (code < 0x20) wanted.delete(code)
  const files: FontFile[] = []
  for (const path of face.files) {
    const font = readFileSync(path)
    const held = fontCharacters(font)
    const glyphs = [...wanted].filter((code) => held.has(code))
    if (glyphs.length === 0) continue
    wanted = new Set([...wanted].filter((code) => !held.has(code)))
    const source = await subsetFont(font, String.fromCodePoint(...glyphs), {
      targetFormat: 'woff2',
      variationAxes: { wght: { min: face.weight.min, max: face.weight.max } },
    })
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 10)
    files.push({
      fileName: `fonts/${slug(face.family)}-${hash}.woff2`,
      source,
      family: face.family,
      weight: face.weight,
      unicodeRange: unicodeRange(glyphs),
    })
  }
  const missing = missingCharacters(String.fromCodePoint(...wanted), new Set())
  if (missing.length > 0) {
    throw new Error(`${where}: "${face.family}" has no glyph for ${missing.join(', ')}`)
  }
  return files
}

/** The @font-face rules of a page's cut faces, under the site's base */
export function fontFaceRules(files: readonly FontFile[], base: string): string {
  return files
    .map(
      (file) =>
        `@font-face{font-family:"${file.family}";src:url(${base}${file.fileName}) format("woff2");` +
        `font-weight:${file.weight.min} ${file.weight.max};font-display:swap;` +
        `unicode-range:${file.unicodeRange}}`,
    )
    .join('')
}
