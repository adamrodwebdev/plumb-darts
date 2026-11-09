import { describe, expect, test } from 'vitest'
import { BOARD } from '../rules/board'
import { AIM_POINTS } from '../rules/scoring'
import { SeededRandom } from '../time/random'
import { ThrowSession } from './ThrowSession'

describe('ThrowSession', () => {
  test('gives three darts per visit', () => {
    const session = new ThrowSession(new SeededRandom(1))
    for (let dart = 0; dart < 4; dart += 1) session.throwAt(AIM_POINTS.T20)
    expect(session.visit()).toHaveLength(3)
    expect(session.canThrow()).toBe(false)
  })

  test('collecting the darts gives three new ones', () => {
    const session = new ThrowSession(new SeededRandom(1))
    session.throwAt(AIM_POINTS.T20)
    session.collect()
    expect(session.dartsLeft()).toBe(3)
    expect(session.visit()).toEqual([])
  })

  test('lands exactly on the aim without spread, and wins on double 20', () => {
    const session = new ThrowSession(new SeededRandom(1), 0)
    session.throwAt(AIM_POINTS.D20)
    expect(session.lastThrow()).toMatchObject({ landing: AIM_POINTS.D20, gameShot: true })
    expect(session.won()).toBe(true)
  })

  test('replays the same throws from the same seed', () => {
    const play = (seed: number) => {
      const session = new ThrowSession(new SeededRandom(seed))
      for (let dart = 0; dart < 3; dart += 1) session.throwAt(AIM_POINTS.T20)
      return session.visit().map((thrown) => thrown.landing)
    }
    expect(play(42)).toEqual(play(42))
    expect(play(42)).not.toEqual(play(43))
  })

  test('hits double 20 about one dart in three when aiming at it (seeded, 3000 darts)', () => {
    const random = new SeededRandom(7)
    let hits = 0
    for (let visit = 0; visit < 1000; visit += 1) {
      const session = new ThrowSession(random)
      for (let dart = 0; dart < 3; dart += 1) session.throwAt(AIM_POINTS.D20)
      hits += session.visit().filter((thrown) => thrown.gameShot).length
    }
    expect(hits / 3000).toBeGreaterThan(0.2)
    expect(hits / 3000).toBeLessThan(0.45)
  })

  test('aims "anywhere" inside the scoring area', () => {
    const session = new ThrowSession(new SeededRandom(3))
    const points = Array.from({ length: 500 }, () => session.aimFor('ANY'))
    const farthest = Math.max(...points.map((point) => Math.hypot(point.x, point.y)))
    expect(farthest).toBeLessThanOrEqual(BOARD.doubleOuter)
  })
})
