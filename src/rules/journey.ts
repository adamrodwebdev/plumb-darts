import type { ChapterId } from './chapters'

/**
 * The sideways journey: chapters 3 to 7 side by side, travelled by scrolling down. Each chapter
 * holds the screen for a while, then the strip slides to the next one. Lengths are in viewport
 * heights of scrolling, so the pace is the same on every screen.
 */

/** The chapters that travel sideways, in page order */
export const JOURNEY_CHAPTERS: readonly ChapterId[] = [
  'grip',
  'weight',
  'anatomy',
  'throw',
  'checkout',
]

/** How long each chapter holds the screen (its 3D move, its gauge or its game happens there) */
export const JOURNEY_HOLDS: Readonly<Partial<Record<ChapterId, number>>> = {
  grip: 1.2,
  weight: 1.0,
  anatomy: 1.5,
  throw: 1.0,
  checkout: 0.6,
}

/** The scrolling it takes to slide from one chapter to the next */
export const JOURNEY_MOVE = 1

/** The sideways mode needs this much height: a chapter must fit one screen (40rem) */
export const JOURNEY_MEDIA = '(height >= 40rem)'

export interface JourneyStop {
  readonly id: ChapterId
  /** Where the chapter starts and stops holding the screen, from the start of the journey */
  readonly start: number
  readonly end: number
}

export interface JourneyPlan {
  readonly stops: readonly JourneyStop[]
  /** The whole journey's scrolling */
  readonly length: number
}

/** Each chapter's hold, one after another with a slide between two */
export function planJourney(
  chapters: readonly ChapterId[],
  holds: Readonly<Partial<Record<ChapterId, number>>>,
  move: number,
): JourneyPlan {
  const stops: JourneyStop[] = []
  let at = 0
  for (const [index, id] of chapters.entries()) {
    if (index > 0) at += move
    const hold = Math.max(0, holds[id] ?? 0)
    stops.push({ id, start: at, end: at + hold })
    at += hold
  }
  return { stops, length: at }
}
