import { InvalidInput } from './input'

/** glTF 2.0's binary container: a 12-byte header, a JSON chunk, then an optional binary chunk */
const MAGIC = 0x46546c67 // "glTF"
const VERSION = 2
const JSON_CHUNK = 0x4e4f534a // "JSON"
const BIN_CHUNK = 0x004e4942 // "BIN\0"
const HEADER_BYTES = 12
const CHUNK_HEADER_BYTES = 8

export interface GlbLayout {
  readonly byteLength: number
  readonly jsonLength: number
  readonly binLength: number
}

/**
 * A model file is checked at the door, before any parser reads it: no larger than `maxBytes`,
 * the GLB magic and version 2, a total length equal to the bytes received (nothing cut off), a
 * JSON chunk first, then at most one binary chunk, each inside the file and 4-byte aligned. An
 * error page served in its place, a truncated download or a stray chunk is refused.
 */
export function readGlbLayout(bytes: ArrayBuffer, maxBytes: number, field: string): GlbLayout {
  if (bytes.byteLength > maxBytes) throw new InvalidInput(field, 'too-long')
  if (bytes.byteLength < HEADER_BYTES + CHUNK_HEADER_BYTES) {
    throw new InvalidInput(field, 'bad-format')
  }
  const view = new DataView(bytes)
  const word = (offset: number): number => view.getUint32(offset, true)
  if (word(0) !== MAGIC || word(4) !== VERSION || word(8) !== bytes.byteLength) {
    throw new InvalidInput(field, 'bad-format')
  }
  const jsonLength = word(12)
  const jsonEnd = HEADER_BYTES + CHUNK_HEADER_BYTES + jsonLength
  if (
    word(16) !== JSON_CHUNK ||
    jsonLength === 0 ||
    jsonLength % 4 !== 0 ||
    jsonEnd > bytes.byteLength
  ) {
    throw new InvalidInput(field, 'bad-format')
  }
  if (jsonEnd === bytes.byteLength) {
    return { byteLength: bytes.byteLength, jsonLength, binLength: 0 }
  }
  if (jsonEnd + CHUNK_HEADER_BYTES > bytes.byteLength) throw new InvalidInput(field, 'bad-format')
  const binLength = word(jsonEnd)
  const end = jsonEnd + CHUNK_HEADER_BYTES + binLength
  if (word(jsonEnd + 4) !== BIN_CHUNK || binLength % 4 !== 0 || end !== bytes.byteLength) {
    throw new InvalidInput(field, 'bad-format')
  }
  return { byteLength: bytes.byteLength, jsonLength, binLength }
}
