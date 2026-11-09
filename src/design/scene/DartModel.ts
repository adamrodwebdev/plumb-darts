import {
  CanvasTexture,
  Group,
  type Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  type Vector3,
} from 'three'
import { type DartPart, EXPLODE_OFFSETS, PART_ANCHORS } from '../../rules/dartProfile'
import { METRES_TO_SCENE } from '../../rules/models'
import type { DartNodes } from './SceneModels'
import { toRadians } from './Stage'

/**
 * The flight print: brand orange, the wordmark along the wing, a fine edge. Drawn by the page in
 * the brand's face, the same in every language: "Plumb Brand" where the page sets its headlines in
 * another face (Russian), "Plumb Hero" otherwise. Laid out for the model's flight UVs: u across the
 * wing from the root, v along it with the front at the top of the canvas (glTF puts v = 0 at the
 * top: no flip). The wordmark runs from the front of the wing to its back, letters standing towards
 * the wing's tip: it reads left to right when the dart points left, as on the hero.
 */
const BRAND_FACES = '"Plumb Brand", "Plumb Hero"'

export async function drawFlightTexture(): Promise<CanvasTexture> {
  await document.fonts.load(`800 96px ${BRAND_FACES}`, 'PLUMB').catch(() => [])
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 256, 512)
    gradient.addColorStop(0, '#ff7451')
    gradient.addColorStop(1, '#e8411f')
    context.fillStyle = gradient
    context.fillRect(0, 0, 256, 512)
    context.save()
    context.translate(150, 300)
    context.rotate(Math.PI / 2)
    context.fillStyle = '#16100d'
    context.font = `800 104px ${BRAND_FACES}, "Arial Narrow", sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('PLUMB', 0, 0)
    context.restore()
    context.strokeStyle = 'rgb(255 255 255 / 0.55)'
    context.lineWidth = 6
    context.strokeRect(3, 3, 250, 506)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  return texture
}

/** Puts the brand's print on the flight (every clone shares its material) */
export function printFlight(flight: Mesh, print: CanvasTexture): void {
  const material = flight.material
  if (!(material instanceof MeshStandardMaterial)) return
  material.map?.dispose()
  material.map = print
  material.needsUpdate = true
}

/**
 * One Plumb dart, from the model file's four parts on one axis (+Y, point first, origin at the
 * centre of gravity). The root takes the pose; an inner group spins it around its own axis; each
 * part slides along the axis for the exploded view. The file's meshes are in metres and keep
 * their own transforms inside a scaled holder: only the holders move.
 */
export class DartModel {
  readonly root = new Group()
  private readonly spinner = new Group()
  private readonly sliders: Readonly<Record<DartPart, Group>>

  constructor(private readonly parts: DartNodes) {
    const slider = (part: DartPart): Group => {
      // Its shadow falls on the board once thrown (clones copy the flag)
      parts[part].castShadow = true
      const metres = new Group()
      metres.scale.setScalar(METRES_TO_SCENE)
      metres.add(parts[part])
      return new Group().add(metres)
    }
    this.sliders = {
      tip: slider('tip'),
      barrel: slider('barrel'),
      shaft: slider('shaft'),
      flight: slider('flight'),
    }
    this.spinner.add(this.sliders.tip, this.sliders.barrel, this.sliders.shaft, this.sliders.flight)
    this.root.add(this.spinner)
  }

  setSpin(degrees: number): void {
    this.spinner.rotation.y = toRadians(degrees)
  }

  setExplode(amount: number): void {
    for (const part of Object.keys(this.sliders) as DartPart[]) {
      this.sliders[part].position.y = EXPLODE_OFFSETS[part] * amount
    }
  }

  /** A part's label point in world space (on the axis: steady while the dart spins) */
  anchorWorld(part: DartPart, target: Vector3): Vector3 {
    const [x, y, z] = PART_ANCHORS[part]
    return this.sliders[part].localToWorld(target.set(x, y, z))
  }

  centreWorld(target: Vector3): Vector3 {
    return this.root.localToWorld(target.set(0, 0, 0))
  }

  /** Another dart sharing the same geometry and materials (no new GPU buffers) */
  clone(): DartModel {
    return new DartModel({
      tip: this.parts.tip.clone(),
      barrel: this.parts.barrel.clone(),
      shaft: this.parts.shaft.clone(),
      flight: this.parts.flight.clone(),
    })
  }
}
