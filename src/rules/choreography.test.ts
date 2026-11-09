import { describe, expect, test } from 'vitest'
import {
  BOARD_POSITION,
  CHOREOGRAPHY,
  type ChapterRange,
  DEFAULT_HERO_BAND,
  EXIT,
  halfHeightAt,
  narrowHero,
  poseAt,
  type ScreenBand,
} from './choreography'

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

/** Where a height in the scene lands on the screen, in fractions of its height (0 = top) */
function onScreen(y: number, cameraY: number, distance: number): number {
  return 0.5 - (y - cameraY) / (2 * halfHeightAt(distance))
}

/** The masthead's bottom, and the top of a phone chapter's text (38svh plus the label's margin) */
const MASTHEAD = 0.09
const STAGE_BOTTOM = 0.47

describe('the narrow layout', () => {
  // The hero dart reaches 5.3 cm above its centre of gravity and 2.3 cm below, per unit of scale
  const heroTop = (band: ScreenBand): number => {
    const dart = narrowHero(band).to.dart
    return onScreen(dart.position[1] + 5.3 * dart.scale, 0, 60 - dart.position[2])
  }
  const heroBottom = (band: ScreenBand): number => {
    const dart = narrowHero(band).to.dart
    return onScreen(dart.position[1] - 2.3 * dart.scale, 0, 60 - dart.position[2])
  }

  test.each([
    ['a 390 × 844 phone', { top: 0.07, bottom: 0.3 }],
    ['a 412 × 915 phone', { top: 0.07, bottom: 0.357 }],
    ['a 360 × 780 phone', { top: 0.082, bottom: 0.255 }],
  ])('rests the hero dart between the masthead and the first line on %s', (_, band) => {
    expect(heroTop(band)).toBeGreaterThanOrEqual(band.top)
    expect(heroBottom(band)).toBeLessThanOrEqual(band.bottom)
  })

  test('keeps the hero dart between its smallest and largest sizes, whatever the room', () => {
    expect(narrowHero({ top: 0, bottom: 1 }).to.dart.scale).toBe(0.9)
    expect(narrowHero({ top: 0.2, bottom: 0.21 }).to.dart.scale).toBe(0.5)
    expect(narrowHero({ top: 0.4, bottom: 0.1 }).to.dart.scale).toBe(0.5)
  })

  test('centres the hero dart across the screen: its flight reaches further than its point', () => {
    const dart = narrowHero(DEFAULT_HERO_BAND).to.dart

    expect(dart.position[0] - 5.5 * dart.scale).toBeCloseTo(-(dart.position[0] + 8.9 * dart.scale))
  })

  test('shows the whole board between the masthead and the chapter text during the finish', () => {
    const { camera } = CHOREOGRAPHY.narrow.throw.to
    const distance = camera.position[2] - BOARD_POSITION[2]
    const centre = onScreen(BOARD_POSITION[1], camera.position[1], distance)
    const radius = 22.6 / (2 * halfHeightAt(distance))

    expect(centre - radius).toBeGreaterThanOrEqual(MASTHEAD)
    expect(centre + radius).toBeLessThanOrEqual(STAGE_BOTTOM)
    // Looking straight ahead: the board faces the visitor square on
    expect(camera.target[1]).toBe(camera.position[1])
  })

  test.each(['from', 'to'] as const)(
    'keeps the anatomy (%s) above the chapter text, point and flight included',
    (end) => {
      const { dart } = CHOREOGRAPHY.narrow.anatomy[end]
      const up = 5.9 + 2.2 * dart.explode
      const down = 9.6 + 3.8 * dart.explode

      expect(onScreen(dart.position[1] + up * dart.scale, 0, 60)).toBeGreaterThanOrEqual(MASTHEAD)
      expect(onScreen(dart.position[1] - down * dart.scale, 0, 60)).toBeLessThanOrEqual(STAGE_BOTTOM)
    },
  )
})
