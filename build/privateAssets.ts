/**
 * Our own models stay ours (the user's rule of 26 November 2026). The three GLBs the 3D scene loads
 * are not in this public repository: they live in the private repository adamrodwebdev/private-assets
 * (folder plumb-darts/), marked with our copyright. This step copies them to public/models/ at the
 * commit pinned in private-assets.lock.json, and checks each file's size and SHA-256.
 *
 *   npm run assets         copies the files of the lock (runs before dev, test and build)
 *   npm run assets:lock    pins origin/main of the local clone, with each file's size and fingerprint
 *
 * A file already in place and intact is not read again. Otherwise, in this order:
 *  1. a local clone of the private repository: PRIVATE_ASSETS_DIR, or the folder next to this
 *     repository (…/claude/private-assets), read at the pinned commit whatever its working tree holds;
 *  2. GitHub's API at the pinned commit, with a read-only token limited to the private repository:
 *     PRIVATE_ASSETS_TOKEN (a secret of this repository, given only to this step), or outside CI
 *     `gh auth token`.
 * A missing file, a wrong size or fingerprint, or neither a clone nor a token: it stops and names
 * every problem. The token is never written anywhere. This script imports nothing from
 * node_modules, so CI runs it before `npm ci`, while no third-party code has run on the machine.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const LOCK_FILE = 'private-assets.lock.json'
export const REPOSITORY = 'adamrodwebdev/private-assets'
export const FOLDER = 'plumb-darts'
/** Where the files land in this repository: public/ is copied to the site as it is */
const TARGET = 'public'
const LIMITS = Object.freeze({
  lockBytes: 16 * 1024,
  fileBytes: 4 * 1024 * 1024,
  files: 16,
  pathChars: 1024,
})
/** The only paths a private file may take: one folder, one extension, plain names */
export const PRIVATE_PATH = /^models\/[a-z0-9-]+\.glb$/
const COMMIT = /^[0-9a-f]{40}$/
const SHA256 = /^[0-9a-f]{64}$/
const TOKEN = /^[A-Za-z0-9_]{20,255}$/

export interface LockedFile {
  readonly path: string
  readonly size: number
  readonly sha256: string
}

export interface Lock {
  readonly repository: string
  readonly folder: string
  readonly commit: string
  readonly files: readonly LockedFile[]
}

/** Reads one locked file's bytes from wherever they come from */
export type Source = (file: LockedFile) => Promise<Buffer>

/** The one call made to GitHub: the global fetch, or a stand-in in the tests */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>

type Env = Readonly<Record<string, string | undefined>>

export const sha256 = (bytes: Uint8Array): string =>
  createHash('sha256').update(bytes).digest('hex')

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** The lock, checked field by field: anything that does not fit is refused */
export function parseLock(text: string): Lock {
  if (text.length > LIMITS.lockBytes) {
    throw new RangeError(`${LOCK_FILE}: over ${LIMITS.lockBytes} bytes`)
  }
  const lock: unknown = JSON.parse(text)
  if (!isRecord(lock)) throw new TypeError(`${LOCK_FILE}: an object is expected`)
  if (lock['repository'] !== REPOSITORY) throw new TypeError(`${LOCK_FILE}: unexpected repository`)
  if (lock['folder'] !== FOLDER) throw new TypeError(`${LOCK_FILE}: unexpected folder`)
  const commit = lock['commit']
  if (typeof commit !== 'string' || !COMMIT.test(commit)) {
    throw new TypeError(`${LOCK_FILE}: invalid commit`)
  }
  const list = lock['files']
  if (!Array.isArray(list) || list.length === 0 || list.length > LIMITS.files) {
    throw new RangeError(`${LOCK_FILE}: 1 to ${LIMITS.files} files`)
  }
  const seen = new Set<string>()
  const files = list.map((entry: unknown, index): LockedFile => {
    const where = `${LOCK_FILE}, file ${index + 1}`
    if (!isRecord(entry)) throw new TypeError(`${where}: an object is expected`)
    const { path, size, sha256: hash } = entry
    if (typeof path !== 'string' || !PRIVATE_PATH.test(path) || seen.has(path)) {
      throw new TypeError(`${where}: path refused`)
    }
    if (
      typeof size !== 'number' ||
      !Number.isSafeInteger(size) ||
      size < 1 ||
      size > LIMITS.fileBytes
    ) {
      throw new RangeError(`${where}: size out of range`)
    }
    if (typeof hash !== 'string' || !SHA256.test(hash)) {
      throw new TypeError(`${where}: invalid fingerprint`)
    }
    seen.add(path)
    return Object.freeze({ path, size, sha256: hash })
  })
  return Object.freeze({
    repository: REPOSITORY,
    folder: FOLDER,
    commit,
    files: Object.freeze(files),
  })
}

/** The lock file of `root`, its size checked before it is read */
async function readLock(root: string): Promise<Lock> {
  const path = join(root, LOCK_FILE)
  const { size } = await stat(path)
  if (size > LIMITS.lockBytes) throw new RangeError(`${LOCK_FILE}: over ${LIMITS.lockBytes} bytes`)
  return parseLock(await readFile(path, 'utf8'))
}

const hasControl = (value: string): boolean =>
  [...value].some((char) => {
    const code = char.codePointAt(0) ?? 0
    return code < 0x20 || code === 0x7f
  })

/** A path from the environment: a real text, no control character, bounded length */
function envPath(value: string | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0) return null
  if (value.length > LIMITS.pathChars || hasControl(value)) {
    throw new TypeError('PRIVATE_ASSETS_DIR refused')
  }
  return resolve(value)
}

function git(dir: string, args: readonly string[]): string {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    maxBuffer: LIMITS.fileBytes + 1,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

/** A blob's bytes as they were committed (plumbing: no filter, no conversion) */
function blob(dir: string, commit: string, path: string): Buffer {
  return execFileSync('git', ['-C', dir, 'cat-file', 'blob', `${commit}:${path}`], {
    maxBuffer: LIMITS.fileBytes + 1,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
}

/** The local clone of the private repository, if there is one: the variable, else the sibling folder */
export function localCheckout(root: string, env: Env): string | null {
  const asked = envPath(env['PRIVATE_ASSETS_DIR'])
  if (asked) return asked
  try {
    // The main repository, even from a worktree: its common .git folder
    const common = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()
    const sibling = join(dirname(dirname(common)), 'private-assets')
    return existsSync(join(sibling, '.git')) ? sibling : null
  } catch {
    return null
  }
}

/** The token: the variable, else (outside CI) the gh command's own, if any */
function token(env: Env): string | null {
  const raw = (env['PRIVATE_ASSETS_TOKEN'] ?? '').trim()
  if (raw) {
    if (!TOKEN.test(raw))
      throw new TypeError('PRIVATE_ASSETS_TOKEN does not look like a GitHub token')
    return raw
  }
  if (env['CI'] === 'true') return null
  try {
    const fromGh = execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
    }).trim()
    return TOKEN.test(fromGh) ? fromGh : null
  } catch {
    return null
  }
}

/** Reads a file at the pinned commit in the local clone */
function fromCheckout(dir: string, commit: string): Source {
  try {
    git(dir, ['cat-file', '-e', `${commit}^{commit}`])
  } catch {
    throw new Error(
      `the local clone ${dir} lacks commit ${commit.slice(0, 12)}: git -C "${dir}" fetch`,
    )
  }
  return async ({ path }) => blob(dir, commit, `${FOLDER}/${path}`)
}

/** The body of a response, refused as soon as it passes `size` bytes */
async function readAtMost(body: ReadableStream<Uint8Array> | null, size: number): Promise<Buffer> {
  if (!body) return Buffer.alloc(0)
  const reader = body.getReader()
  const chunks: Buffer[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > size) {
      await reader.cancel()
      throw new RangeError(`over ${size} bytes received`)
    }
    chunks.push(Buffer.from(value))
  }
  return Buffer.concat(chunks, total)
}

/** Reads a file at the pinned commit through GitHub's API (raw content), its size bounded */
export function fromGitHub(secret: string, commit: string, request: Fetch = fetch): Source {
  return async ({ path, size }) => {
    const url = `https://api.github.com/repos/${REPOSITORY}/contents/${FOLDER}/${path}?ref=${commit}`
    const response = await request(url, {
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: 'application/vnd.github.raw+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'plumb-darts-build',
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(
        `GitHub answers ${response.status}: the token must read ${REPOSITORY} (Contents: read-only)`,
      )
    }
    return readAtMost(response.body, size)
  }
}

/** True when the file at `target` is the locked one (its size first, then its fingerprint) */
async function intact(target: string, file: LockedFile): Promise<boolean> {
  const info = await stat(target).catch(() => null)
  if (!info?.isFile() || info.size !== file.size) return false
  return sha256(await readFile(target)) === file.sha256
}

export interface FetchOptions {
  readonly env?: Env
  readonly log?: (line: string) => void
  /** Where the bytes come from; by default the local clone, else GitHub with the token */
  readonly source?: Source
}

/** Copies each locked file to its place. Returns the problems, empty when every file is in place. */
export async function fetchPrivateAssets(
  root: string,
  options: FetchOptions = {},
): Promise<string[]> {
  const { env = process.env, log = console.log } = options
  const lock = await readLock(root)
  const missing: LockedFile[] = []
  for (const file of lock.files) {
    if (!(await intact(join(root, TARGET, file.path), file))) missing.push(file)
  }
  if (missing.length === 0) {
    log(`✔ our models are in place (${lock.files.length} at ${lock.commit.slice(0, 12)})`)
    return []
  }

  let read = options.source
  let from = 'the given source'
  if (!read) {
    try {
      const checkout = localCheckout(root, env)
      if (checkout) {
        read = fromCheckout(checkout, lock.commit)
        from = `the local clone ${checkout}`
      } else {
        const secret = token(env)
        if (secret) {
          read = fromGitHub(secret, lock.commit)
          from = `GitHub (${REPOSITORY})`
        }
      }
    } catch (error) {
      return [message(error)]
    }
  }
  if (!read) {
    return [
      `${missing.length} of our models missing, and neither a local clone nor a token to read them:`,
      ...missing.map((file) => `  ${TARGET}/${file.path}`),
      `In CI: the secret PRIVATE_ASSETS_TOKEN (a read-only token of ${REPOSITORY}), given to this step.`,
      'Locally: clone the private repository next to this one, or set PRIVATE_ASSETS_DIR, or gh auth login.',
    ]
  }

  const source = read
  const results = await Promise.all(
    missing.map(async (file): Promise<string | null> => {
      try {
        const bytes = await source(file)
        if (bytes.length !== file.size)
          return `${file.path}: ${bytes.length} bytes, ${file.size} expected`
        if (sha256(bytes) !== file.sha256) return `${file.path}: fingerprint differs from the lock`
        const target = join(root, TARGET, file.path)
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, bytes)
        return null
      } catch (error) {
        return `${file.path}: ${message(error)}`
      }
    }),
  )
  const problems = results.filter((problem): problem is string => problem !== null)
  if (problems.length === 0) {
    log(
      `✔ our models: ${missing.length} of ${lock.files.length} copied from ${from} (${lock.commit.slice(0, 12)})`,
    )
  }
  return problems
}

/** Pins origin/main of the local clone: each file under the allowed paths, its size and fingerprint */
export async function writeLock(root: string, options: FetchOptions = {}): Promise<void> {
  const { env = process.env, log = console.log } = options
  const dir = localCheckout(root, env)
  if (!dir) {
    throw new Error(
      'no local clone of the private repository (sibling folder or PRIVATE_ASSETS_DIR)',
    )
  }
  // Only the remote branch is read: the clone's working tree may hold other projects' unfinished work
  git(dir, ['fetch', '--quiet', 'origin'])
  const commit = git(dir, ['rev-parse', 'origin/main']).trim()
  const prefix = `${FOLDER}/`
  const paths = git(dir, ['ls-tree', '-r', '--name-only', commit, '--', prefix])
    .split('\n')
    .map((path) => path.slice(prefix.length))
    .filter((path) => PRIVATE_PATH.test(path))
    .sort()
  const files = paths.map((path) => {
    const bytes = blob(dir, commit, `${prefix}${path}`)
    return { path, size: bytes.length, sha256: sha256(bytes) }
  })
  const text = `${JSON.stringify({ repository: REPOSITORY, folder: FOLDER, commit, files }, null, 2)}\n`
  parseLock(text)
  await writeFile(join(root, LOCK_FILE), text)
  log(`✔ ${LOCK_FILE}: ${files.length} files at commit ${commit.slice(0, 12)}`)
}

// Run as a command (pathToFileURL also reads Windows paths, with their backslashes)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  try {
    if (process.argv.includes('--lock')) {
      await writeLock(root)
    } else {
      const problems = await fetchPrivateAssets(root)
      if (problems.length > 0) {
        console.error(`✘ our models:\n  ${problems.join('\n  ')}`)
        process.exitCode = 1
      }
    }
  } catch (error) {
    console.error(`✘ our models: ${message(error)}`)
    process.exitCode = 1
  }
}
