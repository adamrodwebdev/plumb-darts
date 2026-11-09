import type { LanguageCode } from './languages'
import type { MessageTree } from './Translator'

/**
 * Each language's messages are a chunk of their own, loaded by the page in that language only (the
 * build preloads it with the code, so it costs no extra round trip). A Map, never a lookup on a
 * plain object: the code comes from the page, through the allow-list of languages.ts.
 */
const LOADERS: ReadonlyMap<LanguageCode, () => Promise<{ default: MessageTree }>> = new Map([
  ['en', () => import('./locales/en.json')],
  ['fr', () => import('./locales/fr.json')],
  ['ru', () => import('./locales/ru.json')],
  ['es', () => import('./locales/es.json')],
  ['it', () => import('./locales/it.json')],
  ['id', () => import('./locales/id.json')],
])

export async function loadMessages(code: LanguageCode): Promise<MessageTree> {
  const load = LOADERS.get(code)
  if (!load) throw new Error(`No messages for ${code}`)
  return (await load()).default
}
