import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { LANGUAGES, type Language } from '../src/i18n/languages.ts'
import { COPY_FACES, EMBEDDED_FACES, FONT_FILES } from './faces.ts'
import { fontCharacters, missingCharacters, unicodeRange } from './fontCoverage.ts'
import type { Messages } from './htmlI18n.ts'
import { embeddedFace, faceText } from './inlineStyles.ts'
import { cutFace, fontFaceRules, shownText } from './pageFonts.ts'

/**
 * Every character a language shows must be in the faces that set it: a missing one is drawn from
 * another font in the middle of a word (and makes WebKit and Firefox fetch the next web face).
 * Read from the fonts' own cmap tables, with no browser (bug lessons: a soft hyphen that fetched
 * Fredoka, a thousands separator no font could draw).
 */
const messagesOf = (language: Language): Messages =>
  JSON.parse(
    readFileSync(new URL(`../src/i18n/locales/${language.code}.json`, import.meta.url), 'utf8'),
  ) as Messages

const tokens = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8')

/** A custom property's value on the root, or on the Russian page */
function token(name: string, script: Language['script']): string | undefined {
  const rule = script === 'cyrillic' ? /:root:lang\(ru\)\s*\{([^}]*)\}/ : /:root\s*\{([^}]*)\}/
  return new RegExp(`--${name}:\\s*(\\d+);`).exec(rule.exec(tokens)?.[1] ?? '')?.[1]
}

describe('the WOFF2 reader', () => {
  const bigShoulders = fontCharacters(readFileSync(FONT_FILES.bigShoulders))

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

describe.each(LANGUAGES)('the fonts of the $name page', (language) => {
  const messages = messagesOf(language)
  const text = shownText(language, messages)

  test.each(COPY_FACES[language.script].map((face) => [face.family, face] as const))(
    'its cut of %s draws every character the page can show, in the weights it asks for',
    async (_, face) => {
      const files = await cutFace(face, text, language.code)
      const drawn = new Set(files.flatMap((file) => [...fontCharacters(file.source)]))
      expect(missingCharacters(text, drawn)).toEqual([])
      expect(fontFaceRules(files, '/plumb-darts/')).toContain(
        `font-weight:${face.weight.min} ${face.weight.max}`,
      )
    },
  )

  test('its display face is cut at the weights the styles ask for', () => {
    const display = COPY_FACES[language.script][0]
    expect(String(display?.weight.max)).toBe(token('display-heavy', language.script))
    expect(String(display?.weight.min)).toBe(token('display-bold', language.script))
  })

  test('its embedded faces draw the whole headline, at the weight the page asks for', async () => {
    const [hero] = EMBEDDED_FACES[language.script]
    expect(hero?.family).toBe('Plumb Hero')
    expect(String(hero?.weight)).toBe(token('display-heavy', language.script))
    for (const face of EMBEDDED_FACES[language.script]) {
      const css = await embeddedFace(face, faceText(face, messages, language), language.code)
      expect(css).toContain(`font-family:"${face.family}"`)
    }
  })
})

describe('a cut face', () => {
  test('fails the build on a character none of its files draws', async () => {
    const [display] = COPY_FACES.latin
    if (!display) throw new Error('no Latin display face')
    await expect(cutFace(display, 'Жук', 'test')).rejects.toThrow('U+0416')
  })

  test('takes each character from the first file that draws it, and declares only those', async () => {
    const [oswald] = COPY_FACES.cyrillic
    if (!oswald) throw new Error('no Cyrillic display face')
    const files = await cutFace(oswald, 'Вес 25', 'test')
    expect(files.map((file) => file.unicodeRange)).toEqual(['U+20,U+32,U+35', 'U+412,U+435,U+441'])
  })
})
