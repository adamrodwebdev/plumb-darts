// CPU slowdown fitted to the CI machine, so every measure simulates the same phone whichever
// runner GitHub draws (their speed varies by a quarter from one run to the next, and the same code
// went from 10 to 140 ms of blocking time on Skull Darts 71). Reference: 4× on a machine of index
// 2,450, the slowest seen (2 November 2026). Reads the warm-up runs and prints
// LIGHTHOUSE_CPU_SLOWDOWN=… for $GITHUB_ENV.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const DIR = process.argv[2] ?? '.lighthouseci'
const REFERENCE_INDEX = 2450
const REFERENCE_SLOWDOWN = 4

const indexes = existsSync(DIR)
  ? readdirSync(DIR)
      .filter((name) => /^lhr-.*\.json$/.test(name))
      .map((name) => JSON.parse(readFileSync(join(DIR, name), 'utf8')).environment?.benchmarkIndex)
      .filter((value) => Number.isFinite(value))
  : []
// The median, like the reference (the slow machine's usual index, not its peak): the fastest
// warm-up run set a slowdown 6 % harsher than the same phone
const sorted = indexes.toSorted((a, b) => a - b)
const index = sorted.length ? sorted[Math.floor(sorted.length / 2)] : Number.NaN
const slowdown = Number.isFinite(index)
  ? Math.max(1, (REFERENCE_SLOWDOWN * index) / REFERENCE_INDEX)
  : REFERENCE_SLOWDOWN
console.error(
  `Machine index: ${indexes.map(Math.round).join(', ') || 'unknown'} → slowdown ${slowdown.toFixed(2)}×`,
)
console.log(`LIGHTHOUSE_CPU_SLOWDOWN=${slowdown.toFixed(2)}`)
