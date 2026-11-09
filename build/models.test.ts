// The model files the site ships (public/models): each one fits the limits the page reads it with,
// holds the nodes the scene looks up, and needs only what three.js decodes with the loader the page
// brings. A regenerated file that breaks this fails here, not as a page that quietly loses its 3D.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { readGlbLayout } from '../src/rules/glb.ts'
import { BOARD_NODES, DART_FILE, DART_NODES, boardFile } from '../src/rules/models.ts'
import { QUALITY } from '../src/rules/quality.ts'

/** What GLTFLoader reads with the meshopt decoder the scene sets, and nothing else */
const DECODED = [
  'EXT_meshopt_compression',
  'EXT_texture_webp',
  'KHR_mesh_quantization',
  'KHR_texture_transform',
]

interface GltfJson {
  readonly nodes?: readonly { readonly name?: string }[]
  readonly extensionsUsed?: readonly string[]
  readonly extensionsRequired?: readonly string[]
}

function open(path: string, maxBytes: number): GltfJson {
  const bytes = readFileSync(fileURLToPath(new URL(`../public/${path}`, import.meta.url)))
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const layout = readGlbLayout(buffer, maxBytes, path)
  return JSON.parse(
    new TextDecoder().decode(new Uint8Array(buffer, 20, layout.jsonLength)),
  ) as GltfJson
}

const FILES = [
  { file: DART_FILE, nodes: ['dart', ...DART_NODES] },
  { file: boardFile(QUALITY.high), nodes: ['board', ...BOARD_NODES] },
  { file: boardFile(QUALITY.medium), nodes: ['board', ...BOARD_NODES] },
]

describe.each(FILES)('$file.path', ({ file, nodes }) => {
  const json = open(file.path, file.maxBytes)

  test('holds every node the scene looks up', () => {
    expect((json.nodes ?? []).map((node) => node.name)).toEqual(expect.arrayContaining(nodes))
  })

  test('needs only extensions the page decodes', () => {
    for (const name of [...(json.extensionsUsed ?? []), ...(json.extensionsRequired ?? [])]) {
      expect(DECODED).toContain(name)
    }
  })
})
