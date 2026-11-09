import { describe, expect, test } from 'vitest'
import { CHAPTERS, MAXIMUM_VISIT, chapterById, scoreDigits, visitBetween } from './chapters'

describe('the leg played by the chapters', () => {
  test('starts at 501 and ends on the checkout at 0', () => {
    expect(CHAPTERS.at(0)?.remaining).toBe(501)
    expect(CHAPTERS.at(-1)?.remaining).toBe(0)
  })

  test('never scores more than a maximum visit between two chapters', () => {
    const visits = CHAPTERS.slice(1).map((chapter, index) => {
      const previous = CHAPTERS[index]
      return previous ? visitBetween(previous, chapter) : 0
    })
    expect(Math.max(...visits)).toBe(MAXIMUM_VISIT)
    expect(Math.min(...visits)).toBeGreaterThan(0)
  })

  test('finds a chapter by its section id', () => {
    expect(chapterById('anatomy')?.remaining).toBe(81)
    expect(chapterById('nowhere')).toBeUndefined()
  })
})

describe('scoreDigits', () => {
  test.each([
    { score: 501, digits: [5, 0, 1] },
    { score: 141, digits: [1, 4, 1] },
    { score: 40, digits: [null, 4, 0] },
    { score: 7, digits: [null, null, 7] },
    { score: 0, digits: [null, null, 0] },
  ])('shows $score as $digits', ({ score, digits }) => {
    expect(scoreDigits(score)).toEqual(digits)
  })

  test('keeps out-of-range scores within the three digits', () => {
    expect(scoreDigits(-12)).toEqual([null, null, 0])
    expect(scoreDigits(1234)).toEqual([9, 9, 9])
  })
})
