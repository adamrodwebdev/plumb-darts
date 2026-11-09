import { describe, expect, test } from 'vitest'
import { DEFAULT_LANGUAGE, LANGUAGES, languageOf } from './languages'

describe('languageOf: the page’s language, read at the door', () => {
  test.each(LANGUAGES.map((language) => language.code))('knows %s', (code) => {
    expect(languageOf(code).code).toBe(code)
  })

  test.each([
    { name: 'an empty lang', value: '' },
    { name: 'an unknown language', value: 'de' },
    { name: 'a region it does not list', value: 'fr-CA' },
    { name: 'another case', value: 'FR' },
    { name: 'spaces around a code', value: ' fr ' },
    { name: 'an inherited name', value: 'toString' },
    { name: 'the prototype', value: '__proto__' },
    { name: 'a code in a list', value: ['fr'] },
    { name: 'a number', value: 7 },
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
  ])('falls back to English on $name', ({ value }) => {
    expect(languageOf(value)).toBe(DEFAULT_LANGUAGE)
  })

  test('keeps English as the base: the site’s root and its x-default', () => {
    expect(DEFAULT_LANGUAGE.code).toBe('en')
    expect(DEFAULT_LANGUAGE.path).toBe('')
  })

  test('gives every other language a folder of its own', () => {
    const paths = LANGUAGES.map((language) => language.path)
    expect(new Set(paths).size).toBe(LANGUAGES.length)
    for (const language of LANGUAGES.slice(1)) expect(language.path).toBe(`${language.code}/`)
  })
})
