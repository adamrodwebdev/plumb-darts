import { createHash } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import { policyFor } from './csp.ts'
import { extractManifest } from './deferredBoot.ts'
import { escapeHtml, fillPlaceholders, lookup } from './htmlI18n.ts'
import { absoluteFontUrls } from './inlineStyles.ts'

const sha = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`

describe('html i18n', () => {
  const messages = { hero: { title: 'Weight & <aim>' }, footer: { top: 'Back' } }

  test('fills every placeholder from the messages, escaped', () => {
    const html = '<h1>{{ hero.title }}</h1><a title="{{footer.top}}">x</a>'
    expect(fillPlaceholders(html, messages, 'index.html')).toBe(
      '<h1>Weight &amp; &lt;aim&gt;</h1><a title="Back">x</a>',
    )
  })

  test('fails the build on a key that has no message', () => {
    expect(() => fillPlaceholders('{{ hero.missing }}', messages, 'index.html')).toThrow(
      'index.html: no message for "hero.missing"',
    )
  })

  test('does not take a group of messages for a string', () => {
    expect(lookup(messages, 'hero')).toBeUndefined()
  })

  test('escapes quotes for attributes', () => {
    expect(escapeHtml(`"it's"`)).toBe('&quot;it&#39;s&quot;')
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
})

describe('inline styles', () => {
  test('makes font URLs absolute under the base path, with or without quotes', () => {
    const css = "src:url(fonts/a.woff2);src:url('fonts/b.woff2');src:url(\"fonts/c.woff2\")"
    expect(absoluteFontUrls(css, '/plumb-darts/')).toBe(
      "src:url(/plumb-darts/fonts/a.woff2);src:url('/plumb-darts/fonts/b.woff2');src:url(\"/plumb-darts/fonts/c.woff2\")",
    )
  })
})
