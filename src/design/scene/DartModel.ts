import {
  type BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Group,
  LatheGeometry,
  type Material,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  Vector2,
  type Vector3,
} from 'three'
import {
  BAND_PROFILE,
  type DartPart,
  EXPLODE_OFFSETS,
  FLIGHT_WING,
  PART_ANCHORS,
  type ProfilePoint,
  SHAFT_PROFILE,
  TIP_PROFILE,
  barrelProfile,
} from '../../rules/dartProfile'
import { toRadians } from './Stage'

/** The brand orange of the flights and the barrel's band: a product colour, the same in both themes */
export const BRAND_ORANGE = '#ff5a36'

export interface DartMaterials {
  readonly tungsten: Material
  readonly steel: Material
  readonly band: Material
  readonly shaft: Material
  readonly flight: Material
}

export interface DartGeometries {
  readonly tip: BufferGeometry
  readonly barrel: BufferGeometry
  readonly band: BufferGeometry
  readonly shaft: BufferGeometry
  readonly wing: BufferGeometry
}

const lathe = (profile: readonly ProfilePoint[], segments: number): BufferGeometry =>
  new LatheGeometry(
    profile.map(([radius, y]) => new Vector2(radius, y)),
    segments,
  )

/** A flight's wing, its UVs spread over the shape so the print covers it */
function wingGeometry(): BufferGeometry {
  const geometry = new ShapeGeometry(new Shape(FLIGHT_WING.map(([u, v]) => new Vector2(u, v))))
  geometry.computeBoundingBox()
  const box = geometry.boundingBox
  const uv = geometry.getAttribute('uv')
  const position = geometry.getAttribute('position')
  if (box) {
    for (let index = 0; index < uv.count; index += 1) {
      uv.setXY(
        index,
        (position.getX(index) - box.min.x) / (box.max.x - box.min.x),
        (position.getY(index) - box.min.y) / (box.max.y - box.min.y),
      )
    }
  }
  return geometry
}

export function buildDartGeometries(radialSegments: number): DartGeometries {
  return {
    tip: lathe(TIP_PROFILE, radialSegments),
    barrel: lathe(barrelProfile(), radialSegments),
    band: lathe(BAND_PROFILE, radialSegments),
    shaft: lathe(SHAFT_PROFILE, Math.max(24, radialSegments / 2)),
    wing: wingGeometry(),
  }
}

/** The flight print: brand orange, the wordmark along the wing, a fine edge */
export async function drawFlightTexture(): Promise<CanvasTexture> {
  await document.fonts.load('800 96px "Plumb Hero"').catch(() => [])
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
    context.translate(150, 256)
    context.rotate(-Math.PI / 2)
    context.fillStyle = '#16100d'
    context.font = '800 104px "Plumb Hero", "Arial Narrow", sans-serif'
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
  texture.anisotropy = 4
  return texture
}

export function createDartMaterials(flight: CanvasTexture): DartMaterials {
  return {
    tungsten: new MeshStandardMaterial({ color: 0x9da1a7, metalness: 1, roughness: 0.3 }),
    steel: new MeshStandardMaterial({ color: 0xdadde1, metalness: 1, roughness: 0.16 }),
    band: new MeshStandardMaterial({ color: BRAND_ORANGE, metalness: 0.55, roughness: 0.32 }),
    shaft: new MeshStandardMaterial({ color: 0x17181b, metalness: 0.7, roughness: 0.34 }),
    flight: new MeshStandardMaterial({ map: flight, side: DoubleSide, roughness: 0.55 }),
  }
}

/**
 * One Plumb dart: four parts on one axis (+Y, tip first, origin at the centre of gravity). The
 * root takes the pose; an inner group spins it around its own axis; each part can slide along
 * the axis for the exploded view.
 */
export class DartModel {
  readonly root = new Group()
  private readonly spinner = new Group()
  private readonly parts: Readonly<Record<DartPart, Group>>

  constructor(
    private readonly geometries: DartGeometries,
    private readonly materials: DartMaterials,
  ) {
    const parts = { tip: new Group(), barrel: new Group(), shaft: new Group(), flight: new Group() }
    parts.tip.add(new Mesh(geometries.tip, materials.steel))
    parts.barrel.add(
      new Mesh(geometries.barrel, materials.tungsten),
      new Mesh(geometries.band, materials.band),
    )
    parts.shaft.add(new Mesh(geometries.shaft, materials.shaft))
    for (let wing = 0; wing < 4; wing += 1) {
      const mesh = new Mesh(geometries.wing, materials.flight)
      mesh.rotation.y = (wing * Math.PI) / 2
      parts.flight.add(mesh)
    }
    this.parts = parts
    this.spinner.add(parts.tip, parts.barrel, parts.shaft, parts.flight)
    this.root.add(this.spinner)
  }

  setSpin(degrees: number): void {
    this.spinner.rotation.y = toRadians(degrees)
  }

  setExplode(amount: number): void {
    for (const part of Object.keys(this.parts) as DartPart[]) {
      this.parts[part].position.y = EXPLODE_OFFSETS[part] * amount
    }
  }

  /** A part's label point in world space (on the axis: steady while the dart spins) */
  anchorWorld(part: DartPart, target: Vector3): Vector3 {
    const [x, y, z] = PART_ANCHORS[part]
    return this.parts[part].localToWorld(target.set(x, y, z))
  }

  centreWorld(target: Vector3): Vector3 {
    return this.root.localToWorld(target.set(0, 0, 0))
  }

  /** Another dart sharing the same geometry and materials (no new GPU buffers) */
  clone(): DartModel {
    return new DartModel(this.geometries, this.materials)
  }
}
