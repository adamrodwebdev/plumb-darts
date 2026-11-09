import { describe, expect, test } from 'vitest'
import { formatSpecs } from '../rules/specs'
import { LANGUAGES, type LanguageCode } from './languages'
import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import id from './locales/id.json'
import it from './locales/it.json'
import ru from './locales/ru.json'
import type { MessageTree } from './Translator'

/**
 * The six languages' messages drift in known ways (the senior-web-developer skill,
 * references/i18n-keys.md): a key missing or extra, a string here and a group there, a placeholder
 * renamed or dropped, too few plural forms, typography lost. English is the base.
 */
const MESSAGES: Readonly<Record<LanguageCode, MessageTree>> = { en, fr, ru, es, it, id }

const CATEGORIES: readonly string[] = ['zero', 'one', 'two', 'few', 'many', 'other']

type Leaf = string | Readonly<Record<string, string>>

/** A group whose keys are all plural categories, `other` among them, is one plural message */
function isPlural(node: string | MessageTree): node is Readonly<Record<string, string>> {
  return (
    typeof node === 'object' &&
    Object.hasOwn(node, 'other') &&
    Object.entries(node).every(
      ([key, value]) => CATEGORIES.includes(key) && typeof value === 'string',
    )
  )
}

/** Every message by its dotted key; a plural message is one leaf */
function leaves(tree: MessageTree, prefix = ''): Map<string, Leaf> {
  const found = new Map<string, Leaf>()
  for (const [key, node] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof node === 'string' || isPlural(node)) found.set(path, node)
    else for (const [inner, leaf] of leaves(node, path)) found.set(inner, leaf)
  }
  return found
}

/** The texts of a message: the string, or each plural form */
const textsOf = (leaf: Leaf): string[] => (typeof leaf === 'string' ? [leaf] : Object.values(leaf))

const placeholdersOf = (text: string): string[] =>
  [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort()

const BASE = leaves(en)
const OTHERS = LANGUAGES.filter((language) => language.code !== 'en')

/** Values the page's code passes to its messages (Hud, ThrowPanel, OrbitCarousel) */
const RUNTIME_VALUES = ['chapter', 'remaining', 'index', 'count', 'outlet', 'label', 'segment']

describe.each(OTHERS)('$name ($code)', (language) => {
  const messages = leaves(MESSAGES[language.code])

  test('has exactly the base language’s keys, a string where it has a string', () => {
    const shape = (map: Map<string, Leaf>): string[] =>
      [...map].map(([key, leaf]) => `${key}: ${typeof leaf === 'string' ? 'text' : 'plural'}`)
    expect(shape(messages).sort()).toEqual(shape(BASE).sort())
  })

  test('keeps every message’s placeholders, in each plural form', () => {
    const drifted = [...BASE].flatMap(([key, base]) => {
      const expected = placeholdersOf(textsOf(base)[0] ?? '')
      const leaf = messages.get(key)
      return textsOf(leaf ?? '')
        .filter((text) => placeholdersOf(text).join() !== expected.join())
        .map((text) => `${key}: "${text}"`)
    })
    expect(drifted).toEqual([])
  })

  test('has every plural form its language needs, and no other', () => {
    const needed = new Intl.PluralRules(language.intl).resolvedOptions().pluralCategories.toSorted()
    const plurals = [...messages].filter(([, leaf]) => typeof leaf !== 'string')
    expect(plurals.length).toBeGreaterThan(0)
    for (const [key, leaf] of plurals) {
      expect(Object.keys(leaf).sort(), key).toEqual(needed)
    }
  })
})

describe.each(LANGUAGES)('the $name messages', (language) => {
  const messages = leaves(MESSAGES[language.code])
  const texts = [...messages].flatMap(([key, leaf]) => textsOf(leaf).map((text) => ({ key, text })))

  test('are never empty, nor padded with spaces', () => {
    expect(texts.filter(({ text }) => text.trim() !== text || text === '')).toEqual([])
  })

  test('name only facts the build fills or values the page’s code passes', () => {
    const known = new Set([...Object.keys(formatSpecs(language.intl)), ...RUNTIME_VALUES])
    const unknown = texts.flatMap(({ key, text }) =>
      placeholdersOf(text)
        .filter((name) => !known.has(name))
        .map((name) => `${key}: {${name}}`),
    )
    expect(unknown).toEqual([])
  })

  test('leave the template’s own namespaces free (page, fact, date)', () => {
    const reserved = ['page', 'fact', 'date'].filter((name) =>
      Object.hasOwn(MESSAGES[language.code], name),
    )
    expect(reserved).toEqual([])
  })

  test('use typographic apostrophes and ellipses, and no narrow space the fonts lack', () => {
    const plain = texts.filter(({ text }) => /'|\.\.\.|\u202f| {2}/.test(text))
    expect(plain.map(({ key, text }) => `${key}: "${text}"`)).toEqual([])
  })
})

describe('typography per language', () => {
  const textsIn = (code: LanguageCode): { key: string; text: string }[] =>
    [...leaves(MESSAGES[code])].flatMap(([key, leaf]) =>
      textsOf(leaf).map((text) => ({ key, text })),
    )

  test('French puts a no-break space before : ; ! ? and inside « »', () => {
    const wrong = textsIn('fr').filter(
      ({ text }) => /[^\u00a0][:;!?»]/.test(text) || /«[^\u00a0]/.test(text),
    )
    expect(wrong.map(({ key, text }) => `${key}: "${text}"`)).toEqual([])
  })

  test('Russian sets no space before ! ? : ; and binds each dash to the word before it', () => {
    const wrong = textsIn('ru').filter(
      ({ text }) => /\s[!?:;]/.test(text) || /[^\u00a0]—/.test(text) || /["„“”]/.test(text),
    )
    expect(wrong.map(({ key, text }) => `${key}: "${text}"`)).toEqual([])
  })

  test('Spanish opens every question and exclamation it closes', () => {
    const count = (text: string, mark: string): number => text.split(mark).length - 1
    const unpaired = textsIn('es').filter(
      ({ text }) => count(text, '¿') !== count(text, '?') || count(text, '¡') !== count(text, '!'),
    )
    expect(unpaired.map(({ key, text }) => `${key}: "${text}"`)).toEqual([])
  })
})
