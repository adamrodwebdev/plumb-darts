import { lerp } from './easing'

export type Vec3 = readonly [number, number, number]

export interface DartPose {
  readonly position: Vec3
  /** Euler angles in degrees, XYZ order (the dart's axis is +Y, tip first) */
  readonly rotation: Vec3
  readonly scale: number
  /** Turn around the dart's own axis, in degrees */
  readonly spin: number
  /** 0 assembled, 1 exploded into its four parts */
  readonly explode: number
  /** 0 hidden, 1 shown */
  readonly visible: number
}

export interface CameraPose {
  readonly position: Vec3
  readonly target: Vec3
}

export interface ScenePose {
  readonly dart: DartPose
  readonly camera: CameraPose
  /** 0 the board is away, 1 in place */
  readonly board: number
  /**
   * The side the board comes from or leaves by, while it is away: -1 left, 1 right. It travels
   * with the story (in from the right before the finish, out to the left after it)
   */
  readonly boardSide: number
  /** 0 a single dart, 1 the set of three on show */
  readonly set: number
  /** Visibility of the centre-of-gravity marker */
  readonly cog: number
  /** Visibility of the part labels */
  readonly parts: number
}

export interface ChapterMotion {
  /** Pose when the chapter starts holding the screen */
  readonly from: ScenePose
  /** Pose when it lets go */
  readonly to: ScenePose
}

export const mixVec = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
]

export function mixPose(a: ScenePose, b: ScenePose, t: number): ScenePose {
  return {
    dart: {
      position: mixVec(a.dart.position, b.dart.position, t),
      rotation: mixVec(a.dart.rotation, b.dart.rotation, t),
      scale: lerp(a.dart.scale, b.dart.scale, t),
      spin: lerp(a.dart.spin, b.dart.spin, t),
      explode: lerp(a.dart.explode, b.dart.explode, t),
      visible: lerp(a.dart.visible, b.dart.visible, t),
    },
    camera: {
      position: mixVec(a.camera.position, b.camera.position, t),
      target: mixVec(a.camera.target, b.camera.target, t),
    },
    board: lerp(a.board, b.board, t),
    boardSide: lerp(a.boardSide, b.boardSide, t),
    set: lerp(a.set, b.set, t),
    cog: lerp(a.cog, b.cog, t),
    parts: lerp(a.parts, b.parts, t),
  }
}

/** A chapter that holds one pose from start to end */
export const hold = (pose: ScenePose): ChapterMotion => ({ from: pose, to: pose })
