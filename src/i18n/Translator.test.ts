import { describe, expect, test } from 'vitest'
import messages from './en.json'
import { Translator } from './Translator'

describe('Translator', () => {
  const translator = new Translator(messages, 'en')

  test('fills placeholders, formatting numbers for the locale', () => {
    expect(translator.t('throw.hit', { label: 'Treble 20', points: 60 })).toBe('Treble 20, 60 points.')
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

  test('shows the key itself when a message is missing (visible in review, never blank)', () => {
    expect(translator.t('nowhere.at.all')).toBe('nowhere.at.all')
  })

  test('labels every scoring ring', () => {
    const rings = ['single', 'double', 'treble', 'outer-bull', 'bull', 'miss']
    const labels = rings.map((ring) => translator.t(`score.${ring}`, { segment: 20 }))
    expect(labels).toEqual(['Single 20', 'Double 20', 'Treble 20', 'Outer bull', 'Bullseye', 'Missed the board'])
  })
})
