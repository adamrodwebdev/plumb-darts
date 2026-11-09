import { BOARD } from '../rules/board'
import {
  AIM_POINTS,
  type AimTarget,
  type BoardPoint,
  type Score,
  isGameShot,
  scoreAt,
} from '../rules/scoring'
import { type RandomSource, gaussian } from '../time/random'

export interface Throw {
  readonly aim: BoardPoint
  readonly landing: BoardPoint
  readonly score: Score
  readonly gameShot: boolean
}

/**
 * A visit of three darts at the board. Each dart lands around its aim point with a normal spread
 * (a good club player: about 9 mm), so tops is hit about one dart in three.
 */
export class ThrowSession {
  static readonly DARTS = 3
  private readonly throws: Throw[] = []

  constructor(
    private readonly random: RandomSource,
    private readonly spreadMm = 9,
  ) {}

  dartsLeft(): number {
    return ThrowSession.DARTS - this.throws.length
  }

  canThrow(): boolean {
    return this.dartsLeft() > 0
  }

  visit(): readonly Throw[] {
    return this.throws
  }

  lastThrow(): Throw | undefined {
    return this.throws.at(-1)
  }

  won(): boolean {
    return this.throws.some((thrown) => thrown.gameShot)
  }

  /** The point a named target means; "ANY" is a fresh random point on the scoring area */
  aimFor(target: AimTarget): BoardPoint {
    if (target !== 'ANY') return AIM_POINTS[target]
    const radius = BOARD.doubleOuter * Math.sqrt(this.random.next())
    const angle = 2 * Math.PI * this.random.next()
    return { x: radius * Math.sin(angle), y: radius * Math.cos(angle) }
  }

  throwAt(aim: BoardPoint): void {
    if (!this.canThrow()) return
    const landing = {
      x: aim.x + gaussian(this.random) * this.spreadMm,
      y: aim.y + gaussian(this.random) * this.spreadMm,
    }
    const score = scoreAt(landing)
    this.throws.push({ aim, landing, score, gameShot: isGameShot(score) })
  }

  collect(): void {
    this.throws.length = 0
  }
}
