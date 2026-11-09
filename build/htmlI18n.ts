import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

export interface Messages {
  [key: string]: string | Messages
}

/** The message at a dotted key ("hero.title1"), or undefined when there is no such string. */
export function lookup(messages: Messages, key: string): string | undefined {
  let node: string | Messages | undefined = messages
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined
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

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g

/** Fills every {{ key }} of a page from the messages, escaped. An unknown key fails the build. */
export function fillPlaceholders(html: string, messages: Messages, page: string): string {
  return html.replace(PLACEHOLDER, (_, key: string) => {
    const value = lookup(messages, key)
    if (value === undefined) throw new Error(`${page}: no message for "${key}"`)
    return escapeHtml(value)
  })
}

/**
 * Every visible string of the HTML pages comes from the base locale file (src/i18n/en.json), the
 * same file the scripts read: one place for the copy, ready for other languages later.
 */
export function htmlI18n(options: { messagesFile: string }): Plugin {
  const file = resolve(options.messagesFile)
  return {
    name: 'html-i18n',
    configureServer(server) {
      server.watcher.add(file)
      server.watcher.on('change', (changed) => {
        if (resolve(changed) === file) server.ws.send({ type: 'full-reload' })
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, context) {
        const messages = JSON.parse(readFileSync(file, 'utf8')) as Messages
        return fillPlaceholders(html, messages, context.filename)
      },
    },
  }
}
