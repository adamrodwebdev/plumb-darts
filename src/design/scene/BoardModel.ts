import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Plane,
  Quaternion,
  SRGBColorSpace,
  Texture,
  Vector3,
} from 'three'
import { BOARD } from '../../rules/board'
import type { BoardPoint } from '../../rules/scoring'

/** Board units: the scene is in centimetres, the rules in millimetres */
const MM = 0.1
const RADIUS = BOARD.edge * MM
const DEPTH = 3.8

/** The dartboard: a sisal face on a black body, facing +Z. Its face is drawn in a worker. */
export class BoardModel {
  readonly root = new Group()
  private readonly faceMaterial = new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.92 })
  private readonly plane = new Plane()

  constructor() {
    const body = new Mesh(
      new CylinderGeometry(RADIUS, RADIUS, DEPTH, 96, 1, true),
      new MeshStandardMaterial({ color: 0x0e0e0f, roughness: 0.7, metalness: 0.2 }),
    )
    body.rotation.x = Math.PI / 2
    body.position.z = -DEPTH / 2
    const face = new Mesh(new CircleGeometry(RADIUS, 160), this.faceMaterial)
    this.root.add(body, face)
  }

  /** Puts the drawn face on the board (the bitmap reads upside down: uploaded unflipped) */
  setFace(image: ImageBitmap | HTMLCanvasElement): Texture {
    const texture = new Texture(image)
    texture.flipY = false
    texture.colorSpace = SRGBColorSpace
    texture.anisotropy = 8
    texture.needsUpdate = true
    this.faceMaterial.map = texture
    this.faceMaterial.color.set(0xffffff)
    this.faceMaterial.needsUpdate = true
    return texture
  }

  /** The face's plane in world space (for aiming with a pointer) */
  facePlane(): Plane {
    this.root.updateWorldMatrix(true, false)
    const normal = new Vector3(0, 0, 1).applyQuaternion(
      this.root.getWorldQuaternion(new Quaternion()),
    )
    return this.plane.setFromNormalAndCoplanarPoint(
      normal,
      this.root.getWorldPosition(new Vector3()),
    )
  }

  /** A world point on the face, in board millimetres (origin at the bull, y up) */
  toBoardPoint(world: Vector3): BoardPoint {
    const local = this.root.worldToLocal(world.clone())
    return { x: local.x / MM, y: local.y / MM }
  }

  /** A board point (millimetres) as a world point on the face, `depth` cm into it */
  toWorld(point: BoardPoint, target: Vector3, depth = 0): Vector3 {
    return this.root.localToWorld(target.set(point.x * MM, point.y * MM, -depth))
  }

  /** The face's edge radius in world units */
  radius(): number {
    return RADIUS * this.root.scale.x
  }
}
