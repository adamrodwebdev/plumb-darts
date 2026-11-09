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

/**
 * Screens tall enough for the ring: a phone held upright from 30rem, any wider screen from 36rem.
 * Below that (a phone on its side), even shrunk, its print would be too small to read: the
 * clippings stay a flat grid that scrolls with the page.
 */
export const RING_MEDIA = '(width < 40rem) and (height >= 30rem), (height >= 36rem)'

/** A vertical stretch of the screen, in pixels: its top and bottom edges */
export interface Span {
  readonly top: number
  readonly bottom: number
}

/** How the ring's scene is drawn in its stage: scaled about the stage's centre, then moved down */
export interface RingFit {
  readonly scale: number
  /** In pixels, at the scale already applied */
  readonly shift: number
}

export const FULL_SIZE: RingFit = { scale: 1, shift: 0 }

/** Below this the print of the clipping in front would be too small to read */
export const MIN_RING_SCALE = 0.6

/**
 * The fit that holds the ring's scene (the headline and every clipping as it comes to the front)
 * inside the band its stage gives it, centred in that band: shrunk when taller, never grown past
 * its full size. `extent` is measured on screen with the `current` fit applied; the stage scales
 * about the band's centre, so both read in the same pixels.
 */
export function fitRing(extent: Span, band: Span, current: RingFit = FULL_SIZE): RingFit {
  const height = extent.bottom - extent.top
  const room = band.bottom - band.top
  if (!(height > 0) || !(room > 0) || !(current.scale > 0) || !Number.isFinite(current.shift)) {
    return current
  }
  const scale = Math.min(1, Math.max(MIN_RING_SCALE, (room / height) * current.scale))
  // The scene's middle as an offset from the band's middle, at full size and with no shift
  const middle = (extent.top + extent.bottom) / 2 - (band.top + band.bottom) / 2
  const offset = (middle - current.shift) / current.scale
  return { scale, shift: -offset * scale }
}
