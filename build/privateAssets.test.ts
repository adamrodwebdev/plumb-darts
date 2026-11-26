// The step that copies our own models from the private repository (build/privateAssets.ts): its lock
// is read field by field, every copy is checked against it, and whatever is missing stops the build
// with a message that names it. Git fixtures are real repositories in a temporary folder, cut off
// from the machine's own git settings.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  FOLDER,
  type Fetch,
  LOCK_FILE,
  REPOSITORY,
  type Source,
  fetchPrivateAssets,
  fromGitHub,
  localCheckout,
  parseLock,
  sha256,
  writeLock,
} from './privateAssets.ts'

const DART = Buffer.from('glTF: the marked dart')
const BOARD = Buffer.from('glTF: the marked board')
const COMMIT = 'a'.repeat(40)
const SECRET = `github_pat_${'x'.repeat(40)}`
/** git spawns are slow on Windows */
const GIT_TIMEOUT = 30_000

const entry = (path: string, bytes: Uint8Array) => ({
  path,
  size: bytes.length,
  sha256: sha256(bytes),
})
const VALID = {
  repository: REPOSITORY,
  folder: FOLDER,
  commit: COMMIT,
  files: [entry('models/dart.glb', DART)],
}
const quiet = (): void => undefined
const untouched: Source = () => Promise.reject(new Error('the source should not be read'))

let base = ''
let root = ''

beforeEach(async () => {
  base = await mkdtemp(join(tmpdir(), 'plumb-assets-'))
  root = join(base, 'plumb-darts')
  await mkdir(root)
})

afterEach(async () => {
  await rm(base, { recursive: true, force: true, maxRetries: 3 })
})

async function put(dir: string, path: string, bytes: Uint8Array): Promise<void> {
  const target = join(dir, path)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, bytes)
}

async function writeLockFile(
  commit: string,
  files: readonly ReturnType<typeof entry>[],
): Promise<void> {
  await writeFile(join(root, LOCK_FILE), JSON.stringify({ ...VALID, commit, files }))
}

/** git for the fixtures: no system or user settings (hooks, signing, branch names), a fixed author */
function git(dir: string, ...args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: join(base, 'no-gitconfig'),
      GIT_AUTHOR_NAME: 'Plumb tests',
      GIT_AUTHOR_EMAIL: 'tests@plumb.invalid',
      GIT_COMMITTER_NAME: 'Plumb tests',
      GIT_COMMITTER_EMAIL: 'tests@plumb.invalid',
    },
  }).trim()
}

async function commit(dir: string, files: Readonly<Record<string, Uint8Array>>): Promise<string> {
  for (const [path, bytes] of Object.entries(files)) await put(dir, path, bytes)
  git(dir, 'add', '--all')
  git(dir, 'commit', '--quiet', '--message', 'models')
  return git(dir, 'rev-parse', 'HEAD')
}

describe('parseLock', () => {
  test('reads a lock that fits', () => {
    expect(parseLock(JSON.stringify(VALID))).toEqual(VALID)
  })

  test.each([
    {
      name: 'another repository',
      lock: { ...VALID, repository: 'someone/else' },
      error: 'repository',
    },
    { name: 'another folder', lock: { ...VALID, folder: 'portfolio' }, error: 'folder' },
    { name: 'a short commit', lock: { ...VALID, commit: 'abc1234' }, error: 'commit' },
    { name: 'an upper-case commit', lock: { ...VALID, commit: 'A'.repeat(40) }, error: 'commit' },
    { name: 'no file', lock: { ...VALID, files: [] }, error: '1 to 16 files' },
    {
      name: 'seventeen files',
      lock: {
        ...VALID,
        files: Array.from({ length: 17 }, (_, i) => entry(`models/m${i}.glb`, DART)),
      },
      error: '1 to 16 files',
    },
    {
      name: 'a path out of the folder',
      lock: { ...VALID, files: [entry('../package.json', DART)] },
      error: 'path',
    },
    {
      name: 'a path that climbs',
      lock: { ...VALID, files: [entry('models/../index.html', DART)] },
      error: 'path',
    },
    {
      name: 'a sub-folder',
      lock: { ...VALID, files: [entry('models/old/dart.glb', DART)] },
      error: 'path',
    },
    {
      name: 'another extension',
      lock: { ...VALID, files: [entry('models/dart.gltf', DART)] },
      error: 'path',
    },
    {
      name: 'capitals in a name',
      lock: { ...VALID, files: [entry('models/Dart.glb', DART)] },
      error: 'path',
    },
    {
      name: 'the same path twice',
      lock: { ...VALID, files: [entry('models/dart.glb', DART), entry('models/dart.glb', BOARD)] },
      error: 'path',
    },
    {
      name: 'an empty file',
      lock: { ...VALID, files: [{ ...entry('models/dart.glb', DART), size: 0 }] },
      error: 'size',
    },
    {
      name: 'a size in text',
      lock: { ...VALID, files: [{ ...entry('models/dart.glb', DART), size: '21' }] },
      error: 'size',
    },
    {
      name: 'a fractional size',
      lock: { ...VALID, files: [{ ...entry('models/dart.glb', DART), size: 2.5 }] },
      error: 'size',
    },
    {
      name: 'a NaN size (null in JSON)',
      lock: { ...VALID, files: [{ ...entry('models/dart.glb', DART), size: Number.NaN }] },
      error: 'size',
    },
    {
      name: 'a file over 4 MiB',
      lock: { ...VALID, files: [{ ...entry('models/dart.glb', DART), size: 4 * 1024 * 1024 + 1 }] },
      error: 'size',
    },
    {
      name: 'a short fingerprint',
      lock: { ...VALID, files: [{ ...entry('models/dart.glb', DART), sha256: 'abc' }] },
      error: 'fingerprint',
    },
  ])('refuses $name', ({ lock, error }) => {
    expect(() => parseLock(JSON.stringify(lock))).toThrow(error)
  })

  test('refuses a lock over 16 KiB before parsing it', () => {
    expect(() => parseLock(`${JSON.stringify(VALID)}${' '.repeat(16 * 1024)}`)).toThrow(RangeError)
  })

  test('refuses a list instead of an object', () => {
    expect(() => parseLock('[]')).toThrow('an object is expected')
  })
})

describe('fetchPrivateAssets, with a given source', () => {
  test('copies each missing file to public/, checked against the lock', async () => {
    await writeLockFile(COMMIT, [entry('models/dart.glb', DART), entry('models/board.glb', BOARD)])
    const source: Source = async ({ path }) => (path === 'models/dart.glb' ? DART : BOARD)

    const problems = await fetchPrivateAssets(root, { env: {}, log: quiet, source })

    expect(problems).toEqual([])
    expect(await readFile(join(root, 'public/models/dart.glb'))).toEqual(DART)
    expect(await readFile(join(root, 'public/models/board.glb'))).toEqual(BOARD)
  })

  test('leaves the files already in place alone', async () => {
    await put(root, 'public/models/dart.glb', DART)
    await writeLockFile(COMMIT, [entry('models/dart.glb', DART)])
    const lines: string[] = []

    const problems = await fetchPrivateAssets(root, {
      env: {},
      log: (line) => lines.push(line),
      source: untouched,
    })

    expect(problems).toEqual([])
    expect(lines).toEqual([expect.stringContaining('in place')])
  })

  test('replaces a copy that differs from the lock, even one of the same size', async () => {
    await put(root, 'public/models/dart.glb', Buffer.alloc(DART.length, 0x20))
    await writeLockFile(COMMIT, [entry('models/dart.glb', DART)])

    const problems = await fetchPrivateAssets(root, {
      env: {},
      log: quiet,
      source: async () => DART,
    })

    expect(problems).toEqual([])
    expect(await readFile(join(root, 'public/models/dart.glb'))).toEqual(DART)
  })

  test('names every file whose bytes differ from the lock, and writes none of them', async () => {
    await writeLockFile(COMMIT, [entry('models/dart.glb', DART), entry('models/board.glb', BOARD)])
    const forged = Buffer.alloc(BOARD.length, 0x41)
    const source: Source = async ({ path }) =>
      path === 'models/dart.glb' ? Buffer.from('short') : forged

    const problems = await fetchPrivateAssets(root, { env: {}, log: quiet, source })

    expect(problems).toEqual([
      `models/dart.glb: 5 bytes, ${DART.length} expected`,
      'models/board.glb: fingerprint differs from the lock',
    ])
    expect(existsSync(join(root, 'public/models/dart.glb'))).toBe(false)
    expect(existsSync(join(root, 'public/models/board.glb'))).toBe(false)
  })

  test('names the file a source failed to read', async () => {
    await writeLockFile(COMMIT, [entry('models/dart.glb', DART)])
    const source: Source = () => Promise.reject(new Error('offline'))

    expect(await fetchPrivateAssets(root, { env: {}, log: quiet, source })).toEqual([
      'models/dart.glb: offline',
    ])
  })

  test('refuses a lock file over 16 KiB before reading it', async () => {
    await writeFile(join(root, LOCK_FILE), `${JSON.stringify(VALID)}${' '.repeat(16 * 1024)}`)

    await expect(
      fetchPrivateAssets(root, { env: {}, log: quiet, source: untouched }),
    ).rejects.toThrow(RangeError)
  })
})

describe('fetchPrivateAssets, finding its source', () => {
  test('stops in CI without a clone or a token, and names what is missing and how to fix it', async () => {
    await writeLockFile(COMMIT, [entry('models/dart.glb', DART)])

    const problems = await fetchPrivateAssets(root, { env: { CI: 'true' }, log: quiet })

    expect(problems).toContain('  public/models/dart.glb')
    expect(problems.join('\n')).toContain('PRIVATE_ASSETS_TOKEN')
  })

  test('refuses a token that is not shaped like a GitHub token', async () => {
    await writeLockFile(COMMIT, [entry('models/dart.glb', DART)])

    const problems = await fetchPrivateAssets(root, {
      env: { CI: 'true', PRIVATE_ASSETS_TOKEN: 'not a token' },
      log: quiet,
    })

    expect(problems).toEqual(['PRIVATE_ASSETS_TOKEN does not look like a GitHub token'])
  })

  test('refuses a clone path with a control character', async () => {
    await writeLockFile(COMMIT, [entry('models/dart.glb', DART)])

    const problems = await fetchPrivateAssets(root, {
      env: { CI: 'true', PRIVATE_ASSETS_DIR: `${base}\u0007` },
      log: quiet,
    })

    expect(problems).toEqual(['PRIVATE_ASSETS_DIR refused'])
  })

  test(
    'names a local clone that lacks the pinned commit, with the command that brings it',
    async () => {
      const clone = join(base, 'private-assets')
      git(base, 'init', '--quiet', '-b', 'main', clone)
      await writeLockFile(COMMIT, [entry('models/dart.glb', DART)])

      const problems = await fetchPrivateAssets(root, {
        env: { CI: 'true', PRIVATE_ASSETS_DIR: clone },
        log: quiet,
      })

      expect(problems).toEqual([expect.stringMatching(/lacks commit a{12}: git -C ".+" fetch$/)])
    },
    GIT_TIMEOUT,
  )

  test(
    'reads a local clone at the pinned commit, whatever came after it',
    async () => {
      const clone = join(base, 'private-assets')
      git(base, 'init', '--quiet', '-b', 'main', clone)
      const pinned = await commit(clone, { 'plumb-darts/models/dart.glb': DART })
      await commit(clone, { 'plumb-darts/models/dart.glb': Buffer.from('glTF: a later dart') })
      await put(clone, 'plumb-darts/models/dart.glb', Buffer.from('unfinished work'))
      await writeLockFile(pinned, [entry('models/dart.glb', DART)])

      const problems = await fetchPrivateAssets(root, {
        env: { CI: 'true', PRIVATE_ASSETS_DIR: clone },
        log: quiet,
      })

      expect(problems).toEqual([])
      expect(await readFile(join(root, 'public/models/dart.glb'))).toEqual(DART)
    },
    GIT_TIMEOUT,
  )

  test(
    'finds the clone in the folder next to the repository',
    () => {
      git(base, 'init', '--quiet', '-b', 'main', root)
      git(base, 'init', '--quiet', '-b', 'main', join(base, 'private-assets'))

      expect(localCheckout(root, {})).toBe(join(base, 'private-assets'))
    },
    GIT_TIMEOUT,
  )
})

describe('fromGitHub', () => {
  const dart = entry('models/dart.glb', DART)

  test('asks for the raw file at the pinned commit, with the token', async () => {
    const asked: { url: string; headers: Headers }[] = []
    const request: Fetch = async (url, init) => {
      asked.push({ url, headers: new Headers(init.headers) })
      return new Response(DART)
    }

    expect(await fromGitHub(SECRET, COMMIT, request)(dart)).toEqual(DART)
    expect(asked.map(({ url }) => url)).toEqual([
      `https://api.github.com/repos/adamrodwebdev/private-assets/contents/plumb-darts/models/dart.glb?ref=${COMMIT}`,
    ])
    expect(asked[0]?.headers.get('authorization')).toBe(`Bearer ${SECRET}`)
    expect(asked[0]?.headers.get('accept')).toBe('application/vnd.github.raw+json')
  })

  test('names the status and the access it needs, never the token', async () => {
    const request: Fetch = async () => new Response('Not Found', { status: 404 })

    const error: unknown = await fromGitHub(
      SECRET,
      COMMIT,
      request,
    )(dart).catch((reason: unknown) => reason)

    expect(String(error)).toContain('GitHub answers 404')
    expect(String(error)).toContain('Contents: read-only')
    expect(String(error)).not.toContain(SECRET)
  })

  test('refuses a body longer than the lock says', async () => {
    const request: Fetch = async () => new Response(Buffer.concat([DART, DART]))

    await expect(fromGitHub(SECRET, COMMIT, request)(dart)).rejects.toThrow(RangeError)
  })
})

describe('writeLock', () => {
  test(
    'pins what origin/main holds: the folder’s models only, sorted, never a commit not pushed',
    async () => {
      const origin = join(base, 'origin.git')
      const clone = join(base, 'private-assets')
      git(base, 'init', '--quiet', '--bare', origin)
      git(base, 'init', '--quiet', '-b', 'main', clone)
      git(clone, 'remote', 'add', 'origin', origin)
      const pushed = await commit(clone, {
        'plumb-darts/models/dart.glb': DART,
        'plumb-darts/models/board.glb': BOARD,
        'plumb-darts/models/notes.txt': Buffer.from('not a model'),
        'plumb-darts/LICENSE.md': Buffer.from('rights'),
        'portfolio/models/logo.glb': Buffer.from('another project'),
      })
      git(clone, 'push', '--quiet', 'origin', 'main')
      await commit(clone, { 'plumb-darts/models/extra.glb': Buffer.from('not pushed yet') })

      await writeLock(root, { env: { PRIVATE_ASSETS_DIR: clone }, log: quiet })

      const lock = parseLock(await readFile(join(root, LOCK_FILE), 'utf8'))
      expect(lock.commit).toBe(pushed)
      expect(lock.files).toEqual([entry('models/board.glb', BOARD), entry('models/dart.glb', DART)])
    },
    GIT_TIMEOUT,
  )
})
