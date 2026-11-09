import { describe, expect, test } from 'vitest'
import { facing, fitRing, frontCard, MIN_RING_SCALE, orbitSlots, turnFor } from './orbit'

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

describe('fitting the ring into its stage', () => {
  test('leaves a scene that fits at its full size, moved to the middle of its band', () => {
    expect(fitRing({ top: 100, bottom: 300 }, { top: 0, bottom: 500 })).toEqual({
      scale: 1,
      shift: 50,
    })
  })

  test('shrinks a scene taller than its band to the band, centred in it', () => {
    const fit = fitRing({ top: 0, bottom: 500 }, { top: 100, bottom: 500 })
    expect(fit.scale).toBeCloseTo(0.8)
    expect(fit.shift).toBeCloseTo(40)
  })

  test('keeps a fit already applied when the scene, measured with it, fills its band', () => {
    const fit = fitRing({ top: 100, bottom: 500 }, { top: 100, bottom: 500 }, { scale: 0.8, shift: 40 })
    expect(fit.scale).toBeCloseTo(0.8)
    expect(fit.shift).toBeCloseTo(40)
  })

  test('grows a shrunk scene back to its full size when its band grows', () => {
    const fit = fitRing({ top: 100, bottom: 500 }, { top: -200, bottom: 800 }, { scale: 0.8, shift: 40 })
    expect(fit.scale).toBe(1)
    expect(fit.shift).toBeCloseTo(50)
  })

  test('never shrinks the print below a readable size, nor grows it past full size', () => {
    expect(fitRing({ top: 0, bottom: 1000 }, { top: 0, bottom: 100 }).scale).toBe(MIN_RING_SCALE)
    expect(fitRing({ top: 0, bottom: 100 }, { top: 0, bottom: 1000 }).scale).toBe(1)
  })

  test.each([
    { name: 'an empty scene', extent: { top: 50, bottom: 50 }, band: { top: 0, bottom: 500 } },
    { name: 'an empty band', extent: { top: 0, bottom: 300 }, band: { top: 80, bottom: 80 } },
    { name: 'a scene not measured', extent: { top: Number.NaN, bottom: 300 }, band: { top: 0, bottom: 500 } },
  ])('keeps the current fit for $name', ({ extent, band }) => {
    const current = { scale: 0.8, shift: 12 }
    expect(fitRing(extent, band, current)).toBe(current)
  })
})
