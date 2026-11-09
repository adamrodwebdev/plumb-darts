import { createHash } from 'node:crypto'
import type { Plugin } from 'vite'

const sha256 = (text: string): string =>
  `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`

/** Executable inline scripts: no src, and no data type (JSON blocks are never run). */
const INLINE_SCRIPT =
  /<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g
const INLINE_STYLE = /<style[^>]*>([\s\S]*?)<\/style>/g

/** The policy of one page: its own inline blocks are allowed by hash, nothing else inline. */
export function policyFor(html: string): string {
  const scripts = [...html.matchAll(INLINE_SCRIPT)].map((match) => sha256(match[1] ?? ''))
  const styles = [...html.matchAll(INLINE_STYLE)].map((match) => sha256(match[1] ?? ''))
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval' lets the 3D scene compile the WebAssembly of three's meshopt decoder
    // (the models' compressed geometry). It allows WebAssembly only: eval() and new Function()
    // stay refused, and no script runs that the hashes and 'self' do not name.
    ['script-src', "'self'", ...scripts, "'wasm-unsafe-eval'"].join(' '),
    `style-src 'self' ${styles.join(' ')}`.trim(),
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // blob: the model files' embedded images are read back from blob: URLs the page itself made
    // (three's GLTFLoader fetches them): they hold nothing but bytes already in the page
    "connect-src 'self' blob:",
    // No page starts a worker: the board's face, once drawn in one, comes from its model file
    "worker-src 'none'",
    "media-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    // No upgrade-insecure-requests: GitHub Pages serves HTTPS only and every URL here is relative,
    // so it upgrades nothing there, while over plain HTTP (a preview on the local network, WebKit
    // even on localhost) it sent the scripts and fonts to an https:// address that does not answer
  ].join('; ')
}

/**
 * GitHub Pages cannot send headers, so each page carries its Content-Security-Policy in a meta
 * tag placed before any script or style. Runs last, once every inline block is final.
 */
export function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue
          const html = String(file.source)
          const meta = `<meta http-equiv="Content-Security-Policy" content="${policyFor(html)}">`
          if (!html.includes('<meta charset="utf-8">')) {
            return this.error(`${file.fileName}: <meta charset="utf-8"> must open the head`)
          }
          file.source = html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n${meta}`)
        }
      },
    },
  }
}
