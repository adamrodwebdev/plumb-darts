import { describe, expect, test } from 'vitest'
import { JOURNEY_CHAPTERS, JOURNEY_HOLDS, JOURNEY_MOVE, planJourney } from './journey'

describe('planJourney', () => {
  test('holds each chapter in turn, with one slide between two', () => {
    const plan = planJourney(['grip', 'weight', 'anatomy'], { grip: 1.2, weight: 1, anatomy: 1.5 }, 1)

    expect(plan.stops).toEqual([
      { id: 'grip', start: 0, end: 1.2 },
      { id: 'weight', start: 2.2, end: 3.2 },
      { id: 'anatomy', start: 4.2, end: 5.7 },
    ])
    expect(plan.length).toBe(5.7)
  })

  test('starts on the first chapter at once: the strip is already in place when it pins', () => {
    const plan = planJourney(['grip'], { grip: 1.2 }, 1)

    expect(plan.stops[0]?.start).toBe(0)
  })

  test('gives a chapter without a hold a stop of no length, never a negative one', () => {
    const plan = planJourney(['grip', 'weight'], { grip: -1 }, 1)

    expect(plan.stops).toEqual([
      { id: 'grip', start: 0, end: 0 },
      { id: 'weight', start: 1, end: 1 },
    ])
  })

  test('the real journey travels chapters 3 to 7 in page order, every one holding the screen', () => {
    const plan = planJourney(JOURNEY_CHAPTERS, JOURNEY_HOLDS, JOURNEY_MOVE)

    expect(plan.stops.map((stop) => stop.id)).toEqual([
      'grip',
      'weight',
      'anatomy',
      'throw',
      'checkout',
    ])
    expect(plan.stops.every((stop) => stop.end > stop.start)).toBe(true)
  })
})
