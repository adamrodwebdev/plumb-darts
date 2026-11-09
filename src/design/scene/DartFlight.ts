import { Quaternion, Vector3 } from 'three'
import { TIP_END } from '../../rules/dartProfile'
import { clamp01, easeOutCubic, wobble } from '../../rules/easing'
import type { DartModel } from './DartModel'
import type { Animation } from './Stage'

const AXIS = new Vector3(0, 1, 0)
const FLIGHT_MS = 420
const WOBBLE_MS = 650
const ARC_CM = 5
/** How deep the point sinks into the sisal */
const BITE_CM = 0.35

export interface FlightPlan {
  readonly from: Vector3
  /** The landing point on the board's face */
  readonly to: Vector3
  readonly start: number
  /** Called once, when the point lands (sound, result) */
  readonly onLand: () => void
  /** Reduced motion: the dart appears where it lands, without flying or wobbling */
  readonly instant: boolean
}

/**
 * A thrown dart: a short arc point first, turning around its own axis like a real throw, then
 * a damped wobble once it bites into the board.
 */
export class DartFlight implements Animation {
  private landed = false
  private readonly direction: Vector3
  /** The point, sunk into the sisal */
  private readonly tip: Vector3
  private readonly restPosition: Vector3
  private readonly restRotation: Quaternion
  private readonly wobbleAxis: Vector3

  constructor(
    private readonly dart: DartModel,
    private readonly plan: FlightPlan,
  ) {
    this.direction = plan.to.clone().sub(plan.from).normalize()
    this.restRotation = new Quaternion().setFromUnitVectors(AXIS, this.direction)
    this.tip = plan.to.clone().addScaledVector(this.direction, BITE_CM)
    // The centre of gravity sits the tip's length behind the point
    this.restPosition = this.tip.clone().addScaledVector(this.direction, -TIP_END)
    this.wobbleAxis = new Vector3(1, 0, 0).applyQuaternion(this.restRotation)
    dart.root.visible = true
    dart.root.scale.setScalar(1)
    dart.setExplode(0)
  }

  step(now: number): boolean {
    const elapsed = this.plan.instant ? FLIGHT_MS + WOBBLE_MS : now - this.plan.start
    const t = clamp01(elapsed / FLIGHT_MS)
    if (t < 1) {
      const eased = easeOutCubic(t)
      this.dart.root.position
        .lerpVectors(this.plan.from, this.restPosition, eased)
        .addScaledVector(new Vector3(0, 1, 0), Math.sin(Math.PI * t) * ARC_CM)
      this.dart.root.quaternion.copy(this.restRotation)
      this.dart.setSpin(t * 540)
      return true
    }
    if (!this.landed) {
      this.landed = true
      this.dart.root.position.copy(this.restPosition)
      this.dart.setSpin(0)
      this.plan.onLand()
    }
    // The wobble pivots on the embedded point, which never moves
    const settle = clamp01((elapsed - FLIGHT_MS) / WOBBLE_MS)
    const angle = this.plan.instant ? 0 : wobble(settle) * 0.09
    const rotation = this.restRotation
      .clone()
      .premultiply(new Quaternion().setFromAxisAngle(this.wobbleAxis, angle))
    const axis = AXIS.clone().applyQuaternion(rotation)
    this.dart.root.quaternion.copy(rotation)
    this.dart.root.position.copy(this.tip).addScaledVector(axis, -TIP_END)
    return settle < 1
  }
}
