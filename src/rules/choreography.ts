import type { ChapterId } from './chapters'
import { clamp01, easeInOutCubic } from './easing'
import {
  type CameraPose,
  type ChapterMotion,
  type DartPose,
  type ScenePose,
  hold,
  mixPose,
} from './pose'

/** Wide screens put the object beside the text; narrow ones above it */
export type Layout = 'wide' | 'narrow'

const CAMERA_HOME: CameraPose = { position: [0, 0, 60], target: [0, 0, 0] }

const DART_DEFAULTS: DartPose = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
  spin: 0,
  explode: 0,
  visible: 1,
}

interface PoseParts {
  readonly dart: Partial<DartPose>
  readonly camera?: CameraPose
  readonly board?: number
  readonly set?: number
  readonly cog?: number
  readonly parts?: number
}

const pose = (parts: PoseParts): ScenePose => ({
  dart: { ...DART_DEFAULTS, ...parts.dart },
  camera: parts.camera ?? CAMERA_HOME,
  board: parts.board ?? 0,
  set: parts.set ?? 0,
  cog: parts.cog ?? 0,
  parts: parts.parts ?? 0,
})

/** Out of shot during the finish: the visitor's own darts take over */
const DART_AWAY: Partial<DartPose> = { position: [0, -40, 20], rotation: [0, 0, -90], visible: 0 }

const WIDE: Readonly<Record<ChapterId, ChapterMotion>> = {
  // The dart crosses the end of the headline: the words sit behind it
  'game-on': hold(pose({ dart: { position: [0, 2.5, 8], rotation: [14, 20, 105], scale: 1.45 } })),
  // Tip towards the text (thin), flights off to the right; the camera looks left of the dart
  grip: {
    from: pose({
      dart: { position: [9, 0.4, 0], rotation: [10, 14, 90] },
      camera: { position: [6, 1.6, 34], target: [4.5, 0.3, 0] },
    }),
    to: pose({
      dart: { position: [9, 0.4, 0], rotation: [10, 14, 90], spin: 160 },
      camera: { position: [6, 0.8, 16], target: [3.6, 0.3, 0] },
    }),
  },
  weight: {
    from: pose({
      dart: { position: [8.5, -0.6, 0], rotation: [8, -6, -90], spin: 160 },
      camera: { position: [0, 0, 46], target: [3, 0, 0] },
    }),
    to: pose({
      dart: { position: [8.5, -0.6, 0], rotation: [8, -6, -90], spin: 220 },
      camera: { position: [0, 0, 46], target: [3, 0, 0] },
      cog: 1,
    }),
  },
  anatomy: {
    from: pose({
      dart: { position: [2, -4.5, 0], rotation: [12, 0, -90], spin: 220 },
      camera: { position: [0, 0, 62], target: [0, -1.5, 0] },
    }),
    to: pose({
      dart: { position: [2, -4.5, 0], rotation: [12, 0, -90], spin: 270, explode: 1 },
      camera: { position: [0, 0, 62], target: [0, -1.5, 0] },
      parts: 1,
    }),
  },
  throw: hold(
    pose({
      dart: DART_AWAY,
      camera: { position: [-15, 0, -24], target: [-15, 0, -120] },
      board: 1,
    }),
  ),
  checkout: hold(pose({ dart: { position: [11, -0.5, 0], scale: 1.1 }, set: 1 })),
}

const NARROW: Readonly<Record<ChapterId, ChapterMotion>> = {
  // In the free band above the text, its point just touching the headline
  'game-on': hold(pose({ dart: { position: [0, 10.6, 2], rotation: [12, 16, 128], scale: 0.9 } })),
  grip: {
    from: pose({
      dart: { position: [0, 8.6, 0], rotation: [10, -12, -90], scale: 0.85 },
      camera: { position: [-1.5, 6, 30], target: [0, 8, 0] },
    }),
    to: pose({
      dart: { position: [0, 8.6, 0], rotation: [10, -12, -90], scale: 0.85, spin: 160 },
      camera: { position: [2, 6.6, 23], target: [0.9, 8.3, 0] },
    }),
  },
  weight: {
    from: pose({
      dart: { position: [0, 9, 0], rotation: [8, -6, -90], scale: 0.85, spin: 160 },
      camera: { position: [0, 4, 52], target: [0, 4, 0] },
    }),
    to: pose({
      dart: { position: [0, 9, 0], rotation: [8, -6, -90], scale: 0.85, spin: 220 },
      camera: { position: [0, 4, 52], target: [0, 4, 0] },
      cog: 1,
    }),
  },
  anatomy: {
    from: pose({ dart: { position: [-3, -6.5, 0], rotation: [0, 18, 0], scale: 0.72, spin: 0 } }),
    to: pose({
      dart: { position: [-3, -5.5, 0], rotation: [0, 18, 0], scale: 0.72, spin: 50, explode: 1 },
      parts: 1,
    }),
  },
  throw: hold(
    pose({
      dart: DART_AWAY,
      camera: { position: [0, -21, 64], target: [0, -21, -120] },
      board: 1,
    }),
  ),
  checkout: hold(pose({ dart: { position: [0, 8.2, 0], scale: 0.8 }, set: 1 })),
}

export const CHOREOGRAPHY: Readonly<Record<Layout, Readonly<Record<ChapterId, ChapterMotion>>>> = {
  wide: WIDE,
  narrow: NARROW,
}

/** Where the board hangs in the scene (centimetres) */
export const BOARD_POSITION = [0, 0, -120] as const

export interface ChapterRange {
  readonly id: ChapterId
  /** Scroll position where the chapter starts holding the screen */
  readonly start: number
  /** Scroll position where it lets go */
  readonly end: number
}

/**
 * The scene's pose at a scroll position. Inside a chapter's range the pose moves from its "from"
 * to its "to"; between two ranges it blends one chapter's end into the next one's start.
 */
export function poseAt(
  scroll: number,
  ranges: readonly ChapterRange[],
  motions: Readonly<Record<ChapterId, ChapterMotion>>,
): ScenePose {
  const first = ranges[0]
  if (!first) return motions['game-on'].from
  if (scroll <= first.start) return motions[first.id].from

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index]
    if (!range) break
    const motion = motions[range.id]
    if (scroll <= range.end) {
      const span = range.end - range.start
      const t = span > 0 ? (scroll - range.start) / span : 1
      return mixPose(motion.from, motion.to, easeInOutCubic(clamp01(t)))
    }
    const next = ranges[index + 1]
    if (!next) return motion.to
    if (scroll < next.start) {
      const gap = next.start - range.end
      const u = gap > 0 ? (scroll - range.end) / gap : 1
      return mixPose(motion.to, motions[next.id].from, easeInOutCubic(clamp01(u)))
    }
  }
  const last = ranges[ranges.length - 1]
  return last ? motions[last.id].to : motions['game-on'].from
}
