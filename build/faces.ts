import { fileURLToPath, URL } from 'node:url'
import type { Language } from '../src/i18n/languages.ts'
import type { EmbeddedFaces } from './inlineStyles.ts'
import type { CopyFace } from './pageFonts.ts'

const path = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

const FONTSOURCE = '../node_modules/@fontsource-variable'

/** The source files of the page's faces (fontsource packages), cut for each page at build */
export const FONT_FILES = {
  bigShoulders: path(
    `${FONTSOURCE}/big-shoulders-display/files/big-shoulders-display-latin-wght-normal.woff2`,
  ),
  oswaldLatin: path(`${FONTSOURCE}/oswald/files/oswald-latin-wght-normal.woff2`),
  oswaldCyrillic: path(`${FONTSOURCE}/oswald/files/oswald-cyrillic-wght-normal.woff2`),
  geistMonoLatin: path(`${FONTSOURCE}/geist-mono/files/geist-mono-latin-wght-normal.woff2`),
  geistMonoCyrillic: path(`${FONTSOURCE}/geist-mono/files/geist-mono-cyrillic-wght-normal.woff2`),
} as const

/** Everything above the fold set in the display face: the headline and the score's digits */
const HERO_KEYS = ['hero.title1', 'hero.title2', 'hero.title3']
const DIGITS = '0123456789!'

/**
 * The faces each page embeds for its first screen. Big Shoulders Display has no Cyrillic: the
 * Russian page sets its headlines in Oswald, at the weight that matches Big Shoulders' colour
 * (--display-heavy in tokens.css), and keeps the wordmark in the brand's own face.
 */
export const EMBEDDED_FACES: EmbeddedFaces = {
  latin: [
    {
      family: 'Plumb Hero',
      files: [FONT_FILES.bigShoulders],
      weight: 800,
      keys: [...HERO_KEYS, 'footer.wordmark'],
      extraGlyphs: DIGITS,
    },
  ],
  cyrillic: [
    {
      family: 'Plumb Hero',
      files: [FONT_FILES.oswaldCyrillic, FONT_FILES.oswaldLatin],
      weight: 500,
      keys: HERO_KEYS,
      extraGlyphs: DIGITS,
    },
    {
      family: 'Plumb Brand',
      files: [FONT_FILES.bigShoulders],
      weight: 800,
      keys: ['footer.wordmark'],
      extraGlyphs: '',
    },
  ],
}

/**
 * The faces that set each script's copy below the headline, cut to each page's language at build
 * (build/pageFonts.ts), with the weights the styles ask for: --display-heavy and --display-bold in
 * tokens.css for the display face, 400 to 700 for the mono small print
 */
export const COPY_FACES: Readonly<Record<Language['script'], readonly CopyFace[]>> = {
  latin: [
    {
      family: 'Big Shoulders Display',
      files: [FONT_FILES.bigShoulders],
      weight: { min: 700, max: 800 },
    },
    { family: 'Geist Mono', files: [FONT_FILES.geistMonoLatin], weight: { min: 400, max: 700 } },
  ],
  cyrillic: [
    {
      family: 'Oswald',
      files: [FONT_FILES.oswaldLatin, FONT_FILES.oswaldCyrillic],
      weight: { min: 400, max: 500 },
    },
    {
      family: 'Geist Mono',
      files: [FONT_FILES.geistMonoLatin, FONT_FILES.geistMonoCyrillic],
      weight: { min: 400, max: 700 },
    },
  ],
}
