import {
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Plane,
  Quaternion,
  type Texture,
  Vector3,
} from 'three'
import { BOARD } from '../../rules/board'
import { METRES_TO_SCENE } from '../../rules/models'
import type { BoardPoint } from '../../rules/scoring'

/** Board units: the scene is in centimetres, the rules in millimetres */
const MM = 0.1
const RADIUS = BOARD.edge * MM

/**
 * How much of the studio's reflected light the sisal takes. The room that gives the metal its
 * reflections lit the matt fibre at nearly four times its colour: the cream glowed white and the
 * red and green went pastel. At this share the key light models it, its colours stay deep and
 * its fibre shows, as under a board light.
 */
const FACE_AMBIENT = 0.3

/**
 * The dartboard from its model file: a bristle face with the wire spider and number ring, facing
 * +Z, the 20 up, the bull at the origin. The file is in metres, at the scoring rules' radii (it is
 * checked on loading), so a board point in millimetres lands in the bed its score names.
 */
export class BoardModel {
  readonly root = new Group()
  private readonly plane = new Plane()

  constructor(private readonly board: Object3D) {
    const metres = new Group()
    metres.scale.setScalar(METRES_TO_SCENE)
    metres.add(board)
    this.root.add(metres)
  }

  /**
   * Lights the face with its share of the studio's environment (wires and numbers keep it all).
   * The face holds the map itself: three gives a material without one the scene's intensity.
   */
  light(environment: Texture | null): void {
    const face = this.board.getObjectByName('face')
    if (!(face instanceof Mesh) || !(face.material instanceof MeshStandardMaterial)) return
    face.material.envMap = environment
    face.material.envMapIntensity = FACE_AMBIENT
    face.material.needsUpdate = true
    // Thrown darts drop their shadow on the sisal (where the quality tier keeps shadows)
    face.receiveShadow = true
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
