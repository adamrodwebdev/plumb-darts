import { readFileSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'
import { DEFAULT_LANGUAGE, LANGUAGES, type Language } from '../src/i18n/languages.ts'
import { formatDate, formatSpecs } from '../src/rules/specs.ts'

export interface Messages {
  [key: string]: string | Messages
}

const owns = (object: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key)

/** The message at a dotted key ("hero.title1"), or undefined: own fields only, never `toString` */
export function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || !owns(node, part)) return undefined
    node = node[part]
  }
  return typeof node === 'string' ? node : undefined
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character)
}

/** Where the site lives: canonical and alternate addresses are absolute */
export const SITE = 'https://adamrodwebdev.github.io/plumb-darts/'

/** One page of the site: its output file (from the base), its template and its language */
export interface Page {
  readonly file: string
  readonly template: 'index.html' | '404.html'
  readonly language: Language
}

/**
 * Every page the build writes: a home per language from index.html (English at the root, the
 * others in their folder), and the one 404 page GitHub Pages serves, in English
 */
export const PAGES: readonly Page[] = [
  ...LANGUAGES.map((language): Page => ({
    file: `${language.path}index.html`,
    template: 'index.html',
    language,
  })),
  { file: '404.html', template: '404.html', language: DEFAULT_LANGUAGE },
]

/** The page written to a file ("fr/index.html"), or undefined */
export function pageAt(file: string): Page | undefined {
  const wanted = file.replace(/^\//, '')
  return PAGES.find((page) => page.file === wanted)
}

/** What a page's placeholders read besides its messages */
export interface PageValues {
  /** Intl locale of dates */
  readonly locale: string
  /** The dart's facts, formatted in the page's language ({{ fact.weight }}, or {weight} in copy) */
  readonly facts: Readonly<Record<string, string>>
  /** The page's own values: {{ page.lang }}, {{ page.url }}, {{ page.ogLocale }} */
  readonly page: Readonly<Record<string, string>>
}

export function valuesFor(language: Language): PageValues {
  return {
    locale: language.intl,
    facts: formatSpecs(language.intl),
    page: { lang: language.code, url: `${SITE}${language.path}`, ogLocale: language.ogLocale },
  }
}

/** A message with its {facts} filled; a placeholder the build cannot fill fails it */
export function withFacts(message: string, facts: PageValues['facts'], where: string): string {
  return message.replace(/\{(\w+)\}/g, (_, name: string) => {
    const fact = owns(facts, name) ? facts[name] : undefined
    if (fact === undefined) throw new Error(`${where}: "{${name}}" is not a fact the build knows`)
    return fact
  })
}

const PLACEHOLDER = /\{\{\s*(?:date\s+(\d{4}-\d{2}-\d{2})|(fact|page)\.(\w+)|([\w.-]+))\s*\}\}/g

/**
 * Fills every placeholder of a page, escaped: {{ key }} from the language's messages (their {facts}
 * filled), {{ fact.name }} and {{ page.name }} from its values, {{ date 2026-10-12 }} in its
 * locale. A key with no message fails the build.
 */
export function fillPlaceholders(
  html: string,
  messages: Messages,
  values: PageValues,
  where: string,
): string {
  return html.replace(
    PLACEHOLDER,
    (_, date?: string, table?: 'fact' | 'page', name?: string, key?: string) => {
      if (date) return escapeHtml(formatDate(values.locale, date))
      if (table && name) {
        const source = table === 'fact' ? values.facts : values.page
        const value = owns(source, name) ? source[name] : undefined
        if (value === undefined) throw new Error(`${where}: no ${table} value "${name}"`)
        return escapeHtml(value)
      }
      const message = lookup(messages, key ?? '')
      if (message === undefined) throw new Error(`${where}: no message for "${key}"`)
      return escapeHtml(withFacts(message, values.facts, `${where} ${key}`))
    },
  )
}

const attribute = (value: string): string => `"${escapeHtml(value)}"`

/** The head's links to the page in every language, and to English as the x-default */
export function languageAlternates(): readonly string[] {
  return [
    ...LANGUAGES.map(
      (language) =>
        `<link rel="alternate" hreflang=${attribute(language.code)} href=${attribute(`${SITE}${language.path}`)}>`,
    ),
    `<link rel="alternate" hreflang="x-default" href=${attribute(`${SITE}${DEFAULT_LANGUAGE.path}`)}>`,
  ]
}

/** The Open Graph locales of the page's other languages */
export function localeAlternates(current: Language): readonly string[] {
  return LANGUAGES.filter((language) => language !== current).map(
    (language) => `<meta property="og:locale:alternate" content=${attribute(language.ogLocale)}>`,
  )
}

/** A link to a language's home, the language named in itself, with its `lang` and `hreflang` */
function homeLink(base: string, language: Language, current?: Language): string {
  const currentPage = language === current ? ' aria-current="page"' : ''
  return (
    `<a href=${attribute(`${base}${language.path}`)} hreflang=${attribute(language.code)}` +
    ` lang=${attribute(language.code)}${currentPage}>${escapeHtml(language.name)}</a>`
  )
}

/**
 * The masthead's language menu: a native <details> that works without JavaScript. Its button
 * shows the language's code, and its accessible name starts with that code (WCAG 2.5.3); the
 * current language is marked with aria-current.
 */
export function languageMenu(base: string, current: Language, label: string): readonly string[] {
  return [
    '<details class="lang-menu" data-lang-menu>',
    `  <summary class="lang-menu__toggle">${escapeHtml(current.code.toUpperCase())}<span class="visually-hidden"> ${escapeHtml(label)}</span>`,
    '    <svg class="lang-menu__chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg>',
    '  </summary>',
    '  <ul class="lang-menu__list">',
    ...LANGUAGES.map((language) => `    <li>${homeLink(base, language, current)}</li>`),
    '  </ul>',
    '</details>',
  ]
}

/** The 404 page's way home in every language */
export function languageHomes(base: string): readonly string[] {
  return [
    '<ul class="missed__languages">',
    ...LANGUAGES.map((language) => `  <li>${homeLink(base, language)}</li>`),
    '</ul>',
  ]
}

/** Puts lines where a `<!-- marker -->` stands, each at the marker's indentation */
export function replaceMarker(html: string, marker: string, lines: readonly string[]): string {
  return html.replace(new RegExp(`^([ \\t]*)<!-- ${marker} -->`, 'm'), (_, indent: string) =>
    lines.map((line) => `${indent}${line}`).join('\n'),
  )
}

/** One page, whole: its placeholders filled, its language's menu and alternates in place */
export function renderPage(html: string, page: Page, messages: Messages, base: string): string {
  const values = valuesFor(page.language)
  const label = lookup(messages, 'header.language') ?? ''
  let filled = fillPlaceholders(html, messages, values, page.file)
  filled = replaceMarker(filled, 'language-alternates', languageAlternates())
  filled = replaceMarker(filled, 'locale-alternates', localeAlternates(page.language))
  filled = replaceMarker(filled, 'language-menu', languageMenu(base, page.language, label))
  return replaceMarker(filled, 'language-homes', languageHomes(base))
}

/**
 * Every visible string of the pages comes from the language's messages (src/i18n/locales), the same
 * files the scripts read. The home of each language other than English is built from index.html as
 * if it were a file of its own (fr/index.html…): Vite then gives it the code's hashed links, and
 * the plugins after this one its own fonts, boot and policy. The dev server serves them too.
 */
export function htmlI18n(options: { localesDir: string; template: string }): Plugin {
  const localesDir = resolve(options.localesDir)
  const template = resolve(options.template)
  let config: ResolvedConfig
  const read = (language: Language): Messages =>
    JSON.parse(readFileSync(resolve(localesDir, `${language.code}.json`), 'utf8')) as Messages
  /** The home page of another language, written from the template: its file under the root */
  const virtualPage = (id: string): Page | undefined => {
    if (!config || !id.endsWith('.html')) return undefined
    const file = relative(config.root, resolve(config.root, id)).replaceAll('\\', '/')
    const page = pageAt(file)
    return page && page.template === 'index.html' && page.file !== 'index.html' ? page : undefined
  }

  return {
    name: 'html-i18n',
    enforce: 'pre',
    configResolved(resolved) {
      config = resolved
    },
    resolveId(id) {
      return virtualPage(id) ? resolve(config.root, id) : null
    },
    load(id) {
      return virtualPage(id) ? readFileSync(template, 'utf8') : null
    },
    configureServer(server) {
      server.watcher.add(localesDir)
      server.watcher.on('change', (changed) => {
        if (resolve(changed).startsWith(localesDir)) server.ws.send({ type: 'full-reload' })
      })
      // The dev server has no file for /fr/: it serves the template, transformed for that page
      server.middlewares.use((request, response, next) => {
        const path = (request.url ?? '').split(/[?#]/)[0] ?? ''
        const relativePath = path.startsWith(config.base) ? path.slice(config.base.length) : ''
        const page = virtualPage(
          relativePath.endsWith('/') ? `${relativePath}index.html` : relativePath,
        )
        if (!page) return next()
        server
          .transformIndexHtml(`/${page.file}`, readFileSync(template, 'utf8'), request.originalUrl)
          .then((html) => {
            response.setHeader('Content-Type', 'text/html; charset=utf-8')
            response.end(html)
          })
          .catch(next)
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const page = pageAt(context.path)
        if (!page) throw new Error(`${context.path}: not a page of the site (build/htmlI18n.ts)`)
        return renderPage(html, page, read(page.language), config.base)
      },
    },
  }
}

/** A page's input name: "main" for the English home, the language's code for the others */
function inputName(page: Page): string {
  if (page.template === '404.html') return 'notFound'
  return page.language === DEFAULT_LANGUAGE ? 'main' : page.language.code
}

/** Vite's inputs: every page the build writes, keyed by a name */
export function pageInputs(root: string): Record<string, string> {
  return Object.fromEntries(PAGES.map((page) => [inputName(page), resolve(root, page.file)]))
}
