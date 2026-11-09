import { BOARD, SEGMENT_DEGREES, SEGMENTS } from './board'

/** Where a dart can land; each ring has its label in every language (score.<ring>) */
export const RINGS = ['bull', 'outer-bull', 'single', 'double', 'treble', 'miss'] as const
export type Ring = (typeof RINGS)[number]

export interface Score {
  readonly ring: Ring
  /** The segment's number, or null for the bulls and a miss */
  readonly segment: number | null
  readonly points: number
}

/** A point on the board's face in millimetres: origin at the bull, x to the right, y up */
export interface BoardPoint {
  readonly x: number
  readonly y: number
}

/** Clockwise angle from the top (the 20), in degrees within [0, 360) */
export function clockAngle(point: BoardPoint): number {
  const degrees = (Math.atan2(point.x, point.y) * 180) / Math.PI
  return (degrees + 360) % 360
}

export function segmentAt(point: BoardPoint): number {
  const shifted = (clockAngle(point) + SEGMENT_DEGREES / 2) % 360
  return SEGMENTS[Math.floor(shifted / SEGMENT_DEGREES)] ?? 20
}

export function scoreAt(point: BoardPoint): Score {
  const radius = Math.hypot(point.x, point.y)
  if (radius <= BOARD.bullseye) return { ring: 'bull', segment: null, points: 50 }
  if (radius <= BOARD.outerBull) return { ring: 'outer-bull', segment: null, points: 25 }
  if (radius > BOARD.doubleOuter) return { ring: 'miss', segment: null, points: 0 }
  const segment = segmentAt(point)
  if (radius >= BOARD.doubleInner) return { ring: 'double', segment, points: segment * 2 }
  if (radius >= BOARD.trebleInner && radius <= BOARD.trebleOuter) {
    return { ring: 'treble', segment, points: segment * 3 }
  }
  return { ring: 'single', segment, points: segment }
}

/** The leg is won on double 20 ("tops"): 40 left, as the score counter shows */
export const isGameShot = (score: Score): boolean => score.ring === 'double' && score.segment === 20

export type AimTarget = 'D20' | 'T20' | 'BULL' | 'T19' | 'ANY'

function polar(radius: number, segment: number): BoardPoint {
  const radians = (SEGMENTS.indexOf(segment) * SEGMENT_DEGREES * Math.PI) / 180
  return { x: radius * Math.sin(radians), y: radius * Math.cos(radians) }
}

/** Where a player aims for each named target (the middle of the bed) */
export const AIM_POINTS: Readonly<Record<Exclude<AimTarget, 'ANY'>, BoardPoint>> = {
  D20: polar((BOARD.doubleInner + BOARD.doubleOuter) / 2, 20),
  T20: polar((BOARD.trebleInner + BOARD.trebleOuter) / 2, 20),
  BULL: { x: 0, y: 0 },
  T19: polar((BOARD.trebleInner + BOARD.trebleOuter) / 2, 19),
}

export const AIM_TARGETS: readonly AimTarget[] = ['D20', 'T20', 'BULL', 'T19', 'ANY']

/** Checked against the list itself: `in` would also accept `toString` or `__proto__` */
export const isAimTarget = (value: string): value is AimTarget =>
  AIM_TARGETS.some((target) => target === value)
