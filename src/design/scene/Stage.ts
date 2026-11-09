import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  PMREMGenerator,
  PerspectiveCamera,
  type Plane,
  Raycaster,
  SRGBColorSpace,
  Scene,
  type Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import type { QualitySettings } from '../../rules/quality'
import type { Clock } from '../../time/clock'
import { nextTask } from '../../time/nextTask'
import type { ScreenPoint } from '../dom/MarkerLayer'

/** Something that moves over time; returns false once finished */
export interface Animation {
  step(now: number): boolean
}

/**
 * The WebGL stage: renderer, camera and lights, rendering only when something changed or moves
 * (no loop running for nothing), paused while the tab is hidden.
 */
export class Stage {
  readonly scene = new Scene()
  readonly camera = new PerspectiveCamera(30, 1, 1, 800)
  private readonly canvas: HTMLCanvasElement
  private readonly renderer: WebGLRenderer
  private readonly raycaster = new Raycaster()
  private readonly animations = new Set<Animation>()
  private readonly renderListeners = new Set<() => void>()
  private frame = 0
  private width = 0
  private height = 0

  /**
   * Draws with a context the page opened already (openStageContext): without WebGL 2 drawn by a
   * GPU, the page went on without 3D before loading three.js, which would have logged two console
   * errors before throwing.
   */
  constructor(
    context: WebGL2RenderingContext,
    private readonly quality: QualitySettings,
    private readonly clock: Clock,
  ) {
    const canvas = context.canvas
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('The stage draws on a canvas of the page')
    this.canvas = canvas
    this.renderer = new WebGLRenderer({ canvas, context, antialias: quality.antialias })
    this.renderer.outputColorSpace = SRGBColorSpace
    this.renderer.toneMapping = ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.setClearColor(0x000000, 0)
  }

  /** Lighting and reflections, one task each */
  async light(): Promise<void> {
    this.resize()
    await nextTask()
    // A neutral studio room reflected in the metal: no environment file to download
    const generator = new PMREMGenerator(this.renderer)
    this.scene.environment = generator.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, {
      size: 128,
    }).texture
    generator.dispose()
    this.scene.environmentIntensity = 0.85
    await nextTask()
    const key = new DirectionalLight(0xfff0dc, 2.4)
    key.position.set(-20, 30, 40)
    const rim = new DirectionalLight(0xffcfa8, 1.6)
    rim.position.set(30, -12, -24)
    this.scene.add(key, rim, new AmbientLight(0xffffff, 0.12))

    new ResizeObserver(() => {
      this.resize()
      this.requestRender()
    }).observe(this.canvas)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.requestRender()
    })
  }

  /** Shader programs compiled without blocking (KHR_parallel_shader_compile where available) */
  async compile(): Promise<void> {
    await this.renderer.compileAsync(this.scene, this.camera)
  }

  /** Uploads a texture to the GPU now, in its own task, rather than inside the next frame */
  upload(texture: Texture): void {
    this.renderer.initTexture(texture)
  }

  onContextLost(listener: () => void): void {
    this.canvas.addEventListener('webglcontextlost', listener)
  }

  /** Fades the canvas in (styles: .is-live) */
  show(): void {
    this.canvas.classList.add('is-live')
  }

  requestRender(): void {
    this.schedule()
  }

  play(animation: Animation): void {
    this.animations.add(animation)
    this.schedule()
  }

  stop(animation: Animation): void {
    this.animations.delete(animation)
  }

  onRender(listener: () => void): () => void {
    this.renderListeners.add(listener)
    return () => this.renderListeners.delete(listener)
  }

  /** A point of the scene on screen, in CSS pixels from the viewport's top left */
  project(world: Vector3): ScreenPoint {
    const point = world.clone().project(this.camera)
    return {
      x: ((point.x + 1) / 2) * this.width,
      y: ((1 - point.y) / 2) * this.height,
      visible: point.z > -1 && point.z < 1,
    }
  }

  /** Where a screen point meets a plane of the scene (the board's face), or null */
  pointOnPlane(clientX: number, clientY: number, plane: Plane, target: Vector3): Vector3 | null {
    const pointer = new Vector2(
      (clientX / this.width) * 2 - 1,
      -(clientY / this.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(pointer, this.camera)
    return this.raycaster.ray.intersectPlane(plane, target)
  }

  private schedule(): void {
    if (this.frame !== 0 || document.visibilityState === 'hidden') return
    this.frame = requestAnimationFrame(() => this.tick())
  }

  private tick(): void {
    this.frame = 0
    const now = this.clock.now()
    for (const animation of this.animations) {
      if (!animation.step(now)) this.animations.delete(animation)
    }
    this.renderer.render(this.scene, this.camera)
    for (const listener of this.renderListeners) listener()
    if (this.animations.size > 0) this.schedule()
  }

  private resize(): void {
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    if (width === this.width && height === this.height) return
    this.width = width
    this.height = height
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality.maxPixelRatio))
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    this.camera.updateProjectionMatrix()
  }
}

export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180

export const vector = (values: readonly [number, number, number]): Vector3 =>
  new Vector3(values[0], values[1], values[2])
