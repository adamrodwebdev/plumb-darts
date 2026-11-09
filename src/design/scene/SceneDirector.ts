import { Vector3 } from 'three'
import { BOARD } from '../../rules/board'
import type { ChapterId } from '../../rules/chapters'
import {
  ARRIVAL_OFFSET,
  BOARD_POSITION,
  CHOREOGRAPHY,
  type ChapterRange,
  EXIT,
  type Layout,
  narrowHero,
  poseAt,
  type ScreenBand,
} from '../../rules/choreography'
import type { DartPart } from '../../rules/dartProfile'
import { clamp01, easeOutQuart } from '../../rules/easing'
import type { ChapterMotion, ScenePose } from '../../rules/pose'
import type { Clock } from '../../time/clock'
import type { MarkerLayer, ScreenPoint } from '../dom/MarkerLayer'
import type { BoardModel } from './BoardModel'
import { fade } from './fade'
import type { DartModel } from './DartModel'
import { type Animation, type Stage, toRadians } from './Stage'

const PARTS: readonly DartPart[] = ['tip', 'barrel', 'shaft', 'flight']
/** Chapters where the dart lives on its own (a slow turn and float) between scrolls */
const IDLE_CHAPTERS: ReadonlySet<ChapterId> = new Set(['game-on', 'checkout'])
const IDLE_DEGREES_PER_MS = 0.014
const ARRIVAL_MS = 1500
/** How far sideways the board travels on its way in or out of the finish (centimetres) */
const BOARD_TRAVEL = 160
/** The board fades over the last part of its way out (its presence below this) */
const BOARD_FADE = 0.3

export interface DirectorParts {
  readonly stage: Stage
  readonly hero: DartModel
  /** The two other darts of the set, shown in the finale */
  readonly set: readonly DartModel[]
  readonly board: BoardModel
  readonly markers: MarkerLayer
  readonly clock: Clock
  readonly layout: Layout
  readonly motion: () => boolean
}

export interface ScreenCircle {
  readonly cx: number
  readonly cy: number
  readonly r: number
}

/**
 * Turns the story's position (smoothed scroll, or the chapter on screen under reduced motion)
 * into the scene's pose, and keeps the labels pinned to the model.
 */
export class SceneDirector {
  private layout: Layout
  private motions: Readonly<Record<ChapterId, ChapterMotion>>
  private heroBand: ScreenBand | null = null
  private ranges: readonly ChapterRange[] = []
  private exitDistance = 0
  private scroll: number | null = null
  /** Reduced motion: the closing dusk is on screen and the dart is gone */
  private exited = false
  private chapter: ChapterId = 'game-on'
  private pose: ScenePose
  private idleSpin = 0
  private idleTime = 0
  private arrival = 1
  private idleRunning = false
  private markersShown = true
  private readonly scratch = new Vector3()

  constructor(private readonly parts: DirectorParts) {
    this.layout = parts.layout
    this.motions = this.motionsFor(this.layout)
    this.pose = this.motions['game-on'].from
    parts.stage.onRender(() => this.placeMarkers())
  }

  setLayout(layout: Layout): void {
    this.layout = layout
    this.motions = this.motionsFor(layout)
    this.repose()
  }

  /** The room a phone's hero leaves above its text (fractions of the screen's height) */
  setHeroBand(band: ScreenBand): void {
    this.heroBand = band
    this.motions = this.motionsFor(this.layout)
    this.repose()
  }

  /** Chapter ranges, and the scroll distance over which the set leaves after the last one */
  setRanges(ranges: readonly ChapterRange[], exitDistance: number): void {
    this.ranges = ranges
    this.exitDistance = exitDistance
  }

  /** Scroll-driven mode: the pose follows the smoothed scroll position */
  setScroll(scroll: number): void {
    this.scroll = scroll
    this.pose = poseAt(scroll, this.ranges, this.motions, {
      pose: EXIT[this.layout],
      distance: this.exitDistance,
    })
    this.apply()
  }

  /** Reduced motion: past the last chapter, the dart is simply gone (no flight) */
  showExit(): void {
    this.exited = true
    this.pose = EXIT[this.layout]
    this.apply()
  }

  /** Reduced motion: each chapter shows its resting pose, without travelling between them */
  showChapter(chapter: ChapterId): void {
    this.exited = false
    this.pose = this.motions[chapter].to
    this.apply()
  }

  setChapter(chapter: ChapterId): void {
    this.chapter = chapter
    if (!this.ranges.length) this.showChapter(chapter)
    this.startIdle()
  }

  /** The dart arrives from off screen, the first time the scene appears */
  arrive(): void {
    if (!this.parts.motion()) {
      this.apply()
      return
    }
    const start = this.parts.clock.now()
    this.arrival = 0
    const animation: Animation = {
      step: (now) => {
        this.arrival = easeOutQuart(clamp01((now - start) / ARRIVAL_MS))
        this.apply()
        return this.arrival < 1
      },
    }
    this.parts.stage.play(animation)
  }

  /** The board's face on screen, while the finish chapter shows it */
  boardCircle(): ScreenCircle | null {
    if (this.chapter !== 'throw' || this.pose.board < 0.98) return null
    const { board, stage } = this.parts
    const centre = stage.project(board.toWorld({ x: 0, y: 0 }, this.scratch))
    const edge = stage.project(board.toWorld({ x: BOARD.edge, y: 0 }, this.scratch))
    if (!centre.visible) return null
    return { cx: centre.x, cy: centre.y, r: Math.hypot(edge.x - centre.x, edge.y - centre.y) }
  }

  /** The pose again, once the poses themselves changed (a new layout, a measured hero band) */
  private repose(): void {
    if (this.ranges.length && this.scroll !== null) {
      this.setScroll(this.scroll)
      return
    }
    this.pose = this.exited ? EXIT[this.layout] : this.motions[this.chapter].to
    this.apply()
  }

  private motionsFor(layout: Layout): Readonly<Record<ChapterId, ChapterMotion>> {
    const motions = CHOREOGRAPHY[layout]
    return layout === 'narrow' && this.heroBand
      ? { ...motions, 'game-on': narrowHero(this.heroBand) }
      : motions
  }

  private startIdle(): void {
    if (this.idleRunning || !IDLE_CHAPTERS.has(this.chapter) || !this.parts.motion()) return
    this.idleRunning = true
    let last = this.parts.clock.now()
    this.parts.stage.play({
      step: (now) => {
        const elapsed = Math.min(64, now - last)
        last = now
        this.idleSpin = (this.idleSpin + elapsed * IDLE_DEGREES_PER_MS) % 360
        this.idleTime += elapsed
        this.apply()
        this.idleRunning = IDLE_CHAPTERS.has(this.chapter) && this.parts.motion()
        return this.idleRunning
      },
    })
  }

  private apply(): void {
    const { hero, set, board, stage } = this.parts
    const { dart, camera } = this.pose
    const away = 1 - this.arrival
    const from = ARRIVAL_OFFSET[this.layout]
    const float = IDLE_CHAPTERS.has(this.chapter) ? Math.sin(this.idleTime / 900) * 0.18 : 0

    hero.root.visible = dart.visible > 0.02
    hero.root.position.set(
      dart.position[0] + away * from[0],
      dart.position[1] + away * from[1] + float,
      dart.position[2] + away * from[2],
    )
    hero.root.rotation.set(
      toRadians(dart.rotation[0]),
      toRadians(dart.rotation[1]),
      toRadians(dart.rotation[2] + away * 70),
      'XYZ',
    )
    hero.root.scale.setScalar(dart.scale * Math.max(0.001, dart.visible))
    hero.setSpin(dart.spin + this.idleSpin + away * 540)
    hero.setExplode(dart.explode)

    stage.camera.position.set(...camera.position)
    stage.camera.lookAt(...camera.target)

    // The board travels with the story: in from the right before the finish, out by the left after
    // it, receding as it goes; it fades only on its way out of shot, so it never vanishes in one
    // frame (a semi-transparent board shows its own parts through each other)
    const gone = 1 - this.pose.board
    fade(board.root, clamp01(this.pose.board / BOARD_FADE))
    board.root.position.set(
      BOARD_POSITION[0] + this.pose.boardSide * BOARD_TRAVEL * gone,
      BOARD_POSITION[1],
      BOARD_POSITION[2] - gone * 90,
    )

    set.forEach((other, index) => {
      const side = index === 0 ? -1 : 1
      const shown = this.pose.set * dart.visible
      other.root.visible = shown > 0.02
      other.root.position.set(
        hero.root.position.x + side * 3.6 * dart.scale * shown,
        hero.root.position.y - 0.5 * shown,
        hero.root.position.z - 2 * shown,
      )
      other.root.rotation.set(
        hero.root.rotation.x,
        hero.root.rotation.y,
        hero.root.rotation.z + toRadians(side * 14 * shown),
      )
      other.root.scale.setScalar(dart.scale * Math.max(0.001, shown))
      other.setSpin(dart.spin + this.idleSpin + 120 * (index + 1))
    })

    stage.requestRender()
  }

  private placeMarkers(): void {
    const { hero, stage, markers } = this.parts
    if (this.pose.cog < 0.02 && this.pose.parts < 0.02) {
      // Hidden once, not rewritten on every frame of the idle turn
      if (this.markersShown) markers.hideAll()
      this.markersShown = false
      return
    }
    this.markersShown = true
    hero.root.updateWorldMatrix(true, true)
    const points = new Map<string, ScreenPoint>()
    points.set('cog', stage.project(hero.centreWorld(this.scratch)))
    for (const part of PARTS) points.set(part, stage.project(hero.anchorWorld(part, this.scratch)))
    markers.update(points, { cog: this.pose.cog, parts: this.pose.parts })
  }
}
