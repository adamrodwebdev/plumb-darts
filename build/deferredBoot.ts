import { readFileSync } from 'node:fs'
import type { Plugin, Rollup } from 'vite'

/** Text inserted as is in the page; the CSP allows it by the SHA-256 of this exact text. */
export function inlineSource(path: string): string {
  return readFileSync(path, 'utf8').trim()
}

const ENTRY = /\s*<script type="module" crossorigin src="([^"]+)"><\/script>/
const MODULE_PRELOAD = /\s*<link rel="modulepreload" crossorigin href="([^"]+)">/g
const STYLESHEET = /\s*<link rel="stylesheet" crossorigin href="([^"]+)">/g
const LANG_ATTRIBUTE = /<html\s+lang="([a-z]{2,3})"/

export interface BootManifest {
  entry: string
  modules: string[]
  styles: string[]
}

/** Removes the tags Vite writes for the code and returns them as a manifest. */
export function extractManifest(
  html: string,
): { html: string; manifest: BootManifest } | undefined {
  const entry = ENTRY.exec(html)?.[1]
  if (!entry) return undefined
  const modules = [...html.matchAll(MODULE_PRELOAD)].flatMap((match) => match[1] ?? [])
  const styles = [...html.matchAll(STYLESHEET)].flatMap((match) => match[1] ?? [])
  const stripped = html.replace(ENTRY, '').replace(MODULE_PRELOAD, '').replace(STYLESHEET, '')
  return { html: stripped, manifest: { entry, modules, styles } }
}

/**
 * The chunk of a language's messages (src/i18n/locales/fr.json), which the page imports itself:
 * Vite preloads only the code a page names, so the boot preloads this one with it
 */
export function messagesChunk(bundle: Rollup.OutputBundle, lang: string): string | undefined {
  const source = `/i18n/locales/${lang}.json`
  return Object.values(bundle).find(
    (file) =>
      file.type === 'chunk' &&
      file.facadeModuleId !== null &&
      file.facadeModuleId.replaceAll('\\', '/').endsWith(source),
  )?.fileName
}

/**
 * First paint without waiting for any code: the page paints from its HTML and inline style, then
 * the boot script loads the code once the browser reports that first paint (Lighthouse: no
 * script weighs on FCP or LCP). The tags Vite writes become a manifest the boot script reads, with
 * the page's own language added to what it preloads. Every page with code gets it (one per
 * language); the 404 page has none.
 */
export function deferredBoot(options: { bootScript: string }): Plugin {
  let base = '/'
  return {
    name: 'deferred-boot',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      base = config.base
    },
    generateBundle(_, bundle) {
      let pages = 0
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue
        const extracted = extractManifest(String(file.source))
        if (!extracted) continue
        pages += 1
        const lang = LANG_ATTRIBUTE.exec(extracted.html)?.[1]
        const messages = lang ? messagesChunk(bundle, lang) : undefined
        if (!messages) return this.error(`${file.fileName}: no messages chunk for lang "${lang}"`)
        extracted.manifest.modules.push(`${base}${messages}`)
        // "<" escaped: the JSON can never close the tag
        const manifest = JSON.stringify(extracted.manifest).replace(/</g, '\\u003c')
        file.source = extracted.html.replace(
          '</body>',
          `<script type="application/json" id="boot-manifest">${manifest}</script>\n` +
            `<script>${inlineSource(options.bootScript)}</script>\n</body>`,
        )
      }
      if (pages === 0) return this.error('no page with an entry module in the bundle')
    },
  }
}
