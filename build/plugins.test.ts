import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { Rollup } from 'vite'
import { describe, expect, test } from 'vitest'
import { LANGUAGES } from '../src/i18n/languages.ts'
import { policyFor } from './csp.ts'
import { extractManifest, messagesChunk } from './deferredBoot.ts'
import {
  escapeHtml,
  fillPlaceholders,
  lookup,
  type Messages,
  PAGES,
  pageAt,
  pageInputs,
  renderPage,
  replaceMarker,
  SITE,
  valuesFor,
} from './htmlI18n.ts'

const sha = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`

const VALUES = {
  locale: 'fr-FR',
  facts: { weight: '22\u00a0g' },
  page: { lang: 'fr', url: `${SITE}fr/` },
}

describe('html i18n', () => {
  const messages = {
    hero: { title: 'Weight & <aim>', eyebrow: 'Only {weight}', broken: 'Only {nothing}' },
    footer: { top: 'Back' },
  }

  test('fills every placeholder from the messages, escaped', () => {
    const html = '<h1>{{ hero.title }}</h1><a title="{{footer.top}}">x</a>'
    expect(fillPlaceholders(html, messages, VALUES, 'index.html')).toBe(
      '<h1>Weight &amp; &lt;aim&gt;</h1><a title="Back">x</a>',
    )
  })

  test('fills a message’s facts, page values and dates in the page’s language', () => {
    const html =
      '<p>{{ hero.eyebrow }}</p><html lang="{{ page.lang }}"><b>{{ fact.weight }}</b>' +
      '<time>{{ date 2026-10-12 }}</time>'
    expect(fillPlaceholders(html, messages, VALUES, 'fr/index.html')).toBe(
      '<p>Only 22\u00a0g</p><html lang="fr"><b>22\u00a0g</b><time>12\u00a0oct. 2026</time>',
    )
  })

  test('fails the build on a key that has no message', () => {
    expect(() => fillPlaceholders('{{ hero.missing }}', messages, VALUES, 'index.html')).toThrow(
      'index.html: no message for "hero.missing"',
    )
  })

  test('fails the build on a placeholder it cannot fill', () => {
    expect(() => fillPlaceholders('{{ hero.broken }}', messages, VALUES, 'index.html')).toThrow(
      '"{nothing}" is not a fact the build knows',
    )
    expect(() => fillPlaceholders('{{ fact.nothing }}', messages, VALUES, 'index.html')).toThrow(
      'no fact value "nothing"',
    )
  })

  test.each(['hero', 'hero.toString', 'toString', '__proto__'])(
    'takes neither a group nor an inherited name for a message (%s)',
    (key) => {
      expect(lookup(messages, key)).toBeUndefined()
    },
  )

  test('escapes quotes for attributes', () => {
    expect(escapeHtml(`"it's"`)).toBe('&quot;it&#39;s&quot;')
  })

  test('puts generated lines at the indentation of their marker', () => {
    expect(replaceMarker('<head>\n    <!-- here -->\n</head>', 'here', ['<a>', '<b>'])).toBe(
      '<head>\n    <a>\n    <b>\n</head>',
    )
  })
})

/**
 * The guard on every page the build writes: rendered from its template as the build renders it,
 * each home has its language, a canonical address of its own, and links to all six languages plus
 * the x-default; the 404 page links to each language's home.
 */
describe.each(PAGES.filter((page) => page.template === 'index.html'))(
  'the $language.name page ($file)',
  (page) => {
    const messages = JSON.parse(
      readFileSync(
        new URL(`../src/i18n/locales/${page.language.code}.json`, import.meta.url),
        'utf8',
      ),
    ) as Messages
    const html = renderPage(
      readFileSync(new URL('../index.html', import.meta.url), 'utf8'),
      page,
      messages,
      '/plumb-darts/',
    )
    const head = html.slice(0, html.indexOf('</head>'))

    test('declares its language', () => {
      expect(html).toMatch(new RegExp(`^<!doctype html>\\s*<html lang="${page.language.code}">`))
    })

    test('names itself as its canonical address, in Open Graph too', () => {
      const url = `${SITE}${page.language.path}`
      expect(head).toContain(`<link rel="canonical" href="${url}">`)
      expect(head).toContain(`<meta property="og:url" content="${url}">`)
      expect(head).toContain(`<meta property="og:locale" content="${page.language.ogLocale}">`)
    })

    test('links to itself in all six languages, and to English as the x-default', () => {
      const alternates = [
        ...head.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)">/g),
      ]
      expect(alternates.map(([, lang, href]) => `${lang} ${href}`)).toEqual([
        ...LANGUAGES.map((language) => `${language.code} ${SITE}${language.path}`),
        `x-default ${SITE}`,
      ])
      expect(head.match(/og:locale:alternate/g)).toHaveLength(LANGUAGES.length - 1)
    })

    test('offers a language menu that marks its own language', () => {
      const current = [
        ...html.matchAll(/<a href="([^"]+)" hreflang="(\w+)" lang="\w+" aria-current="page">/g),
      ]
      expect(current.map(([, href, lang]) => `${lang} ${href}`)).toEqual([
        `${page.language.code} /plumb-darts/${page.language.path}`,
      ])
      expect(html.match(/<details class="lang-menu"/g)).toHaveLength(1)
    })

    test('leaves no placeholder and no marker behind', () => {
      expect(html).not.toMatch(/\{\{|\}\}|<!-- language-|<!-- locale-/)
    })
  },
)

describe('the 404 page', () => {
  const page = pageAt('404.html')
  const html = renderPage(
    readFileSync(new URL('../404.html', import.meta.url), 'utf8'),
    page ?? PAGES[0]!,
    JSON.parse(
      readFileSync(new URL('../src/i18n/locales/en.json', import.meta.url), 'utf8'),
    ) as Messages,
    '/plumb-darts/',
  )

  test('stays in English, the one 404 page GitHub Pages serves', () => {
    expect(page?.language.code).toBe('en')
    expect(html).toContain('<html lang="en">')
  })

  test('links to the home of every language, each named in itself', () => {
    const homes = [
      ...html.matchAll(/<a href="([^"]+)" hreflang="(\w+)" lang="(\w+)">([^<]+)<\/a>/g),
    ]
    expect(homes.map(([, href, , lang, name]) => `${lang} ${href} ${name}`)).toEqual(
      LANGUAGES.map(
        (language) => `${language.code} /plumb-darts/${language.path} ${language.name}`,
      ),
    )
  })
})

describe('the pages the build writes', () => {
  test('are a home per language and one 404 page, each fed to Vite', () => {
    expect(PAGES.map((page) => page.file)).toEqual([
      'index.html',
      'fr/index.html',
      'ru/index.html',
      'es/index.html',
      'it/index.html',
      'id/index.html',
      '404.html',
    ])
    expect(Object.keys(pageInputs('/site'))).toEqual([
      'main',
      'fr',
      'ru',
      'es',
      'it',
      'id',
      'notFound',
    ])
  })

  test('give each page the values of its language', () => {
    expect(valuesFor(LANGUAGES[2]!).page).toEqual({
      lang: 'ru',
      url: `${SITE}ru/`,
      ogLocale: 'ru_RU',
    })
  })
})

describe('content security policy', () => {
  test('allows exactly the page inline scripts and styles, by hash', () => {
    const html =
      '<style>a{}</style><script>run()</script>' +
      '<script type="application/json" id="m">{"a":1}</script><script src="/x.js"></script>'
    const policy = policyFor(html)
    expect(policy).toContain(`script-src 'self' ${sha('run()')}`)
    expect(policy).toContain(`style-src 'self' ${sha('a{}')}`)
    expect(policy).not.toContain(sha('{"a":1}'))
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("worker-src 'none'")
  })

  test('lets the scene compile WebAssembly (the meshopt decoder), never evaluate text as code', () => {
    const scriptSrc = policyFor('')
      .split('; ')
      .find((directive) => directive.startsWith('script-src'))

    expect(scriptSrc).toBe("script-src 'self' 'wasm-unsafe-eval'")
    expect(policyFor('')).not.toMatch(/'unsafe-(eval|inline)'/)
  })

  test('lets the model loader read back its own blob: images, and connect nowhere else', () => {
    expect(policyFor('')).toContain("connect-src 'self' blob:;")
  })
})

describe('deferred boot', () => {
  test('turns the tags Vite writes into a manifest and removes them', () => {
    const html =
      '<head><script type="module" crossorigin src="/p/assets/main.js"></script>' +
      '<link rel="modulepreload" crossorigin href="/p/assets/three.js">' +
      '<link rel="stylesheet" crossorigin href="/p/assets/main.css"></head>'
    const extracted = extractManifest(html)
    expect(extracted?.manifest).toEqual({
      entry: '/p/assets/main.js',
      modules: ['/p/assets/three.js'],
      styles: ['/p/assets/main.css'],
    })
    expect(extracted?.html).toBe('<head></head>')
  })

  test('finds nothing to defer in a page without an entry module', () => {
    expect(extractManifest('<p>404</p>')).toBeUndefined()
  })

  test('finds the chunk of a page’s own language, and no other', () => {
    const chunk = (fileName: string, facadeModuleId: string | null) =>
      ({ type: 'chunk', fileName, facadeModuleId }) as unknown as Rollup.OutputChunk
    const bundle: Rollup.OutputBundle = {
      a: chunk('assets/main-1.js', 'C:\\site\\src\\main.ts'),
      b: chunk('assets/fr-2.js', 'C:\\site\\src\\i18n\\locales\\fr.json'),
      c: chunk('assets/ru-3.js', '/site/src/i18n/locales/ru.json'),
    }
    expect(messagesChunk(bundle, 'fr')).toBe('assets/fr-2.js')
    expect(messagesChunk(bundle, 'ru')).toBe('assets/ru-3.js')
    expect(messagesChunk(bundle, 'de')).toBeUndefined()
  })
})
