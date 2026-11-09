/**
 * The Plumb dart as turned profiles (radius, height) in centimetres, around the Y axis with the
 * origin at the centre of gravity: the tip ends at +5.9 cm, 38% of the 15.5 cm length from it.
 */
export type ProfilePoint = readonly [radius: number, y: number]

export const TIP_END = 5.9
export const LENGTH = 15.5

export const TIP_PROFILE: readonly ProfilePoint[] = [
  [0, 5.9],
  [0.03, 5.82],
  [0.075, 5.6],
  [0.105, 5.2],
  [0.11, 4.9],
  [0.11, 2.85],
  [0, 2.85],
]

const RINGS = 18
const RING_PITCH = 0.12
const BARREL_RADIUS = 0.33
const GROOVE_RADIUS = 0.3

/** Barrel: a tapered nose, eighteen ring grooves 1.2 mm apart, a plain body and a rear taper */
export function barrelProfile(): ProfilePoint[] {
  const points: ProfilePoint[] = [
    [0, 2.72],
    [0.16, 2.72],
    [0.24, 2.62],
    [0.3, 2.45],
    [BARREL_RADIUS, 2.25],
  ]
  for (let ring = 0; ring < RINGS; ring += 1) {
    const centre = 2.14 - ring * RING_PITCH
    points.push(
      [BARREL_RADIUS, centre + 0.035],
      [GROOVE_RADIUS, centre + 0.012],
      [GROOVE_RADIUS, centre - 0.012],
      [BARREL_RADIUS, centre - 0.035],
    )
  }
  points.push([BARREL_RADIUS, -1.6], [0.3, -2.0], [0.26, -2.2], [0.2, -2.3], [0, -2.3])
  return points
}

/** The coloured band at the back of the barrel (PVD coating in the brand colour) */
export const BAND_PROFILE: readonly ProfilePoint[] = [
  [0.336, -1.22],
  [0.338, -1.3],
  [0.338, -1.42],
  [0.336, -1.5],
]

export const SHAFT_PROFILE: readonly ProfilePoint[] = [
  [0, -2.28],
  [0.17, -2.28],
  [0.17, -2.6],
  [0.152, -2.72],
  [0.148, -5.45],
  [0.17, -5.55],
  [0.17, -5.8],
  [0, -5.8],
]

/** One wing of a standard flight in its own plane: (distance from the axis, height) */
export const FLIGHT_WING: readonly ProfilePoint[] = [
  [0.15, -5.35],
  [1.0, -6.6],
  [1.55, -8.25],
  [1.55, -9.6],
  [0.15, -9.6],
]

export type DartPart = 'tip' | 'barrel' | 'shaft' | 'flight'

/** Where each part's label points to, in the dart's own space */
export const PART_ANCHORS: Readonly<Record<DartPart, readonly [number, number, number]>> = {
  tip: [0, 4.4, 0.11],
  barrel: [0, 1.0, 0.33],
  shaft: [0, -4.1, 0.16],
  flight: [0, -8.1, 1.1],
}

/** How far each part travels along the axis in the exploded view (centimetres at full explode) */
export const EXPLODE_OFFSETS: Readonly<Record<DartPart, number>> = {
  tip: 2.2,
  barrel: 0,
  shaft: -2.0,
  flight: -3.8,
}
