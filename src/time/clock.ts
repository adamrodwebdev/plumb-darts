/** Monotonic time in milliseconds, injected so tests can drive it */
export interface Clock {
  now(): number
}

export const performanceClock: Clock = {
  now: () => performance.now(),
}
