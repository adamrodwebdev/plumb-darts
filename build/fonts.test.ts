import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { LANGUAGES, type Language } from '../src/i18n/languages.ts'
import type { MessageTree } from '../src/i18n/Translator.ts'
import { COPY_FACES, EMBEDDED_FACES, FONT_FILES } from './faces.ts'
import { fontCharacters, missingCharacters, unicodeRange } from './fontCoverage.ts'
import { valuesFor } from './htmlI18n.ts'
import { embeddedFace, faceText } from './inlineStyles.ts'

/**
 * Every character a language shows must be in the faces that set it: a missing one is drawn from
 * another font in the middle of a word (and makes WebKit and Firefox fetch the next web face).
 * Read from the fonts' own cmap tables, with no browser (bug lessons: a soft hyphen that fetched
 * Fredoka, a thousands separator no font could draw).
 */
const fontAt = (path: string): Buffer => readFileSync(path)
const charactersOf = (files: readonly string[]): ReadonlySet<number> =>
  new Set(files.flatMap((file) => [...fontCharacters(fontAt(file))]))

const messagesOf = (language: Language): MessageTree =>
  JSON.parse(
    readFileSync(new URL(`../src/i18n/locales/${language.code}.json`, import.meta.url), 'utf8'),
  ) as MessageTree

const textsOf = (tree: MessageTree): string[] =>
  Object.values(tree).flatMap((node) => (typeof node === 'string' ? [node] : textsOf(node)))

/** What a language's pages show: its copy without the placeholders, its facts and its dates */
function shownText(language: Language): string {
  const { facts } = valuesFor(language)
  const copy = textsOf(messagesOf(language)).map((text) => text.replace(/\{\w+\}/g, ''))
  const dates = new Intl.DateTimeFormat(language.intl, { month: 'short' })
  const months = Array.from({ length: 12 }, (_, month) => dates.format(new Date(2026, month, 1)))
  const shown = [...copy, ...Object.values(facts), ...months, '0123456789'].join(' ')
  return `${shown}${shown.toLocaleUpperCase(language.intl)}`
}

describe('the WOFF2 reader', () => {
  const bigShoulders = fontCharacters(fontAt(FONT_FILES.bigShoulders))

  test('reads the characters a font draws', () => {
    expect(missingCharacters('Aé0«»’…×', bigShoulders)).toEqual([])
  })

  test('names the characters it lacks', () => {
    expect(missingCharacters('a\u202fЖ', bigShoulders)).toEqual(['U+202F', 'U+0416'])
  })

  test('refuses a file that is not WOFF2', () => {
    expect(() => fontCharacters(Buffer.from('not a font at all, not even close'))).toThrow()
  })

  test('writes a unicode-range of runs and single characters', () => {
    expect(unicodeRange([0x43, 0x41, 0x42, 0x2019, 0x41])).toBe('U+41-43,U+2019')
  })
})

describe.each(LANGUAGES)('the faces of the $name page', (language) => {
  const text = shownText(language)
  const faces = COPY_FACES[language.script]

  test('the display face draws every character of the copy', () => {
    expect(missingCharacters(text, charactersOf(faces.display))).toEqual([])
  })

  test('the mono face draws every character of the copy', () => {
    expect(missingCharacters(text, charactersOf(faces.mono))).toEqual([])
  })

  test('the embedded faces draw the whole headline, at the weight the page asks for', async () => {
    const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')
    const rule =
      language.script === 'cyrillic' ? /:root:lang\(ru\)\s*\{([^}]*)\}/ : /:root\s*\{([^}]*)\}/
    const heavy = /--display-heavy:\s*(\d+);/.exec(rule.exec(tokens)?.[1] ?? '')?.[1]
    const [hero] = EMBEDDED_FACES[language.script]
    expect(hero?.family).toBe('Plumb Hero')
    expect(String(hero?.weight)).toBe(heavy)
    for (const face of EMBEDDED_FACES[language.script]) {
      const css = await embeddedFace(
        face,
        faceText(face, messagesOf(language), language),
        language.code,
      )
      expect(css).toContain(`font-family:"${face.family}"`)
    }
  })
})

describe('the self-hosted fonts', () => {
  test.each([
    ['big-shoulders-display.woff2', FONT_FILES.bigShoulders],
    ['geist-mono.woff2', FONT_FILES.geistMonoLatin],
    ['geist-mono-cyrillic.woff2', FONT_FILES.geistMonoCyrillic],
    ['oswald.woff2', FONT_FILES.oswaldLatin],
    ['oswald-cyrillic.woff2', FONT_FILES.oswaldCyrillic],
  ])('public/fonts/%s is the package’s file, byte for byte', (name, source) => {
    const shipped = readFileSync(new URL(`../public/fonts/${name}`, import.meta.url))
    expect(shipped.equals(fontAt(source))).toBe(true)
  })
})
