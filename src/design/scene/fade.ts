import type { Material, Mesh, Object3D } from 'three'

interface Look {
  readonly opacity: number
  readonly transparent: boolean
  readonly depthWrite: boolean
}

/** Each material's own look, recorded the first time it is faded */
const LOOKS = new WeakMap<Material, Look>()

function lookOf(material: Material): Look {
  const known = LOOKS.get(material)
  if (known) return known
  const look = {
    opacity: material.opacity,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
  }
  LOOKS.set(material, look)
  return look
}

/**
 * Fades a model in or out (0 to 1) instead of switching it off: it is hidden only once it is fully
 * transparent, so it never vanishes in one frame (the board leaving the finish, 2026-11-09). At 1
 * every material is back to its own look. Materials are read on every call, so a model whose
 * materials change (a texture drawn later, a loaded file) fades whole. Objects marked
 * `userData.keepLook` (darts pinned in the board, whose materials other darts share) keep theirs.
 */
export function fade(root: Object3D, presence: number): void {
  const amount = Math.min(1, Math.max(0, presence))
  root.visible = amount > 0.004
  if (!root.visible) return
  eachOwnMesh(root, (mesh) => {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      const look = lookOf(material)
      const faded = amount < 1
      material.transparent = faded || look.transparent
      material.depthWrite = faded ? false : look.depthWrite
      material.opacity = look.opacity * amount
    }
  })
}

/** The model's own meshes, without the objects that keep their look */
function eachOwnMesh(object: Object3D, visit: (mesh: Mesh) => void): void {
  if (object.userData['keepLook'] === true) return
  const mesh = object as Partial<Mesh>
  if (mesh.isMesh && mesh.material) visit(object as Mesh)
  for (const child of object.children) eachOwnMesh(child, visit)
}
