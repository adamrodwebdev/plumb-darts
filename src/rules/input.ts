/**
 * Data from outside is checked at the door (the user's rule, 2026-11-09). What must be a number
 * is a real, finite number within its range, and what must be text is a string, cleaned and
 * within its length. Nothing is coerced: what does not fit is refused with an InvalidInput, and
 * the caller decides what a refusal means (a message shown, a default kept). Outside means forms,
 * the URL, storage, messages, files and the network; past the door, code trusts these types.
 */

/** Why a value was refused */
export type InputProblem =
  | 'not-a-number'
  | 'not-an-integer'
  | 'out-of-range'
  | 'not-text'
  | 'empty'
  | 'too-long'
  | 'bad-format'
  | 'not-a-choice'
  | 'not-a-boolean'
  | 'not-a-record'
  | 'not-a-list'
  | 'too-many'

export class InvalidInput extends Error {
  override readonly name = 'InvalidInput'

  constructor(
    readonly field: string,
    readonly problem: InputProblem,
  ) {
    super(`${field}: ${problem}`)
  }
}

export interface NumberRule {
  readonly min: number
  readonly max: number
  /** Whole numbers only: counts, levels, indexes, identifiers */
  readonly integer?: boolean
}

export interface TextRule {
  /** The longest text accepted once cleaned, in characters (code points, as databases count) */
  readonly maxLength: number
  /** Keeps line breaks and tabs (a message); otherwise each run of white space becomes a space */
  readonly multiline?: boolean
  /** Refuses a text that is empty once cleaned */
  readonly required?: boolean
  /** An allow-list the whole cleaned text must match: anchored (^…$), without the g or y flag */
  readonly pattern?: RegExp
}

export interface ListRule<T> {
  readonly maxItems: number
  /** Reads one item: one of the readers below, or a value object's own parse */
  readonly item: (value: unknown, field: string) => T
}

/** A value that must already be a number: parsed JSON, a message, a typed API */
export function readNumber(value: unknown, rule: NumberRule, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new InvalidInput(field, 'not-a-number')
  }
  if (rule.integer === true && !Number.isSafeInteger(value)) {
    throw new InvalidInput(field, 'not-an-integer')
  }
  if (value < rule.min || value > rule.max) throw new InvalidInput(field, 'out-of-range')
  return value === 0 ? 0 : value // -0 reads as 0
}

/**
 * The whole text spells the number: an optional minus, ASCII digits and one decimal point. No
 * exponent, hexadecimal, plus sign, grouping or other digits; 15 digits keep integers exact.
 */
const INTEGER_TEXT = /^-?\d{1,15}$/
const DECIMAL_TEXT = /^-?\d{1,15}(?:\.\d{1,15})?$/

/**
 * Text that must spell a number: a form field, a URL parameter, a stored string. Where the
 * field's language writes a decimal comma, the caller turns that one comma into a point first.
 */
export function parseNumber(text: unknown, rule: NumberRule, field: string): number {
  if (typeof text !== 'string') throw new InvalidInput(field, 'not-text')
  const trimmed = text.trim()
  if (!(rule.integer === true ? INTEGER_TEXT : DECIMAL_TEXT).test(trimmed)) {
    throw new InvalidInput(field, 'not-a-number')
  }
  return readNumber(Number(trimmed), rule, field)
}

/** Invisible code points taken out of every text, as [first, last] ranges */
const INVISIBLE: readonly (readonly [number, number])[] = [
  [0x00, 0x08], // C0 controls before the tab
  [0x0b, 0x0c], // vertical tab and form feed
  [0x0e, 0x1f], // C0 controls after the carriage return
  [0x7f, 0x9f], // delete and the C1 controls
  [0x200b, 0x200b], // zero-width space
  [0x202a, 0x202e], // bidirectional embeddings and overrides ("Trojan Source")
  [0x2060, 0x2064], // word joiner and invisible operators
  [0x2066, 0x2069], // bidirectional isolates
  [0xd800, 0xdfff], // lone surrogates (a valid pair reads as one code point above 0xFFFF)
  [0xfeff, 0xfeff], // byte-order mark
  [0xe0000, 0xe007f], // tag characters
]

function isInvisible(character: string): boolean {
  const code = character.codePointAt(0) ?? 0
  return INVISIBLE.some(([first, last]) => code >= first && code <= last)
}

/**
 * Cleans a text without changing what it says: line breaks unified, invisible characters
 * removed (zero-width joiners stay: emoji and several scripts need them), Unicode composed
 * (NFC), white space tidied, ends trimmed. Idempotent. It does not escape HTML: text is escaped
 * where it is shown, for that place (textContent, a template's interpolation, an attribute).
 */
function clean(text: string, multiline: boolean): string {
  const visible = [...text.replace(/\r\n?/g, '\n')]
    .filter((character) => !isInvisible(character))
    .join('')
  const composed = visible.normalize('NFC')
  return (multiline ? composed : composed.replace(/\s+/g, ' ')).trim()
}

function matchesWhole(pattern: RegExp, text: string): boolean {
  if (pattern.global || pattern.sticky) {
    throw new TypeError(`${String(pattern)} keeps state between tests: drop the g and y flags`)
  }
  if (!pattern.source.startsWith('^') || !pattern.source.endsWith('$')) {
    throw new TypeError(`${String(pattern)} must match the whole text: anchor it with ^ and $`)
  }
  return pattern.test(text)
}

/** A value that must be text: refused unless it is a string, then cleaned and checked */
export function readText(value: unknown, rule: TextRule, field: string): string {
  if (typeof value !== 'string') throw new InvalidInput(field, 'not-text')
  const text = clean(value, rule.multiline === true)
  if (text === '') {
    if (rule.required === true) throw new InvalidInput(field, 'empty')
    return text
  }
  if ([...text].length > rule.maxLength) throw new InvalidInput(field, 'too-long')
  if (rule.pattern && !matchesWhole(rule.pattern, text)) throw new InvalidInput(field, 'bad-format')
  return text
}

/** A value that must be one of a closed set: an enum, a theme, a target */
export function readChoice<T extends string | number>(
  value: unknown,
  choices: readonly T[],
  field: string,
): T {
  const choice = choices.find((candidate) => candidate === value)
  if (choice === undefined) throw new InvalidInput(field, 'not-a-choice')
  return choice
}

export function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new InvalidInput(field, 'not-a-boolean')
  return value
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * An object from outside (parsed JSON, a message, a save), read field by field. Only its own
 * fields are seen, never `__proto__`, `constructor` or anything inherited, and each read checks
 * the field's type. Errors name the path of the field (`save.levels[2].stars`).
 */
export class InputRecord {
  private constructor(
    private readonly fields: Readonly<Record<string, unknown>>,
    private readonly name: string,
  ) {}

  static from(value: unknown, name: string): InputRecord {
    if (!isRecord(value)) throw new InvalidInput(name, 'not-a-record')
    return new InputRecord(value, name)
  }

  /**
   * Parses JSON first, from text no longer than `maxLength` UTF-16 units (a save, a stored
   * preference, a message): what is too long is refused before parsing, and text that is not
   * JSON is refused like any other bad input.
   */
  static parse(json: unknown, maxLength: number, name: string): InputRecord {
    if (typeof json !== 'string') throw new InvalidInput(name, 'not-text')
    if (json.length > maxLength) throw new InvalidInput(name, 'too-long')
    let value: unknown
    try {
      value = JSON.parse(json)
    } catch {
      throw new InvalidInput(name, 'bad-format')
    }
    return InputRecord.from(value, name)
  }

  has(key: string): boolean {
    return Object.hasOwn(this.fields, key)
  }

  number(key: string, rule: NumberRule): number {
    return readNumber(this.value(key), rule, this.path(key))
  }

  text(key: string, rule: TextRule): string {
    return readText(this.value(key), rule, this.path(key))
  }

  boolean(key: string): boolean {
    return readBoolean(this.value(key), this.path(key))
  }

  choice<T extends string | number>(key: string, choices: readonly T[]): T {
    return readChoice(this.value(key), choices, this.path(key))
  }

  record(key: string): InputRecord {
    return InputRecord.from(this.value(key), this.path(key))
  }

  list<T>(key: string, rule: ListRule<T>): readonly T[] {
    const value = this.value(key)
    const field = this.path(key)
    if (!Array.isArray(value)) throw new InvalidInput(field, 'not-a-list')
    const items: readonly unknown[] = value
    if (items.length > rule.maxItems) throw new InvalidInput(field, 'too-many')
    return items.map((item, index) => rule.item(item, `${field}[${index}]`))
  }

  private value(key: string): unknown {
    return Object.hasOwn(this.fields, key) ? this.fields[key] : undefined
  }

  private path(key: string): string {
    return `${this.name}.${key}`
  }
}

/** A read that falls back when the value is missing or refused: preferences, saves, options */
export function orElse<T>(read: () => T, fallback: T): T {
  try {
    return read()
  } catch (error) {
    if (error instanceof InvalidInput) return fallback
    throw error
  }
}
