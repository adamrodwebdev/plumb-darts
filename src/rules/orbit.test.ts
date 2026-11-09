import { describe, expect, test } from 'vitest'
import { facing, frontCard, orbitSlots, turnFor } from './orbit'

describe('orbitSlots', () => {
  test('spreads six cards evenly around the ring', () => {
    expect(orbitSlots(6).map((slot) => slot.angle)).toEqual([0, 60, 120, 180, 240, 300])
  })

  test('alternates the cards above and below the middle', () => {
    const lifts = orbitSlots(6).map((slot) => Math.sign(slot.lift))
    expect(lifts).toEqual([-1, 1, -1, 1, -1, 1])
  })

  test('gives no slot to an empty ring', () => {
    expect(orbitSlots(0)).toEqual([])
  })
})

describe('facing', () => {
  test.each([
    { angle: 0, turn: 0, expected: 1 },
    { angle: 180, turn: 0, expected: 0 },
    { angle: 60, turn: -60, expected: 1 },
    { angle: 90, turn: 0, expected: 0.5 },
  ])('is $expected for a card at $angle° with the ring turned $turn°', ({ angle, turn, expected }) => {
    expect(facing(angle, turn)).toBeCloseTo(expected)
  })
})

describe('turning to a card', () => {
  test('brings the requested card to the front', () => {
    expect(frontCard(turnFor(4, 6), 6)).toBe(4)
  })

  test('finds the nearest card between two positions and after a full turn', () => {
    expect(frontCard(-70, 6)).toBe(1)
    expect(frontCard(-400, 6)).toBe(1)
    expect(frontCard(20, 6)).toBe(0)
  })
})
