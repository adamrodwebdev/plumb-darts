export type Easing = (t: number) => number

export const clamp01 = (t: number): number => Math.min(1, Math.max(0, t))

export const lerp = (from: number, to: number, t: number): number => from + (to - from) * t

export const linear: Easing = (t) => t

export const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

export const easeOutCubic: Easing = (t) => 1 - (1 - t) ** 3

export const easeOutQuart: Easing = (t) => 1 - (1 - t) ** 4

/** Damped wobble of a dart that has just landed: starts at 1, settles to 0 */
export const wobble = (t: number, swings = 3): number =>
  Math.cos(t * swings * 2 * Math.PI) * (1 - t) ** 2
