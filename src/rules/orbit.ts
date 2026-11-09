/**
 * Cards orbiting a centre in CSS 3D (the press clippings around the headline): an even spread
 * around a ring, at alternating heights so it reads as a loose cloud rather than a wheel.
 */
export interface OrbitSlot {
  /** Angle around the ring, in degrees (0 = facing the viewer) */
  readonly angle: number
  /** Vertical offset, in rem */
  readonly lift: number
  /** A slight paper tilt, in degrees */
  readonly tilt: number
}

const LIFTS = [-3.5, 2.75, -1, 4, -2.75, 1.5, -4, 3.25] as const
const TILTS = [-2.5, 1.5, -1, 2.5, -1.5, 1, -2, 2] as const

export function orbitSlots(count: number): readonly OrbitSlot[] {
  const step = count > 0 ? 360 / count : 0
  return Array.from({ length: count }, (_, index) => ({
    angle: index * step,
    lift: LIFTS[index % LIFTS.length] ?? 0,
    tilt: TILTS[index % TILTS.length] ?? 0,
  }))
}

/** How much a card faces the viewer at a ring turn: 1 at the front, 0 at the back */
export function facing(angle: number, turn: number): number {
  return (1 + Math.cos(((angle + turn) * Math.PI) / 180)) / 2
}

/** The ring turn that brings a card to the front */
export function turnFor(index: number, count: number): number {
  return count > 0 ? (-index * 360) / count : 0
}

/** The card nearest the front at a ring turn */
export function frontCard(turn: number, count: number): number {
  if (count <= 0) return 0
  const step = 360 / count
  const position = Math.round(-turn / step)
  return ((position % count) + count) % count
}
