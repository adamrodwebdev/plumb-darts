import type { ChapterId } from './chapters'
import { clamp01, easeInOutCubic } from './easing'
import {
  type CameraPose,
  type ChapterMotion,
  type DartPose,
  type ScenePose,
  type Vec3,
  hold,
  mixPose,
} from './pose'

/** Wide screens put the object beside the text; narrow ones above it */
export type Layout = 'wide' | 'narrow'

/**
 * The camera's vertical field of view, in degrees. It alone sets how high a pose sits on the
 * screen: a phone's poses are placed in fractions of the screen's height, whatever its width.
 */
export const CAMERA_FOV = 30

/** Half the visible height (cm) at a distance from the camera */
export const halfHeightAt = (distance: number): number =>
  distance * Math.tan(((CAMERA_FOV / 2) * Math.PI) / 180)

/** A band of the screen, in fractions of its height: 0 at the top, 1 at the bottom */
export interface ScreenBand {
  readonly top: number
  readonly bottom: number
}

const CAMERA_HOME: CameraPose = { position: [0, 0, 60], target: [0, 0, 0] }

/** Where the board hangs in the scene (centimetres) */
export const BOARD_POSITION = [0, 0, -120] as const

/**
 * Where the dart flies in from the first time the scene appears, as an offset from its first pose
 * (cm): from the top right on wide screens; on phones from the right, level with its band, so it
 * never passes under the masthead's buttons
 */
export const ARRIVAL_OFFSET: Readonly<Record<Layout, Vec3>> = {
  wide: [16, 12, -40],
  narrow: [18, 1, -40],
}

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
  readonly boardSide?: number
  readonly set?: number
  readonly cog?: number
  readonly parts?: number
}

const pose = (parts: PoseParts): ScenePose => ({
  dart: { ...DART_DEFAULTS, ...parts.dart },
  camera: parts.camera ?? CAMERA_HOME,
  board: parts.board ?? 0,
  boardSide: parts.boardSide ?? 0,
  set: parts.set ?? 0,
  cog: parts.cog ?? 0,
  parts: parts.parts ?? 0,
})

/** Out of shot during the finish: the visitor's own darts take over */
const DART_AWAY: Partial<DartPose> = { position: [0, -40, 20], rotation: [0, 0, -90], visible: 0 }

/** Flown off above the stage while the press clippings orbit their headline */
const DART_ABOVE: Partial<DartPose> = { position: [6, 24, -10], rotation: [14, 20, 150], visible: 0 }

const WIDE: Readonly<Record<ChapterId, ChapterMotion>> = {
  // The dart crosses the end of the headline: the words sit behind it
  'game-on': hold(pose({ dart: { position: [0.5, 5, 8], rotation: [14, 20, 105], scale: 1.45 } })),
  press: hold(pose({ dart: DART_ABOVE })),
  // Words on the right: the barrel close-up fills the left, its point towards the text
  grip: {
    from: pose({
      dart: { position: [-9, 0.4, 0], rotation: [10, -14, -90] },
      camera: { position: [-6, 1.6, 34], target: [-4.5, 0.3, 0] },
    }),
    to: pose({
      dart: { position: [-9, 0.4, 0], rotation: [10, -14, -90], spin: 160 },
      camera: { position: [-6, 0.8, 16], target: [-3.6, 0.3, 0] },
    }),
  },
  // Centred: the dart crosses the band between the title and the facts
  weight: {
    from: pose({
      dart: { position: [0, 0.6, 0], rotation: [8, -6, -90], scale: 1.2, spin: 160 },
      camera: { position: [0, 0, 50], target: [0, 0, 0] },
    }),
    to: pose({
      dart: { position: [0, 0.6, 0], rotation: [8, -6, -90], scale: 1.2, spin: 220 },
      camera: { position: [0, 0, 50], target: [0, 0, 0] },
      cog: 1,
    }),
  },
  // The diagonal between the split title's corners, point to the top right
  anatomy: {
    from: pose({
      dart: { position: [1.5, 0.3, 0], rotation: [8, 0, -58], spin: 220 },
      camera: { position: [0, 0, 66], target: [0, 0, 0] },
    }),
    to: pose({
      dart: { position: [1.5, 0.3, 0], rotation: [8, 0, -58], spin: 270, explode: 1 },
      camera: { position: [0, 0, 66], target: [0, 0, 0] },
      parts: 1,
      // The board waits off to the right: it slides in with the finish
      boardSide: 1,
    }),
  },
  // The board on the left, the panel on the right, its rim clear of the words (it covered the
  // first letters of the text by 17 to 39 px from 1024 to 1920 px wide, 2026-11-09)
  throw: hold(
    pose({
      dart: DART_AWAY,
      camera: { position: [17.5, 0, -20], target: [17.5, 0, -120] },
      board: 1,
    }),
  ),
  // The set of three, centred above the words; the board has left by the left, with the finish
  checkout: hold(pose({ dart: { position: [0, 7.4, 0], scale: 0.8 }, set: 1, boardSide: -1 })),
}

/**
 * The hero dart on a phone, point down to the left: how far it reaches from its centre of gravity
 * on screen, in centimetres per unit of scale (the point 5.9 cm away, the flight's end 9.6 cm, the
 * flight 3.6 cm wide), and the distance from the camera it rests at
 */
const HERO_REACH = { up: 5.3, down: 2.3, left: 5.5, right: 8.9 } as const
const HERO_DEPTH = 58
const HERO_ROTATION: Vec3 = [12, 16, 112]
const HERO_SCALE = { min: 0.5, max: 0.9 } as const
/** The share of the band the dart's height fills: the rest is air above and below it */
const HERO_FILL = 0.85

/**
 * A phone's hero text sits at the bottom of the screen, so the room above it changes with the
 * phone (from 12 % to 37 % of the screen's height): the dart is sized and placed in the band
 * between the masthead and the first line, never under the masthead's buttons (its flight sat under
 * the Sound button, 2026-11-09) nor over the words.
 */
export function narrowHero(band: ScreenBand): ChapterMotion {
  const half = halfHeightAt(HERO_DEPTH)
  const top = (0.5 - clamp01(band.top)) * 2 * half
  const bottom = (0.5 - clamp01(band.bottom)) * 2 * half
  const room = Math.max(0, top - bottom)
  const height = HERO_REACH.up + HERO_REACH.down
  const scale = Math.min(HERO_SCALE.max, Math.max(HERO_SCALE.min, (room * HERO_FILL) / height))
  // The dart's own height centred in the band, its width centred on the screen
  const y = (top + bottom) / 2 + ((HERO_REACH.down - HERO_REACH.up) / 2) * scale
  const x = ((HERO_REACH.left - HERO_REACH.right) / 2) * scale
  return hold(pose({ dart: { position: [x, y, 60 - HERO_DEPTH], rotation: HERO_ROTATION, scale } }))
}

/** Until the page has been measured: the band of a 390 × 844 phone */
export const DEFAULT_HERO_BAND: ScreenBand = { top: 0.09, bottom: 0.29 }

/**
 * On a phone, the top of the screen down to 38svh is kept for the object (layout.css): the
 * anatomy and the board are centred in it, between 10 % and 46 % of the screen's height.
 */
const NARROW_STAGE: ScreenBand = { top: 0.1, bottom: 0.46 }
const NARROW_STAGE_CENTRE = (NARROW_STAGE.top + NARROW_STAGE.bottom) / 2

/** The exploded dart reaches 8.1 cm towards its point and 13.4 cm towards its flight */
const ANATOMY_SCALE = 0.56
const ANATOMY_Y =
  (0.5 - NARROW_STAGE_CENTRE) * 2 * halfHeightAt(60) + ((13.4 - 8.1) / 2) * ANATOMY_SCALE

/** The board (45.2 cm across) as tall as the stage, its centre in the stage's middle */
const FINISH_DISTANCE = 22.6 / ((NARROW_STAGE.bottom - NARROW_STAGE.top) / 2) / 2 / halfHeightAt(1)
const FINISH_Y = -(0.5 - NARROW_STAGE_CENTRE) * 2 * halfHeightAt(FINISH_DISTANCE)

const NARROW: Readonly<Record<ChapterId, ChapterMotion>> = {
  'game-on': narrowHero(DEFAULT_HERO_BAND),
  press: hold(pose({ dart: DART_ABOVE })),
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
  // The band between the title (top) and the facts (bottom)
  weight: {
    from: pose({
      dart: { position: [0, 1.2, 0], rotation: [8, -6, -90], scale: 0.8, spin: 160 },
      camera: { position: [0, 0, 58], target: [0, 0, 0] },
    }),
    to: pose({
      dart: { position: [0, 1.2, 0], rotation: [8, -6, -90], scale: 0.8, spin: 220 },
      camera: { position: [0, 0, 58], target: [0, 0, 0] },
      cog: 1,
    }),
  },
  // Upright in the middle of the stage, its labels on both sides: above the title, which it crossed
  // when it stood at the bottom of the screen (2026-11-09)
  anatomy: {
    from: pose({
      dart: { position: [0, ANATOMY_Y - 0.6, 0], rotation: [0, 18, 0], scale: ANATOMY_SCALE },
    }),
    to: pose({
      dart: {
        position: [0, ANATOMY_Y, 0],
        rotation: [0, 18, 0],
        scale: ANATOMY_SCALE,
        spin: 50,
        explode: 1,
      },
      parts: 1,
      boardSide: 1,
    }),
  },
  // The whole board in the stage: clear of the masthead and of the chapter's label (it ran under
  // both, 2026-11-09)
  throw: hold(
    pose({
      dart: DART_AWAY,
      camera: {
        position: [0, FINISH_Y, BOARD_POSITION[2] + FINISH_DISTANCE],
        target: [0, FINISH_Y, BOARD_POSITION[2]],
      },
      board: 1,
    }),
  ),
  checkout: hold(pose({ dart: { position: [0, 8.2, 0], scale: 0.8 }, set: 1, boardSide: -1 })),
}

export const CHOREOGRAPHY: Readonly<Record<Layout, Readonly<Record<ChapterId, ChapterMotion>>>> = {
  wide: WIDE,
  narrow: NARROW,
}

/**
 * After the checkout, the set flies up and fades while the closing words scroll on: no dart is
 * left behind the text on the way to the footer.
 */
export const EXIT: Readonly<Record<Layout, ScenePose>> = {
  wide: pose({ dart: { position: [0, 26, -6], scale: 0.8, visible: 0 } }),
  narrow: pose({ dart: { position: [0, 24, -6], scale: 0.8, visible: 0 } }),
}

export interface Exit {
  readonly pose: ScenePose
  /** Scroll distance (px) over which the last pose gives way to the exit pose */
  readonly distance: number
}

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
  exit?: Exit,
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
    if (!next) {
      if (!exit || exit.distance <= 0) return motion.to
      const u = (scroll - range.end) / exit.distance
      return mixPose(motion.to, exit.pose, easeInOutCubic(clamp01(u)))
    }
    if (scroll < next.start) {
      const gap = next.start - range.end
      const u = gap > 0 ? (scroll - range.end) / gap : 1
      return mixPose(motion.to, motions[next.id].from, easeInOutCubic(clamp01(u)))
    }
  }
  const last = ranges[ranges.length - 1]
  return last ? motions[last.id].to : motions['game-on'].from
}
