import { describe, expect, test } from 'vitest'
import { formatDate, formatSpecs } from './specs'
import { unbreakable } from './typography'

/** No-break space, as every face of the page draws it */
const NBSP = '\u00a0'

describe('the dart’s facts, formatted by Intl in each language', () => {
  test('in English: points, unit symbols, no space before %', () => {
    const specs = formatSpecs('en-GB')
    expect(specs.ringDepth).toBe(`0.3${NBSP}mm`)
    expect(specs.tungsten).toBe('90%')
    expect(specs.barrelSize).toBe(`50${NBSP}×${NBSP}6.6${NBSP}mm`)
    expect(specs.length).toBe(`155${NBSP}mm`)
    expect(specs.cog).toBe('38%')
    expect(specs.weightLong).toBe(`25${NBSP}grams`)
    expect([specs.weightValue, specs.weightUnit]).toEqual(['25', 'g'])
  })

  test('in French: decimal comma, and a no-break space before units and %', () => {
    const specs = formatSpecs('fr-FR')
    expect(specs.ringDepth).toBe(`0,3${NBSP}mm`)
    expect(specs.tungsten).toBe(`90${NBSP}%`)
    expect(specs.weightLong).toBe(`25${NBSP}grammes`)
  })

  test('in Russian: Cyrillic unit symbols, and grams that agree with 25', () => {
    const specs = formatSpecs('ru-RU')
    expect(specs.ringDepth).toBe(`0,3${NBSP}мм`)
    expect([specs.weightValue, specs.weightUnit]).toEqual(['25', 'г'])
    // CLDR's counting form for units of measure (сто грамм), as dictionaries allow it
    expect(specs.weightLong).toBe(`25${NBSP}грамм`)
  })

  test.each(['en-GB', 'fr-FR', 'ru-RU', 'es-ES', 'it-IT', 'id-ID'])(
    'never breaks a measure, nor uses the narrow space no face draws (%s)',
    (locale) => {
      const values = Object.values(formatSpecs(locale))
      expect(values.filter((value) => /[ \u202f]/.test(value))).toEqual([])
    },
  )
})

describe('a clipping’s date', () => {
  test.each([
    { locale: 'en-GB', text: `12${NBSP}Oct 2026` },
    { locale: 'fr-FR', text: `12${NBSP}oct. 2026` },
    { locale: 'ru-RU', text: `12${NBSP}окт. 2026${NBSP}г.` },
    { locale: 'id-ID', text: `12${NBSP}Okt 2026` },
  ])(
    'reads like a source line in $locale, breaking only between month and year',
    ({ locale, text }) => {
      expect(formatDate(locale, '2026-10-12')).toBe(text)
    },
  )

  test.each(['2026-13-01', '2026-02-30', '12/10/2026', '2026-1-2', '', '1e3-01-01'])(
    'fails the build on %j, which is no date',
    (text) => {
      expect(() => formatDate('en-GB', text)).toThrow()
    },
  )
})

describe('unbreakable', () => {
  test('turns spaces and narrow no-break spaces into no-break spaces', () => {
    expect(unbreakable('1\u202f441 g')).toBe(`1${NBSP}441${NBSP}g`)
  })
})
