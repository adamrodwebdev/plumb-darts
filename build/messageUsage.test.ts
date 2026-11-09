import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { CHAPTERS } from '../src/rules/chapters.ts'
import { RINGS } from '../src/rules/scoring.ts'
import en from '../src/i18n/locales/en.json'
import type { MessageTree } from '../src/i18n/Translator.ts'

/**
 * The messages and the code that shows them stay in step: no key the pages or the code ask for is
 * missing, and no key stays in the files once nothing shows it (an orphan misleads translators).
 * Keys built at run time come from the code's own data: the chapters' names, the scoring rings.
 */
const ROOT = new URL('../', import.meta.url)
const read = (path: string): string => readFileSync(new URL(path, ROOT), 'utf8')

/** Every TypeScript source under a folder, tests left out */
function sources(folder: string): string[] {
  return readdirSync(new URL(folder, ROOT), { recursive: true, encoding: 'utf8' })
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => path.endsWith('.ts') && !path.endsWith('.test.ts'))
    .map((path) => read(`${folder}${path}`))
}

const PLURAL = ['zero', 'one', 'two', 'few', 'many', 'other']

function keysOf(tree: MessageTree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([key, node]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof node === 'string') return [path]
    return Object.keys(node).every((inner) => PLURAL.includes(inner)) ? [path] : keysOf(node, path)
  })
}

const BASE = new Set(keysOf(en))

/** {{ key }} in the page templates; {{ page.… }}, {{ fact.… }} and {{ date … }} are not messages */
const TEMPLATE_KEYS = ['index.html', '404.html'].flatMap((file) =>
  [...read(file).matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)]
    .map((match) => match[1] ?? '')
    .filter((key) => !/^(page|fact)\./.test(key)),
)

/** Quoted keys in the code: the scripts' t() and plural() calls, the build's own reads */
const quotedKeys = (code: readonly string[]): string[] =>
  code.flatMap((source) =>
    [...source.matchAll(/['"`]([a-z][\w-]*(?:\.[\w-]+)+)['"`]/g)]
      .map((match) => match[1] ?? '')
      .filter((key) => BASE.has(key)),
  )

const RUNTIME_KEYS = [
  ...quotedKeys(sources('src/')),
  ...CHAPTERS.map((chapter) => chapter.name),
  ...RINGS.map((ring) => `score.${ring}`),
]
const BUILD_KEYS = quotedKeys([...sources('build/'), read('vite.config.ts')])

describe('message keys and the code that shows them', () => {
  test('every key a page template asks for has a message', () => {
    expect(TEMPLATE_KEYS.filter((key) => !BASE.has(key))).toEqual([])
  })

  test('every chapter and every scoring ring has its label', () => {
    const dynamic = [
      ...CHAPTERS.map((chapter) => chapter.name),
      ...RINGS.map((ring) => `score.${ring}`),
    ]
    expect(dynamic.filter((key) => !BASE.has(key))).toEqual([])
  })

  test('no message is left that nothing shows', () => {
    const used = new Set([...TEMPLATE_KEYS, ...RUNTIME_KEYS, ...BUILD_KEYS])
    expect([...BASE].filter((key) => !used.has(key))).toEqual([])
  })
})
