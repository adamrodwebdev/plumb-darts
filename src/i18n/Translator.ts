export interface MessageTree {
  readonly [key: string]: string | MessageTree
}

export type Params = Readonly<Record<string, string | number>>

/** Strings of the page from the message files, with {placeholders}, plural forms and Intl numbers */
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

  /** A plural message ({ one, other }) for a count */
  plural(key: string, count: number): string {
    const forms = this.find(key)
    if (typeof forms !== 'object') return key
    const form = forms[this.plurals.select(count)] ?? forms['other']
    return typeof form === 'string' ? this.fill(form, { count }) : key
  }

  number(value: number): string {
    return this.numbers.format(value)
  }

  private find(key: string): string | MessageTree | undefined {
    let node: string | MessageTree | undefined = this.messages
    for (const part of key.split('.')) {
      if (typeof node !== 'object') return undefined
      node = node[part]
    }
    return node
  }

  private fill(message: string, params: Params): string {
    return message.replace(/\{(\w+)\}/g, (match, name: string) => {
      const value = params[name]
      if (value === undefined) return match
      return typeof value === 'number' ? this.number(value) : value
    })
  }
}
