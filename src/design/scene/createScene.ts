import { Vector3 } from 'three'
import type { Throw } from '../../logic/ThrowSession'
import { BOARD } from '../../rules/board'
import { BOARD_POSITION, type Layout } from '../../rules/choreography'
import type { QualitySettings } from '../../rules/quality'
import type { BoardPoint } from '../../rules/scoring'
import type { Clock } from '../../time/clock'
import { nextTask } from '../../time/nextTask'
import type { RandomSource } from '../../time/random'
import type { SoundEngine } from '../audio/SoundEngine'
import type { MarkerLayer } from '../dom/MarkerLayer'
import type { ThrowStage } from '../dom/ThrowPanel'
import { BoardModel } from './BoardModel'
import { DartFlight } from './DartFlight'
import { DartModel, drawFlightTexture, printFlight } from './DartModel'
import { SceneDirector, type ScreenCircle } from './SceneDirector'
import { SceneModels } from './SceneModels'
import { Stage } from './Stage'

export interface SceneOptions {
  /** The WebGL 2 context openStageContext gave, on the stage's canvas */
  readonly context: WebGL2RenderingContext
  readonly quality: QualitySettings
  readonly layout: Layout
  readonly clock: Clock
  readonly random: RandomSource
  readonly sound: SoundEngine
  readonly markers: MarkerLayer
  readonly motion: () => boolean
  readonly onProgress: (progress: number) => void
}

export interface SceneHandle extends ThrowStage {
  readonly director: SceneDirector
  /** Fades the canvas in and brings the dart on */
  reveal(): void
  boardCircle(): ScreenCircle | null
  /** The board point under a screen point, or null outside the board */
  boardPointAt(clientX: number, clientY: number): BoardPoint | null
  onRender(listener: () => void): void
  onContextLost(listener: () => void): void
}

/** Where the throwing hand is, in the camera's own space (right of and below the eye) */
const HAND = new Vector3(11, -13, -12)

/**
 * Builds the 3D scene step by step, one task per step (renderer, light, models, textures,
 * shaders), so no long task blocks the page. The model files download while the stage lights
 * up; a file that fails or is refused rejects the scene, and the page keeps its art without 3D.
 */
export async function createScene(options: SceneOptions): Promise<SceneHandle> {
  const { context, quality, clock, sound, markers, motion, onProgress } = options
  const loading = SceneModels.load(import.meta.env.BASE_URL, quality)
  // Awaited below; until then a failure must not count as unhandled
  loading.catch(() => undefined)
  const stage = new Stage(context, quality, clock)
  onProgress(0.45)
  await stage.light()
  onProgress(0.6)

  const models = await loading
  await nextTask()
  printFlight(models.dart.flight, await drawFlightTexture())
  const hero = new DartModel(models.dart)
  const set = [hero.clone(), hero.clone()]
  const thrown = [hero.clone(), hero.clone(), hero.clone()]
  for (const dart of thrown) dart.root.visible = false
  const board = new BoardModel(models.board)
  board.light(stage.scene.environment)
  board.root.position.set(...BOARD_POSITION)
  stage.scene.add(
    hero.root,
    board.root,
    ...set.map((dart) => dart.root),
    ...thrown.map((d) => d.root),
  )
  onProgress(0.75)

  // Each texture goes to the GPU in its own task, not all inside the first frame
  for (const texture of models.textures()) {
    await nextTask()
    stage.upload(texture)
  }
  await nextTask()
  await stage.compile()
  onProgress(0.9)

  const director = new SceneDirector({
    stage,
    hero,
    set,
    board,
    markers,
    clock,
    layout: options.layout,
    motion,
  })

  return {
    director,
    reveal() {
      stage.show()
      director.arrive()
    },
    throwDart(thrownDart: Throw, index: number): Promise<void> {
      return new Promise((resolve) => {
        const dart = thrown[index % thrown.length]
        if (!dart) {
          resolve()
          return
        }
        stage.camera.updateMatrixWorld()
        // A dart from an earlier visit may still be pinned in the board: it flies in the scene
        stage.scene.attach(dart.root)
        const from = stage.camera.localToWorld(HAND.clone())
        const to = board.toWorld(thrownDart.landing, new Vector3())
        sound.play('whoosh')
        const flight = new DartFlight(dart, {
          from,
          to,
          start: clock.now(),
          instant: !motion(),
          onLand: () => {
            sound.play(thrownDart.gameShot ? 'win' : 'thud')
            resolve()
          },
        })
        stage.play({
          step: (now) => {
            if (flight.step(now)) return true
            // Settled: pinned in the board, it leaves with it (it once floated in the air)
            dart.root.userData['keepLook'] = true
            board.root.attach(dart.root)
            return false
          },
        })
      })
    },
    collect() {
      for (const dart of thrown) dart.root.visible = false
      stage.requestRender()
    },
    boardCircle: () => director.boardCircle(),
    boardPointAt(clientX: number, clientY: number): BoardPoint | null {
      const hit = stage.pointOnPlane(clientX, clientY, board.facePlane(), new Vector3())
      if (!hit) return null
      const point = board.toBoardPoint(hit)
      return Math.hypot(point.x, point.y) <= BOARD.edge ? point : null
    },
    onRender(listener: () => void) {
      stage.onRender(listener)
    },
    onContextLost(listener: () => void) {
      stage.onContextLost(listener)
    },
  }
}
