import { describe, expect, test } from 'vitest'
import { CHOREOGRAPHY, type ChapterRange, EXIT, poseAt } from './choreography'

const motions = CHOREOGRAPHY.wide
const ranges: ChapterRange[] = [
  { id: 'game-on', start: 0, end: 100 },
  { id: 'grip', start: 1000, end: 2000 },
  { id: 'weight', start: 3000, end: 4000 },
]

describe('poseAt', () => {
  test('holds the first chapter before its range', () => {
    expect(poseAt(-50, ranges, motions)).toEqual(motions['game-on'].from)
  })

  test('starts a chapter on its "from" pose and ends it on its "to" pose', () => {
    expect(poseAt(1000, ranges, motions)).toEqual(motions.grip.from)
    expect(poseAt(2000, ranges, motions).dart.spin).toBeCloseTo(motions.grip.to.dart.spin)
  })

  test('moves through a chapter as its range is scrolled', () => {
    const middle = poseAt(1500, ranges, motions).dart.spin
    expect(middle).toBeGreaterThan(motions.grip.from.dart.spin)
    expect(middle).toBeLessThan(motions.grip.to.dart.spin)
  })

  test('blends one chapter into the next in the gap between their ranges', () => {
    const camera = poseAt(2500, ranges, motions).camera.position[2]
    const [from, to] = [motions.grip.to.camera.position[2], motions.weight.from.camera.position[2]]
    expect(camera).toBeGreaterThan(Math.min(from, to))
    expect(camera).toBeLessThan(Math.max(from, to))
  })

  test('holds the last chapter after the end of the story', () => {
    expect(poseAt(9000, ranges, motions)).toEqual(motions.weight.to)
  })

  test('sends the dart away after the last chapter when an exit is given', () => {
    const exit = { pose: EXIT.wide, distance: 400 }
    expect(poseAt(4000, ranges, motions, exit)).toEqual(motions.weight.to)
    expect(poseAt(4200, ranges, motions, exit).dart.visible).toBeGreaterThan(0)
    expect(poseAt(4200, ranges, motions, exit).dart.visible).toBeLessThan(1)
    expect(poseAt(4400, ranges, motions, exit)).toEqual(EXIT.wide)
  })

  test('shows the opening pose when no range is known yet', () => {
    expect(poseAt(500, [], motions)).toEqual(motions['game-on'].from)
  })
})

describe('the choreography', () => {
  test.each(['wide', 'narrow'] as const)(
    'hides the hero dart during the finish on %s screens (the thrown darts take over)',
    (layout) => {
      expect(CHOREOGRAPHY[layout].throw.to.dart.visible).toBe(0)
      expect(CHOREOGRAPHY[layout].throw.to.board).toBe(1)
    },
  )

  test.each(['wide', 'narrow'] as const)(
    'explodes the dart and shows its labels by the end of the anatomy on %s screens',
    (layout) => {
      expect(CHOREOGRAPHY[layout].anatomy.to.dart.explode).toBe(1)
      expect(CHOREOGRAPHY[layout].anatomy.to.parts).toBe(1)
    },
  )
})

describe('the board on its way in and out of the finish', () => {
  const story: ChapterRange[] = [
    { id: 'anatomy', start: 0, end: 1000 },
    { id: 'throw', start: 2000, end: 3000 },
    { id: 'checkout', start: 4000, end: 5000 },
  ]

  test.each(['wide', 'narrow'] as const)(
    'comes in from the right before the finish and leaves by the left after it, on %s screens',
    (layout) => {
      const arriving = poseAt(1500, story, CHOREOGRAPHY[layout])
      const leaving = poseAt(3500, story, CHOREOGRAPHY[layout])

      expect(arriving.board).toBeGreaterThan(0)
      expect(arriving.board).toBeLessThan(1)
      expect(arriving.boardSide).toBeGreaterThan(0)
      expect(leaving.board).toBeGreaterThan(0)
      expect(leaving.board).toBeLessThan(1)
      expect(leaving.boardSide).toBeLessThan(0)
    },
  )

  test('stands square in the middle while the finish holds the screen', () => {
    const pose = poseAt(2500, story, CHOREOGRAPHY.wide)

    expect(pose.board).toBe(1)
    expect(pose.boardSide).toBe(0)
  })
})
