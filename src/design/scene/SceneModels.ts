import { Box3, Mesh, MeshStandardMaterial, type Object3D, type Texture } from 'three'
import type { DartPart } from '../../rules/dartProfile'
import { readGlbLayout } from '../../rules/glb'
import { InvalidInput, parseNumber, readNumber } from '../../rules/input'
import {
  BOARD_NODES,
  type BoardNode,
  DART_FILE,
  DART_NODES,
  MODEL_LIMITS,
  type ModelFile,
  boardFile,
  boardFits,
  dartFits,
} from '../../rules/models'
import type { QualitySettings } from '../../rules/quality'

export type DartNodes = Readonly<Record<DartPart, Mesh>>
export type BoardNodes = Readonly<Record<BoardNode, Mesh>>

/** A model file the scene cannot draw as it should: the page goes on without 3D */
export class ModelError extends Error {
  override readonly name = 'ModelError'
}

/** The material maps a texture can sit in */
const TEXTURE_SLOTS = [
  'map',
  'normalMap',
  'roughnessMap',
  'metalnessMap',
  'aoMap',
  'emissiveMap',
] as const

const BYTE_COUNT = { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true } as const
const TEXTURE_SIDE = { min: 1, max: MODEL_LIMITS.textureSize, integer: true } as const

/**
 * A file's bytes, refused as soon as they pass its limit: the declared length is read strictly
 * first, then the body is counted while it arrives, never buffered past the limit.
 */
async function download(base: string, file: ModelFile): Promise<ArrayBuffer> {
  const response = await fetch(`${base}${file.path}`)
  if (!response.ok) throw new ModelError(`${file.path}: HTTP ${response.status}`)
  const declared = response.headers.get('content-length')
  if (declared !== null && parseNumber(declared, BYTE_COUNT, file.path) > file.maxBytes) {
    throw new InvalidInput(file.path, 'too-long')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new ModelError(`${file.path}: no body`)
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > file.maxBytes) {
      await reader.cancel()
      throw new InvalidInput(file.path, 'too-long')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  readGlbLayout(bytes.buffer, file.maxBytes, file.path)
  return bytes.buffer
}

/** The named meshes a file must hold, each with a standard (metal-rough) material */
function meshes<K extends string>(
  root: Object3D,
  names: readonly K[],
  file: string,
): Readonly<Record<K, Mesh>> {
  const found = new Map<K, Mesh>()
  for (const name of names) {
    const node = root.getObjectByName(name)
    if (!(node instanceof Mesh) || !(node.material instanceof MeshStandardMaterial)) {
      throw new ModelError(`${file}: no mesh "${name}" with a standard material`)
    }
    found.set(name, node)
  }
  return Object.fromEntries(found) as Record<K, Mesh>
}

function texturesOf(nodes: readonly Mesh[]): Texture[] {
  const textures = new Set<Texture>()
  for (const node of nodes) {
    const material = node.material
    if (!(material instanceof MeshStandardMaterial)) continue
    for (const slot of TEXTURE_SLOTS) {
      const texture = material[slot]
      if (texture) textures.add(texture)
    }
  }
  return [...textures]
}

/**
 * The maps a material must have once parsed. GLTFLoader goes on without a texture it could not
 * decode (it only logs it): a dart without its machining would be drawn half made.
 */
function requireMaps(
  nodes: readonly Mesh[],
  slots: readonly (typeof TEXTURE_SLOTS)[number][],
  file: string,
): void {
  for (const node of nodes) {
    const material = node.material
    if (!(material instanceof MeshStandardMaterial) || slots.some((slot) => !material[slot])) {
      throw new ModelError(`${file}: "${node.name}" lost one of its maps`)
    }
  }
}

/** What the file may hold: a vertex budget, a few textures of bounded size */
function checkLimits(nodes: readonly Mesh[], file: string): void {
  const vertices = nodes.reduce(
    (sum, node) => sum + (node.geometry.getAttribute('position')?.count ?? 0),
    0,
  )
  if (vertices === 0 || vertices > MODEL_LIMITS.vertices)
    throw new ModelError(`${file}: ${vertices} vertices`)
  const textures = texturesOf(nodes)
  if (textures.length > MODEL_LIMITS.textures)
    throw new ModelError(`${file}: ${textures.length} textures`)
  for (const texture of textures) {
    const image: unknown = texture.image
    const size =
      image !== null && typeof image === 'object' ? (image as Record<string, unknown>) : {}
    readNumber(size['width'], TEXTURE_SIDE, `${file} texture width`)
    readNumber(size['height'], TEXTURE_SIDE, `${file} texture height`)
  }
}

/**
 * The scene's two model files, downloaded together, checked at the door and parsed: the dart's
 * four parts and the board. A file that is missing, too large, damaged, without one of its parts
 * or of the wrong size is refused with an error, and the page keeps its art without 3D.
 */
export class SceneModels {
  private constructor(
    readonly dart: DartNodes,
    readonly board: Object3D,
    private readonly boardParts: BoardNodes,
  ) {}

  /** `base` is the site's base path; the board's file follows the quality tier */
  static async load(base: string, quality: QualitySettings): Promise<SceneModels> {
    const boardSource = boardFile(quality)
    // Both files and the two modules download at once; the first failure rejects the whole
    const [dartBytes, boardBytes, [{ GLTFLoader }, { MeshoptDecoder }]] = await Promise.all([
      download(base, DART_FILE),
      download(base, boardSource),
      Promise.all([
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/libs/meshopt_decoder.module.js'),
      ]),
    ])
    await MeshoptDecoder.ready
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const [dartGltf, boardGltf] = await Promise.all([
      loader.parseAsync(dartBytes, ''),
      loader.parseAsync(boardBytes, ''),
    ])
    dartGltf.scene.updateMatrixWorld(true)
    boardGltf.scene.updateMatrixWorld(true)

    const dart = meshes(dartGltf.scene, DART_NODES, DART_FILE.path)
    checkLimits(Object.values(dart), DART_FILE.path)
    requireMaps(
      Object.values(dart),
      ['map', 'normalMap', 'roughnessMap', 'metalnessMap'],
      DART_FILE.path,
    )
    if (!dartFits(new Box3().setFromObject(dart.tip).max.y)) {
      throw new ModelError(`${DART_FILE.path}: the point does not end where the throw puts it`)
    }

    const board = boardGltf.scene.getObjectByName('board')
    const boardParts = meshes(boardGltf.scene, BOARD_NODES, boardSource.path)
    if (!board) throw new ModelError(`${boardSource.path}: no node "board"`)
    checkLimits(Object.values(boardParts), boardSource.path)
    requireMaps([boardParts.face], ['map', 'normalMap'], boardSource.path)
    if (!boardFits(new Box3().setFromObject(boardParts.face).max.x)) {
      throw new ModelError(
        `${boardSource.path}: the face is not the size the scoring rules give it`,
      )
    }
    return new SceneModels(dart, board, boardParts)
  }

  /** Every texture the models use now, once each: to upload one per task */
  textures(): Texture[] {
    return texturesOf([...Object.values(this.dart), ...Object.values(this.boardParts)])
  }
}
