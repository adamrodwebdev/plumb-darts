export type ChapterId = 'game-on' | 'grip' | 'weight' | 'anatomy' | 'throw' | 'checkout'
export type Tone = 'night' | 'steel' | 'studio'

export interface Chapter {
  readonly id: ChapterId
  /** Message key of the chapter's name */
  readonly name: string
  /** Score left on the counter: the page plays a leg of 501 down to the checkout */
  readonly remaining: number
  readonly tone: Tone
}

export const CHAPTERS: readonly Chapter[] = [
  { id: 'game-on', name: 'chapters.hero', remaining: 501, tone: 'night' },
  { id: 'grip', name: 'chapters.grip', remaining: 441, tone: 'night' },
  { id: 'weight', name: 'chapters.weight', remaining: 321, tone: 'steel' },
  { id: 'anatomy', name: 'chapters.anatomy', remaining: 141, tone: 'studio' },
  { id: 'throw', name: 'chapters.throw', remaining: 40, tone: 'night' },
  { id: 'checkout', name: 'chapters.checkout', remaining: 0, tone: 'studio' },
]

/** The best visit in darts: three treble 20s */
export const MAXIMUM_VISIT = 180

export function chapterById(id: string): Chapter | undefined {
  return CHAPTERS.find((chapter) => chapter.id === id)
}

/** Points scored on the way from one chapter to the next (501 → 441 is a visit of 60) */
export function visitBetween(previous: Chapter, next: Chapter): number {
  return previous.remaining - next.remaining
}

/** The score's three digits, with leading zeros blanked: 40 → [null, 4, 0] */
export function scoreDigits(score: number): readonly (number | null)[] {
  const clamped = Math.max(0, Math.min(999, Math.round(score)))
  const digits = [Math.floor(clamped / 100), Math.floor(clamped / 10) % 10, clamped % 10]
  return digits.map((digit, index) => (index < 2 && clamped < 10 ** (2 - index) ? null : digit))
}
