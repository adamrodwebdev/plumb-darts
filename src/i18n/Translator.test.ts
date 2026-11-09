import { describe, expect, test } from 'vitest'
import english from './locales/en.json'
import french from './locales/fr.json'
import russian from './locales/ru.json'
import { Translator } from './Translator'

describe('Translator', () => {
  const translator = new Translator(english, 'en-GB')

  test('fills placeholders, formatting numbers for the locale', () => {
    expect(translator.t('press.status', { index: 2, count: 6, outlet: 'Sisal Review' })).toBe(
      'Clipping 2 of 6: Sisal Review',
    )
    expect(translator.t('hud.current', { chapter: 'The grip', remaining: 1441 })).toBe(
      'Chapters. Now: The grip, 1,441 left.',
    )
  })

  test.each([
    { count: 1, text: '1 dart left' },
    { count: 2, text: '2 darts left' },
    { count: 0, text: '0 darts left' },
  ])('picks the plural form for $count', ({ count, text }) => {
    expect(translator.plural('throw.dartsLeft', count)).toBe(text)
  })

  test.each([
    { points: 1, text: 'Single 1, 1 point.' },
    { points: 60, text: 'Single 1, 60 points.' },
  ])('fills a plural message’s other values beside its count ($points)', ({ points, text }) => {
    expect(translator.plural('throw.hit', points, { label: 'Single 1' })).toBe(text)
  })

  test('shows the key itself when a message is missing (visible in review, never blank)', () => {
    expect(translator.t('nowhere.at.all')).toBe('nowhere.at.all')
    expect(translator.plural('nowhere.at.all', 2)).toBe('nowhere.at.all')
  })

  test.each(['toString', 'constructor', '__proto__', 'hud.toString'])(
    'never takes an inherited name for a message (%s)',
    (key) => {
      expect(translator.t(key)).toBe(key)
    },
  )

  test('labels every scoring ring', () => {
    const rings = ['single', 'double', 'treble', 'outer-bull', 'bull', 'miss']
    const labels = rings.map((ring) => translator.t(`score.${ring}`, { segment: 20 }))
    expect(labels).toEqual([
      'Single 20',
      'Double 20',
      'Treble 20',
      'Outer bull',
      'Bullseye',
      'Missed the board',
    ])
  })
})

describe('Translator in Russian', () => {
  const translator = new Translator(russian, 'ru-RU')

  // One, few and many: 1, 21 and 51 take очко; 2 to 4, 22 to 24 take очка; the rest очков
  test.each([
    { points: 1, text: 'Сектор 1: 1 очко.' },
    { points: 21, text: 'Сектор 1: 21 очко.' },
    { points: 3, text: 'Сектор 1: 3 очка.' },
    { points: 24, text: 'Сектор 1: 24 очка.' },
    { points: 5, text: 'Сектор 1: 5 очков.' },
    { points: 11, text: 'Сектор 1: 11 очков.' },
    { points: 0, text: 'Сектор 1: 0 очков.' },
  ])('agrees the points with $points', ({ points, text }) => {
    expect(translator.plural('throw.hit', points, { label: 'Сектор 1' })).toBe(text)
  })

  test.each([
    { count: 1, text: 'Остался 1 дротик' },
    { count: 2, text: 'Осталось 2 дротика' },
    { count: 0, text: 'Осталось 0 дротиков' },
  ])('counts the darts left ($count)', ({ count, text }) => {
    expect(translator.plural('throw.dartsLeft', count)).toBe(text)
  })
})

describe('Translator in French', () => {
  const translator = new Translator(french, 'fr-FR')

  test('groups digits with the no-break space every face draws, not Intl’s narrow one', () => {
    expect(translator.number(1441)).toBe('1 441')
  })

  test('counts zero and one in the singular', () => {
    expect(translator.plural('throw.dartsLeft', 0)).toBe('0 fléchette restante')
    expect(translator.plural('throw.dartsLeft', 2)).toBe('2 fléchettes restantes')
  })
})
