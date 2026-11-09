import { BOARD } from './board'
import { type DartPart, TIP_END } from './dartProfile'
import type { QualitySettings } from './quality'

/**
 * The scene's two model files, made by the 3D library's Blender generators (gen-dart.py,
 * gen-dartboard.py) and packed for the web (meshopt geometry, WebP maps). Real scale in metres,
 * glTF +Y up.
 */
export interface ModelFile {
  /** Where the file is served, from the site's base */
  readonly path: string
  /** The most it may weigh: a larger file is refused before it is parsed */
  readonly maxBytes: number
}

const KB = 1024

export const DART_FILE: ModelFile = { path: 'models/dart.glb', maxBytes: 512 * KB }

/** The board's face at 2048 px for the high tier, 1024 px for phones and smaller GPUs */
const BOARD_FILES = {
  large: { path: 'models/board.glb', maxBytes: 768 * KB },
  small: { path: 'models/board-1k.glb', maxBytes: 512 * KB },
} as const satisfies Record<string, ModelFile>

export function boardFile(quality: QualitySettings): ModelFile {
  return quality.boardTexture >= 2048 ? BOARD_FILES.large : BOARD_FILES.small
}

/** The nodes each file must hold, by name: a file without one is refused, never half drawn */
export const DART_NODES: readonly DartPart[] = ['tip', 'barrel', 'shaft', 'flight']
export const BOARD_NODES = ['face', 'spider', 'numbers', 'rim'] as const
export type BoardNode = (typeof BOARD_NODES)[number]

/** What a loaded file may hold at most (a swapped or damaged file is refused, not drawn) */
export const MODEL_LIMITS = {
  /** Vertices of one file's meshes together */
  vertices: 40_000,
  /** Textures of one file */
  textures: 8,
  /** Width or height of one texture, in pixels */
  textureSize: 2048,
} as const

/** The models are in metres, the scene in centimetres */
export const METRES_TO_SCENE = 100

/** A thrown dart lands where its point is: the file's point must end where the throw puts it */
export function dartFits(tipEndMetres: number): boolean {
  return Math.abs(tipEndMetres * METRES_TO_SCENE - TIP_END) <= 0.05
}

/** A dart lands in the bed the scoring rules give it: the file's face must have their size */
export function boardFits(faceRadiusMetres: number): boolean {
  return Math.abs(faceRadiusMetres * 1000 - BOARD.edge) <= 0.5
}
