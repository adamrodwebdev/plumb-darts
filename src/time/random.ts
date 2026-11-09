/** Source of numbers in [0, 1), injected so a seed can make every throw reproducible */
export interface RandomSource {
  next(): number
}

/** Mulberry32: small, fast and good enough for a dart's spread */
export class SeededRandom implements RandomSource {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

/** A standard normal draw (Box–Muller) */
export function gaussian(random: RandomSource): number {
  const u = Math.max(random.next(), Number.EPSILON)
  const v = random.next()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
