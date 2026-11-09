import { describe, expect, test } from 'vitest'
import { DART_FILE, boardFile, boardFits, dartFits } from './models'
import { QUALITY } from './quality'

describe('boardFile', () => {
  test('gives the high tier the board with the 2048 px face', () => {
    expect(boardFile(QUALITY.high).path).toBe('models/board.glb')
  })

  test.each(['medium', 'low'] as const)(
    'gives the %s tier the board with the 1024 px face',
    (tier) => {
      expect(boardFile(QUALITY[tier]).path).toBe('models/board-1k.glb')
    },
  )

  test('caps every file below the 1.5 MB the scene may weigh in all', () => {
    expect(DART_FILE.maxBytes + boardFile(QUALITY.high).maxBytes).toBeLessThan(1.5 * 1024 * 1024)
  })
})

describe('dartFits', () => {
  test.each([
    { tipEnd: 0.059, fits: true },
    { tipEnd: 0.0594, fits: true },
    { tipEnd: 0.0586, fits: true },
    { tipEnd: 0.0597, fits: false },
    { tipEnd: 0.062, fits: false },
    { tipEnd: 5.9, fits: false },
  ])('a point ending at $tipEnd m fits: $fits', ({ tipEnd, fits }) => {
    expect(dartFits(tipEnd)).toBe(fits)
  })
})

describe('boardFits', () => {
  test.each([
    { radius: 0.2255, fits: true },
    { radius: 0.2259, fits: true },
    { radius: 0.2262, fits: false },
    { radius: 0.17, fits: false },
    { radius: 225.5, fits: false },
  ])('a face of radius $radius m fits: $fits', ({ radius, fits }) => {
    expect(boardFits(radius)).toBe(fits)
  })
})
