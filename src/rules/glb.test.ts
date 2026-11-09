import { describe, expect, test } from 'vitest'
import { readGlbLayout } from './glb'
import { InvalidInput } from './input'

const MAGIC = 0x46546c67
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

interface Parts {
  readonly magic?: number
  readonly version?: number
  readonly declaredLength?: (actual: number) => number
  readonly jsonType?: number
  readonly json?: string
  readonly bin?: number
  readonly binType?: number
  readonly trailing?: number
}

/** A GLB as a writer would make it, each field overridable to make it hostile */
function glb(parts: Parts = {}): ArrayBuffer {
  const text = parts.json ?? '{"asset":{"version":"2.0"}}'
  const json = new TextEncoder().encode(text.padEnd(Math.ceil(text.length / 4) * 4, ' '))
  const bin = parts.bin ?? 8
  const length = 12 + 8 + json.length + (bin > 0 ? 8 + bin : 0) + (parts.trailing ?? 0)
  const bytes = new Uint8Array(length)
  const view = new DataView(bytes.buffer)
  view.setUint32(0, parts.magic ?? MAGIC, true)
  view.setUint32(4, parts.version ?? 2, true)
  view.setUint32(8, parts.declaredLength ? parts.declaredLength(length) : length, true)
  view.setUint32(12, json.length, true)
  view.setUint32(16, parts.jsonType ?? JSON_CHUNK, true)
  bytes.set(json, 20)
  if (bin > 0) {
    view.setUint32(20 + json.length, bin, true)
    view.setUint32(24 + json.length, parts.binType ?? BIN_CHUNK, true)
  }
  return bytes.buffer
}

const read = (bytes: ArrayBuffer, maxBytes = 1024): unknown =>
  readGlbLayout(bytes, maxBytes, 'model')

describe('readGlbLayout', () => {
  test('reads a GLB with its JSON and binary chunks', () => {
    expect(read(glb())).toEqual({ byteLength: 64, jsonLength: 28, binLength: 8 })
  })

  test('reads a GLB without a binary chunk', () => {
    expect(read(glb({ bin: 0 }))).toEqual({ byteLength: 48, jsonLength: 28, binLength: 0 })
  })

  test.each([
    { name: 'larger than its limit', bytes: glb(), maxBytes: 63, problem: 'too-long' },
    { name: 'an empty body', bytes: new ArrayBuffer(0), maxBytes: 1024, problem: 'bad-format' },
    {
      name: 'an error page served in its place',
      bytes: new TextEncoder().encode('<!DOCTYPE html><title>404</title>').buffer,
      maxBytes: 1024,
      problem: 'bad-format',
    },
    {
      name: 'another magic',
      bytes: glb({ magic: 0x12345678 }),
      maxBytes: 1024,
      problem: 'bad-format',
    },
    { name: 'glTF 1', bytes: glb({ version: 1 }), maxBytes: 1024, problem: 'bad-format' },
    {
      name: 'cut off (declares more)',
      bytes: glb({ declaredLength: (n) => n + 4 }),
      maxBytes: 1024,
      problem: 'bad-format',
    },
    {
      name: 'padded (declares less)',
      bytes: glb({ declaredLength: (n) => n - 4 }),
      maxBytes: 1024,
      problem: 'bad-format',
    },
    {
      name: 'a binary chunk first',
      bytes: glb({ jsonType: BIN_CHUNK }),
      maxBytes: 1024,
      problem: 'bad-format',
    },
    {
      name: 'a binary chunk of another type',
      bytes: glb({ binType: JSON_CHUNK }),
      maxBytes: 1024,
      problem: 'bad-format',
    },
    {
      name: 'an unaligned binary chunk',
      bytes: glb({ bin: 6 }),
      maxBytes: 1024,
      problem: 'bad-format',
    },
    {
      name: 'bytes after the last chunk',
      bytes: glb({ trailing: 4 }),
      maxBytes: 1024,
      problem: 'bad-format',
    },
  ])('refuses $name', ({ bytes, maxBytes, problem }) => {
    expect(() => read(bytes, maxBytes)).toThrow(InvalidInput)
    expect(() => read(bytes, maxBytes)).toThrow(problem)
  })

  test('refuses a JSON chunk that claims to run past the end of the file', () => {
    const bytes = glb({ bin: 0 })
    new DataView(bytes).setUint32(12, 4096, true)

    expect(() => read(bytes)).toThrow('bad-format')
  })

  test('refuses a JSON chunk whose length is not a multiple of four', () => {
    const bytes = glb({ bin: 0 })
    new DataView(bytes).setUint32(12, 27, true)

    expect(() => read(bytes)).toThrow('bad-format')
  })
})
