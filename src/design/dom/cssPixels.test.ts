import { describe, expect, test } from 'vitest'
import { cssPixels } from './cssPixels'

describe('cssPixels', () => {
  test.each([
    ['72px', 72],
    ['4.5px', 4.5],
    ['0px', 0],
  ])('reads %s as %s', (value, pixels) => {
    expect(cssPixels(value)).toBe(pixels)
  })

  test.each(['auto', '', '72', '1e3px', '-4px', '72 px', '72PX', '200000px', '4.5rem'])(
    'reads %j as 0, not a pixel length the page sets',
    (value) => {
      expect(cssPixels(value)).toBe(0)
    },
  )
})
