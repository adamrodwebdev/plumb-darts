import { brotliDecompressSync } from 'node:zlib'

/**
 * The characters a WOFF2 font can draw, read from its `cmap` table: a character it lacks sends the
 * browser down the font stack, glyph by glyph, which mixes two faces in one word (or, on WebKit and
 * Firefox, downloads the next web face). Used to check every language's copy against the faces
 * that set it, without a browser.
 */

/** WOFF2 numbers of 1 to 5 bytes, 7 bits each (WOFF2, 6.1.1) */
function base128(data: Uint8Array, at: { offset: number }): number {
  let value = 0
  for (let bytes = 0; bytes < 5; bytes++) {
    const byte = data[at.offset++] ?? 0
    value = value * 128 + (byte & 0x7f)
    if ((byte & 0x80) === 0) return value
  }
  throw new Error('woff2: a UIntBase128 longer than 5 bytes')
}

/** The `cmap` table of a WOFF2 font: its index among the known tags is 0 (WOFF2, 5.1) */
function cmapOf(woff2: Buffer): Buffer {
  if (woff2.toString('latin1', 0, 4) !== 'wOF2') throw new Error('woff2: not a WOFF2 file')
  const tables = woff2.readUInt16BE(12)
  const compressed = woff2.readUInt32BE(20)
  const at = { offset: 48 }
  let start = 0
  let cmap: { start: number; length: number } | undefined
  for (let table = 0; table < tables; table++) {
    const flags = woff2[at.offset++] ?? 0
    const tag = flags & 0x3f
    if (tag === 63) at.offset += 4
    const length = base128(woff2, at)
    // glyf (10) and loca (11) are transformed unless their version is 3; the others, unless 0
    const version = flags >> 6
    const transformed = tag === 10 || tag === 11 ? version !== 3 : version !== 0
    const stored = transformed ? base128(woff2, at) : length
    if (tag === 0) cmap = { start, length: stored }
    start += stored
  }
  if (!cmap) throw new Error('woff2: no cmap table')
  const data = brotliDecompressSync(woff2.subarray(at.offset, at.offset + compressed))
  return data.subarray(cmap.start, cmap.start + cmap.length)
}

/** The characters a `cmap` maps to a glyph, from its Windows Unicode BMP subtable (format 4) */
function charactersOf(cmap: Buffer): Set<number> {
  for (let record = 0; record < cmap.readUInt16BE(2); record++) {
    const entry = 4 + record * 8
    const offset = cmap.readUInt32BE(entry + 4)
    const windowsUnicode = cmap.readUInt16BE(entry) === 3 && cmap.readUInt16BE(entry + 2) === 1
    if (!windowsUnicode || cmap.readUInt16BE(offset) !== 4) continue
    const segments = cmap.readUInt16BE(offset + 6) / 2
    const ends = offset + 14
    const starts = ends + segments * 2 + 2
    const deltas = starts + segments * 2
    const ranges = deltas + segments * 2
    const characters = new Set<number>()
    for (let segment = 0; segment < segments; segment++) {
      const first = cmap.readUInt16BE(starts + segment * 2)
      const last = cmap.readUInt16BE(ends + segment * 2)
      const delta = cmap.readInt16BE(deltas + segment * 2)
      const range = cmap.readUInt16BE(ranges + segment * 2)
      for (let code = first; code <= last && code !== 0xffff; code++) {
        const indexed =
          range === 0 ? code : cmap.readUInt16BE(ranges + segment * 2 + range + (code - first) * 2)
        const glyph = range !== 0 && indexed === 0 ? 0 : (indexed + delta) & 0xffff
        if (glyph !== 0) characters.add(code)
      }
    }
    return characters
  }
  throw new Error('woff2: no Windows Unicode cmap of format 4')
}

/** Every character the font has a glyph for */
export function fontCharacters(woff2: Buffer): ReadonlySet<number> {
  return charactersOf(cmapOf(woff2))
}

/** Characters of the text the font cannot draw, as "U+202F" (each listed once, in text order) */
export function missingCharacters(text: string, characters: ReadonlySet<number>): string[] {
  const missing = new Set<number>()
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0
    // Line breaks and tabs are never drawn
    if (code >= 0x20 && !characters.has(code)) missing.add(code)
  }
  return [...missing].map((code) => `U+${code.toString(16).toUpperCase().padStart(4, '0')}`)
}

/**
 * A CSS `unicode-range` listing exactly the given characters, runs of neighbours joined
 * (U+41-43,U+2019): a face declares only what it holds, so the browser never picks it for more
 */
export function unicodeRange(characters: Iterable<number>): string {
  const sorted = [...new Set(characters)].sort((a, b) => a - b)
  const spans: string[] = []
  const hex = (code: number): string => code.toString(16).toUpperCase()
  for (let index = 0; index < sorted.length;) {
    const first = sorted[index] ?? 0
    let last = first
    while (sorted[index + 1] === last + 1) {
      index += 1
      last += 1
    }
    spans.push(first === last ? `U+${hex(first)}` : `U+${hex(first)}-${hex(last)}`)
    index += 1
  }
  return spans.join(',')
}
