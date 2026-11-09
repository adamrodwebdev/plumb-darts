import { orElse, readChoice } from '../rules/input.ts'

/**
 * The page's languages, in the order of the language menu. English is the base: the site's root
 * page and its x-default. Each other language has a static page of its own (`fr/`, `ru/`…), built
 * from the same template; nothing redirects a visitor by their browser's language.
 */
export interface Language {
  /** BCP 47 code: the page's `lang`, its `hreflang` and the name of its messages file */
  readonly code: LanguageCode
  /** The language's name in that language, as the menu shows it */
  readonly name: string
  /** The locale Intl formats dates, numbers, units and plurals with */
  readonly intl: string
  /** Open Graph locale (`og:locale`) */
  readonly ogLocale: string
  /** The page's folder under the site's base: '' for English, 'fr/' for French */
  readonly path: string
  /** The script of its copy: Cyrillic pages set their display type in their own face */
  readonly script: 'latin' | 'cyrillic'
}

export const LANGUAGE_CODES = ['en', 'fr', 'ru', 'es', 'it', 'id'] as const
export type LanguageCode = (typeof LANGUAGE_CODES)[number]

export const LANGUAGES: readonly Language[] = [
  { code: 'en', name: 'English', intl: 'en-GB', ogLocale: 'en_GB', path: '', script: 'latin' },
  { code: 'fr', name: 'Français', intl: 'fr-FR', ogLocale: 'fr_FR', path: 'fr/', script: 'latin' },
  {
    code: 'ru',
    name: 'Русский',
    intl: 'ru-RU',
    ogLocale: 'ru_RU',
    path: 'ru/',
    script: 'cyrillic',
  },
  { code: 'es', name: 'Español', intl: 'es-ES', ogLocale: 'es_ES', path: 'es/', script: 'latin' },
  { code: 'it', name: 'Italiano', intl: 'it-IT', ogLocale: 'it_IT', path: 'it/', script: 'latin' },
  {
    code: 'id',
    name: 'Bahasa Indonesia',
    intl: 'id-ID',
    ogLocale: 'id_ID',
    path: 'id/',
    script: 'latin',
  },
]

export const DEFAULT_LANGUAGE: Language = LANGUAGES[0] as Language

/**
 * The language of a page, read at the door (its `<html lang>`, a link): one of the allow-list,
 * compared whole, or English. Never an inherited name such as `toString`.
 */
export function languageOf(code: unknown): Language {
  const chosen = orElse(() => readChoice(code, LANGUAGE_CODES, 'lang'), DEFAULT_LANGUAGE.code)
  return LANGUAGES.find((language) => language.code === chosen) ?? DEFAULT_LANGUAGE
}
