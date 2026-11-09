import { describe, expect, test } from 'vitest'
import { BOARD, SEGMENTS } from './board'
import { AIM_POINTS, clockAngle, isAimTarget, isGameShot, scoreAt, segmentAt } from './scoring'

/** A point at a radius (mm) on the middle line of a segment */
function onSegment(segment: number, radius: number): { x: number; y: number } {
  const radians = (SEGMENTS.indexOf(segment) * 18 * Math.PI) / 180
  return { x: radius * Math.sin(radians), y: radius * Math.cos(radians) }
}

describe('scoreAt', () => {
  test.each([
    { name: 'the bullseye', point: { x: 0, y: 0 }, ring: 'bull', points: 50 },
    { name: 'the outer bull', point: { x: 10, y: 0 }, ring: 'outer-bull', points: 25 },
    { name: 'treble 20', point: onSegment(20, 103), ring: 'treble', points: 60 },
    { name: 'double 20', point: onSegment(20, 166), ring: 'double', points: 40 },
    { name: 'single 20 between the rings', point: onSegment(20, 130), ring: 'single', points: 20 },
    { name: 'treble 19', point: onSegment(19, 103), ring: 'treble', points: 57 },
    { name: 'double 3', point: onSegment(3, 166), ring: 'double', points: 6 },
    { name: 'a miss outside the double ring', point: onSegment(20, 180), ring: 'miss', points: 0 },
  ])('scores $name', ({ point, ring, points }) => {
    expect(scoreAt(point)).toMatchObject({ ring, points })
  })

  test('counts a dart on the double ring outer wire as in', () => {
    expect(scoreAt(onSegment(20, BOARD.doubleOuter)).ring).toBe('double')
  })

  test('counts a dart just past the double ring as a miss', () => {
    expect(scoreAt(onSegment(20, BOARD.doubleOuter + 0.01)).ring).toBe('miss')
  })
})

describe('segmentAt', () => {
  test('reads the segments clockwise from 20 at the top', () => {
    const found = SEGMENTS.map((segment) => segmentAt(onSegment(segment, 60)))
    expect(found).toEqual([...SEGMENTS])
  })

  test('puts a point 8 degrees right of the top in the 20 and 10 degrees right in the 1', () => {
    const at = (degrees: number) => {
      const radians = (degrees * Math.PI) / 180
      return segmentAt({ x: 60 * Math.sin(radians), y: 60 * Math.cos(radians) })
    }
    expect([at(8), at(10)]).toEqual([20, 1])
  })

  test('measures angles clockwise from the top', () => {
    expect(clockAngle({ x: 1, y: 0 })).toBeCloseTo(90)
    expect(clockAngle({ x: 0, y: -1 })).toBeCloseTo(180)
    expect(clockAngle({ x: -1, y: 0 })).toBeCloseTo(270)
  })
})

describe('targets', () => {
  test.each([
    { target: 'D20', expected: { ring: 'double', segment: 20 } },
    { target: 'T20', expected: { ring: 'treble', segment: 20 } },
    { target: 'BULL', expected: { ring: 'bull', segment: null } },
    { target: 'T19', expected: { ring: 'treble', segment: 19 } },
  ] as const)('aims at the middle of $target', ({ target, expected }) => {
    expect(scoreAt(AIM_POINTS[target])).toMatchObject(expected)
  })

  test('wins the leg on double 20 only', () => {
    expect(isGameShot(scoreAt(AIM_POINTS.D20))).toBe(true)
    expect(isGameShot(scoreAt(AIM_POINTS.T20))).toBe(false)
  })

  test('accepts the listed targets and refuses anything else', () => {
    expect(['D20', 'T20', 'BULL', 'T19', 'ANY'].every(isAimTarget)).toBe(true)
    expect(isAimTarget('D25')).toBe(false)
  })

  test.each(['toString', 'constructor', '__proto__', 'hasOwnProperty'])(
    'refuses %s, a key every object inherits',
    (value) => {
      expect(isAimTarget(value)).toBe(false)
    },
  )
})
