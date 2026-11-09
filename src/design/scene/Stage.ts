import {
  ACESFilmicToneMapping,
  AmbientLight,
  DirectionalLight,
  PCFShadowMap,
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
import { BOARD_POSITION } from '../../rules/choreography'
import type { QualitySettings } from '../../rules/quality'
import type { Clock } from '../../time/clock'
import { nextTask } from '../../time/nextTask'
import type { ScreenPoint } from '../dom/MarkerLayer'

/** Anisotropic filtering of the model textures, at most (what the GPU allows, if less) */
const MAX_ANISOTROPY = 8

/** Where the key light comes from, from whatever it lights (centimetres) */
const KEY_DIRECTION = [-20, 30, 40] as const
/** Half the side of the square its shadow covers: the board and the darts standing in it */
const SHADOW_HALF_SIDE = 27
/** How much of the key light a dart's shadow takes away */
const SHADOW_STRENGTH = 0.7

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
    if (!(canvas instanceof HTMLCanvasElement))
      throw new Error('The stage draws on a canvas of the page')
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
    // The key light keeps its direction; it stands off the board, so its shadow camera frames the
    // face and thrown darts drop their shadow on the sisal (nothing else takes shadows)
    const key = new DirectionalLight(0xfff0dc, 2.4)
    const [bx, by, bz] = BOARD_POSITION
    key.target.position.set(bx, by, bz)
    key.position.set(bx + KEY_DIRECTION[0], by + KEY_DIRECTION[1], bz + KEY_DIRECTION[2])
    if (this.quality.shadows) {
      this.renderer.shadowMap.enabled = true
      this.renderer.shadowMap.type = PCFShadowMap
      key.castShadow = true
      key.shadow.mapSize.set(1024, 1024)
      const box = key.shadow.camera
      box.left = -SHADOW_HALF_SIDE
      box.right = SHADOW_HALF_SIDE
      box.top = SHADOW_HALF_SIDE
      box.bottom = -SHADOW_HALF_SIDE
      box.near = 10
      box.far = 110
      key.shadow.bias = -0.0004
      key.shadow.normalBias = 0.02
      key.shadow.radius = 3
      // A room's fill light still reaches the shade: a shadow is never black
      key.shadow.intensity = SHADOW_STRENGTH
    }
    const rim = new DirectionalLight(0xffcfa8, 1.6)
    rim.position.set(30, -12, -24)
    this.scene.add(key, key.target, rim, new AmbientLight(0xffffff, 0.12))

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

  /**
   * Uploads a texture to the GPU now, in its own task, rather than inside the next frame, with
   * anisotropic filtering: the barrel's rings and the board's fibres stay sharp at a slant
   */
  upload(texture: Texture): void {
    texture.anisotropy = Math.min(MAX_ANISOTROPY, this.renderer.capabilities.getMaxAnisotropy())
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
    const pointer = new Vector2((clientX / this.width) * 2 - 1, -(clientY / this.height) * 2 + 1)
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
