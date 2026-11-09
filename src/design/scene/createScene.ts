import { Vector3 } from 'three'
import type { Throw } from '../../logic/ThrowSession'
import { BOARD } from '../../rules/board'
import { BOARD_POSITION, type Layout } from '../../rules/choreography'
import type { QualitySettings } from '../../rules/quality'
import type { BoardPoint } from '../../rules/scoring'
import type { Clock } from '../../time/clock'
import { nextTask } from '../../time/nextTask'
import { type RandomSource, SeededRandom } from '../../time/random'
import type { SoundEngine } from '../audio/SoundEngine'
import type { MarkerLayer } from '../dom/MarkerLayer'
import type { ThrowStage } from '../dom/ThrowPanel'
import { BoardModel } from './BoardModel'
import { drawBoardFace } from './boardFace'
import { DartFlight } from './DartFlight'
import { DartModel, buildDartGeometries, createDartMaterials, drawFlightTexture } from './DartModel'
import { SceneDirector, type ScreenCircle } from './SceneDirector'
import { Stage } from './Stage'

export interface SceneOptions {
  readonly canvas: HTMLCanvasElement
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

function drawFaceHere(size: number, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) drawBoardFace(context, size, new SeededRandom(seed))
  return canvas
}

/** The board face, drawn in a worker when the browser can (no long task on the page) */
function drawFace(size: number, seed: number): Promise<ImageBitmap | HTMLCanvasElement | null> {
  if (typeof OffscreenCanvas === 'undefined') return Promise.resolve(drawFaceHere(size, seed))
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./boardFace.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<unknown>) => {
      worker.terminate()
      resolve(event.data instanceof ImageBitmap ? event.data : null)
    }
    worker.onerror = () => {
      worker.terminate()
      resolve(drawFaceHere(size, seed))
    }
    worker.postMessage({ size, seed })
  })
}

/**
 * Builds the 3D scene step by step, one task per step (renderer, light, models, shaders), so
 * no long task blocks the page. Throws when WebGL is unavailable.
 */
export async function createScene(options: SceneOptions): Promise<SceneHandle> {
  const { canvas, quality, clock, sound, markers, motion, onProgress } = options
  const stage = new Stage(canvas, quality, clock)
  onProgress(0.45)
  await stage.light()
  onProgress(0.6)

  await nextTask()
  const geometries = buildDartGeometries(quality.radialSegments)
  const materials = createDartMaterials(await drawFlightTexture())
  const hero = new DartModel(geometries, materials)
  const set = [hero.clone(), hero.clone()]
  const thrown = [hero.clone(), hero.clone(), hero.clone()]
  for (const dart of thrown) dart.root.visible = false
  const board = new BoardModel()
  board.root.position.set(...BOARD_POSITION)
  stage.scene.add(hero.root, board.root, ...set.map((dart) => dart.root), ...thrown.map((d) => d.root))
  onProgress(0.75)

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

  void drawFace(quality.boardTexture, Math.floor(options.random.next() * 2 ** 31)).then(
    async (image) => {
      if (!image) return
      const texture = board.setFace(image)
      await nextTask()
      stage.upload(texture)
      stage.requestRender()
    },
  )

  return {
    director,
    reveal() {
      canvas.classList.add('is-live')
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
        const from = stage.camera.localToWorld(HAND.clone())
        const to = board.toWorld(thrownDart.landing, new Vector3())
        sound.play('whoosh')
        stage.play(
          new DartFlight(dart, {
            from,
            to,
            start: clock.now(),
            instant: !motion(),
            onLand: () => {
              sound.play(thrownDart.gameShot ? 'win' : 'thud')
              resolve()
            },
          }),
        )
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
