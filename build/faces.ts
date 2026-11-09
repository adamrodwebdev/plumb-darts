import { fileURLToPath, URL } from 'node:url'
import type { EmbeddedFaces } from './inlineStyles.ts'

const path = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

const FONTSOURCE = '../node_modules/@fontsource-variable'

/** The source files of the page's faces (fontsource packages, also copied in public/fonts) */
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

/** The full faces that set each script's copy: its display face and its mono face, by file */
export const COPY_FACES = {
  latin: {
    display: [FONT_FILES.bigShoulders],
    mono: [FONT_FILES.geistMonoLatin],
  },
  cyrillic: {
    display: [FONT_FILES.oswaldLatin, FONT_FILES.oswaldCyrillic],
    mono: [FONT_FILES.geistMonoLatin, FONT_FILES.geistMonoCyrillic],
  },
} as const
