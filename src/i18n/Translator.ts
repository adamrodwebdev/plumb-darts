import { unbreakable } from '../rules/typography'

export interface MessageTree {
  readonly [key: string]: string | MessageTree
}

export type Params = Readonly<Record<string, string | number>>

/**
 * Strings of the page from its language's messages, with {placeholders}, plural forms chosen by
 * Intl.PluralRules (Russian has one, few and many) and numbers formatted by Intl in that language
 */
export class Translator {
  private readonly plurals: Intl.PluralRules
  private readonly numbers: Intl.NumberFormat

  constructor(
    private readonly messages: MessageTree,
    readonly locale: string,
  ) {
    this.plurals = new Intl.PluralRules(locale)
    this.numbers = new Intl.NumberFormat(locale)
  }

  t(key: string, params: Params = {}): string {
    const message = this.find(key)
    if (typeof message !== 'string') return key
    return this.fill(message, params)
  }

  /**
   * A plural message ({ one, few, many, other }) for a count, which fills {count}; the other
   * values fill their own placeholders. A category the messages lack falls back on `other`.
   */
  plural(key: string, count: number, params: Params = {}): string {
    const forms = this.find(key)
    if (typeof forms !== 'object') return key
    const form = forms[this.plurals.select(count)] ?? forms['other']
    return typeof form === 'string' ? this.fill(form, { ...params, count }) : key
  }

  number(value: number): string {
    return unbreakable(this.numbers.format(value))
  }

  private find(key: string): string | MessageTree | undefined {
    let node: string | MessageTree | undefined = this.messages
    for (const part of key.split('.')) {
      if (typeof node !== 'object' || !Object.prototype.hasOwnProperty.call(node, part)) {
        return undefined
      }
      node = node[part]
    }
    return node
  }

  private fill(message: string, params: Params): string {
    return message.replace(/\{(\w+)\}/g, (match, name: string) => {
      if (!Object.prototype.hasOwnProperty.call(params, name)) return match
      const value = params[name]
      if (value === undefined) return match
      return typeof value === 'number' ? this.number(value) : value
    })
  }
}
