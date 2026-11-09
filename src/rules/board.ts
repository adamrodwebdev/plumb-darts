/** Regulation dartboard geometry in millimetres (WDF and PDC rules), from the centre of the bull. */
export const BOARD = {
  bullseye: 6.35,
  outerBull: 15.9,
  trebleInner: 99,
  trebleOuter: 107,
  doubleInner: 162,
  doubleOuter: 170,
  numbersRadius: 196,
  edge: 225.5,
} as const

/** Segment numbers clockwise from the top */
export const SEGMENTS: readonly number[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
]

export const SEGMENT_DEGREES = 360 / SEGMENTS.length
