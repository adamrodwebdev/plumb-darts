import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

/** Text inserted as is in the page; the CSP allows it by the SHA-256 of this exact text. */
export function inlineSource(path: string): string {
  return readFileSync(path, 'utf8').trim()
}

const ENTRY = /\s*<script type="module" crossorigin src="([^"]+)"><\/script>/
const MODULE_PRELOAD = /\s*<link rel="modulepreload" crossorigin href="([^"]+)">/g
const STYLESHEET = /\s*<link rel="stylesheet" crossorigin href="([^"]+)">/g

export interface BootManifest {
  entry: string
  modules: string[]
  styles: string[]
}

/** Removes the tags Vite writes for the code and returns them as a manifest. */
export function extractManifest(html: string): { html: string; manifest: BootManifest } | undefined {
  const entry = ENTRY.exec(html)?.[1]
  if (!entry) return undefined
  const modules = [...html.matchAll(MODULE_PRELOAD)].flatMap((match) => match[1] ?? [])
  const styles = [...html.matchAll(STYLESHEET)].flatMap((match) => match[1] ?? [])
  const stripped = html.replace(ENTRY, '').replace(MODULE_PRELOAD, '').replace(STYLESHEET, '')
  return { html: stripped, manifest: { entry, modules, styles } }
}

/**
 * First paint without waiting for any code: the page paints from its HTML and inline style, then
 * the boot script loads the code once the browser reports that first paint (Lighthouse: no
 * script weighs on FCP or LCP). The tags Vite writes become a manifest the boot script reads.
 */
export function deferredBoot(options: { bootScript: string }): Plugin {
  return {
    name: 'deferred-boot',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const index = bundle['index.html']
      if (!index || index.type !== 'asset') return this.error('index.html is missing from the bundle')
      const extracted = extractManifest(String(index.source))
      if (!extracted) return this.error('index.html: entry module not found')

      // "<" escaped: the JSON can never close the tag
      const manifest = JSON.stringify(extracted.manifest).replace(/</g, '\\u003c')
      index.source = extracted.html.replace(
        '</body>',
        `<script type="application/json" id="boot-manifest">${manifest}</script>\n` +
          `<script>${inlineSource(options.bootScript)}</script>\n</body>`,
      )
    },
  }
}
