import { describe, expect, test } from 'vitest'
import {
  InputRecord,
  InvalidInput,
  orElse,
  parseNumber,
  readBoolean,
  readChoice,
  readNumber,
  readText,
} from './input'

const LEVEL = { min: 1, max: 60, integer: true } as const
const VOLUME = { min: 0, max: 1 } as const
const NAME = { maxLength: 12, required: true } as const

/** The reason a read refused its value, or 'accepted' */
function problem(read: () => unknown): string {
  try {
    read()
    return 'accepted'
  } catch (error) {
    return error instanceof InvalidInput ? error.problem : `threw ${String(error)}`
  }
}

describe('readNumber: a value that must already be a number', () => {
  test.each([
    { name: 'a numeric string', value: '12' },
    { name: 'an empty string', value: '' },
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
    { name: 'true', value: true },
    { name: 'an empty array', value: [] },
    { name: 'an array of one number', value: [12] },
    { name: 'an object', value: {} },
    { name: 'NaN', value: Number.NaN },
    { name: 'Infinity', value: Number.POSITIVE_INFINITY },
    { name: 'minus Infinity', value: Number.NEGATIVE_INFINITY },
  ])('refuses $name', ({ value }) => {
    expect(problem(() => readNumber(value, LEVEL, 'level'))).toBe('not-a-number')
  })

  test.each([
    { value: 12.5, expected: 'not-an-integer' },
    { value: 2 ** 53, expected: 'not-an-integer' },
    { value: 0, expected: 'out-of-range' },
    { value: 61, expected: 'out-of-range' },
    { value: -1, expected: 'out-of-range' },
  ])('refuses $value as a level ($expected)', ({ value, expected }) => {
    expect(problem(() => readNumber(value, LEVEL, 'level'))).toBe(expected)
  })

  test.each([1, 30, 60])('accepts the level %d', (value) => {
    expect(readNumber(value, LEVEL, 'level')).toBe(value)
  })

  test('accepts a decimal within its range', () => {
    expect(readNumber(0.25, VOLUME, 'volume')).toBe(0.25)
  })

  test('reads minus zero as zero', () => {
    expect(Object.is(readNumber(-0, VOLUME, 'volume'), 0)).toBe(true)
  })
})

describe('parseNumber: text that must spell a number', () => {
  test.each([
    { name: 'trailing letters', text: '12abc' },
    { name: 'letters only', text: 'abc' },
    { name: 'an empty text', text: '' },
    { name: 'spaces only', text: '   ' },
    { name: 'an exponent', text: '1e3' },
    { name: 'hexadecimal', text: '0x10' },
    { name: 'binary', text: '0b1' },
    { name: 'octal', text: '0o7' },
    { name: 'the word Infinity', text: 'Infinity' },
    { name: 'the word NaN', text: 'NaN' },
    { name: 'a plus sign', text: '+12' },
    { name: 'a double minus', text: '--1' },
    { name: 'a decimal in an integer field', text: '1.5' },
    { name: 'a trailing point', text: '1.' },
    { name: 'a leading point', text: '.5' },
    { name: 'a grouping space', text: '1 000' },
    { name: 'a grouping underscore', text: '1_000' },
    { name: 'a decimal comma', text: '1,5' },
    { name: 'full-width digits', text: '１２' },
    { name: 'Arabic-Indic digits', text: '١٢' },
    { name: 'a hidden control character', text: '12\u0000' },
    { name: 'sixteen digits', text: '1234567890123456' },
  ])('refuses $name', ({ text }) => {
    expect(problem(() => parseNumber(text, LEVEL, 'level'))).toBe('not-a-number')
  })

  test.each([
    { name: 'a number', value: 12 },
    { name: 'null', value: null },
    { name: 'an array', value: ['12'] },
  ])('refuses $name as text', ({ value }) => {
    expect(problem(() => parseNumber(value, LEVEL, 'level'))).toBe('not-text')
  })

  test.each([
    { text: ' 12 ', expected: 12 },
    { text: '007', expected: 7 },
    { text: '60', expected: 60 },
  ])('reads "$text" as $expected', ({ text, expected }) => {
    expect(parseNumber(text, LEVEL, 'level')).toBe(expected)
  })

  test('reads a decimal where the field allows one', () => {
    expect(parseNumber('0.25', VOLUME, 'volume')).toBe(0.25)
  })

  test('still checks the range once the text is a number', () => {
    expect(problem(() => parseNumber('61', LEVEL, 'level'))).toBe('out-of-range')
  })
})

describe('readText: a value that must be text', () => {
  test.each([
    { name: 'a number', value: 12 },
    { name: 'null', value: null },
    { name: 'undefined', value: undefined },
    { name: 'true', value: true },
    { name: 'an array of text', value: ['Ana'] },
    { name: 'an object that turns into text', value: { toString: () => 'Ana' } },
  ])('refuses $name', ({ value }) => {
    expect(problem(() => readText(value, NAME, 'name'))).toBe('not-text')
  })

  test.each([
    { name: 'a control character', text: 'A\u0000na', expected: 'Ana' },
    { name: 'a right-to-left override', text: 'A‮na', expected: 'Ana' },
    { name: 'a bidirectional isolate', text: 'A⁦na⁩', expected: 'Ana' },
    { name: 'a byte-order mark', text: '﻿Ana', expected: 'Ana' },
    { name: 'a zero-width space', text: 'A​na', expected: 'Ana' },
    { name: 'a lone surrogate', text: 'A\uD800na', expected: 'Ana' },
    { name: 'a tag character', text: 'A\u{E0041}na', expected: 'Ana' },
    { name: 'outer and repeated spaces', text: '  Ana   Lima ', expected: 'Ana Lima' },
    { name: 'a line break in a one-line field', text: 'Ana\r\nLima', expected: 'Ana Lima' },
    { name: 'a decomposed accent', text: 'Léa', expected: 'Léa' },
    { name: 'an invisible character inside an accent', text: 'Le​́a', expected: 'Léa' },
  ])('removes $name', ({ text, expected }) => {
    expect(readText(text, NAME, 'name')).toBe(expected)
  })

  test('keeps emoji joined by zero-width joiners', () => {
    expect(readText('👨‍👩‍👧 team', NAME, 'name')).toBe('👨‍👩‍👧 team')
  })

  test('keeps markup as written: it is escaped where it is shown', () => {
    expect(readText('<b>Ana</b>', NAME, 'name')).toBe('<b>Ana</b>')
  })

  test('keeps line breaks and tabs in a multi-line field, unified to line feeds', () => {
    const message = { maxLength: 100, multiline: true } as const
    expect(readText('One\r\nTwo\rThree\n\tFour', message, 'message')).toBe(
      'One\nTwo\nThree\n\tFour',
    )
  })

  test.each([
    { name: 'empty', text: '' },
    { name: 'blank', text: '   ' },
    { name: 'only invisible characters', text: '​‮﻿' },
  ])('refuses a required text that is $name', ({ text }) => {
    expect(problem(() => readText(text, NAME, 'name'))).toBe('empty')
  })

  test('accepts an empty text when the field is optional', () => {
    expect(readText('  ', { maxLength: 12 }, 'nickname')).toBe('')
  })

  test('counts characters, not UTF-16 units', () => {
    expect(readText('😀'.repeat(12), NAME, 'name')).toBe('😀'.repeat(12))
    expect(problem(() => readText('😀'.repeat(13), NAME, 'name'))).toBe('too-long')
  })

  test('measures the length once cleaned', () => {
    expect(readText(`  ${'a'.repeat(12)}  `, NAME, 'name')).toBe('a'.repeat(12))
    expect(problem(() => readText('a'.repeat(13), NAME, 'name'))).toBe('too-long')
  })

  test('checks an allow-list against the whole cleaned text', () => {
    const slug = { maxLength: 20, pattern: /^[a-z0-9-]+$/ } as const
    expect(readText(' game-on ', slug, 'slug')).toBe('game-on')
    expect(problem(() => readText('game on!', slug, 'slug'))).toBe('bad-format')
  })

  test.each([
    { name: 'a global pattern', pattern: /^[a-z]+$/g },
    { name: 'a sticky pattern', pattern: /^[a-z]+$/y },
    { name: 'an unanchored pattern', pattern: /[a-z]+/ },
  ])('rejects $name as a programming error', ({ pattern }) => {
    expect(() => readText('abc', { maxLength: 9, pattern }, 'slug')).toThrow(TypeError)
  })

  test.each(['A\u0000na  Lima\r\n', 'Le​́a', '﻿  ‮ x ⁩ ', 'é́'])(
    'cleans %j to a text that stays the same when cleaned again',
    (text) => {
      const once = readText(text, NAME, 'name')
      expect(readText(once, NAME, 'name')).toBe(once)
    },
  )
})

describe('readChoice and readBoolean', () => {
  const THEMES = ['light', 'dark'] as const

  test('accepts one of the choices', () => {
    expect(readChoice('dark', THEMES, 'theme')).toBe('dark')
  })

  test.each([
    { name: 'another case', value: 'DARK' },
    { name: 'a prototype key', value: '__proto__' },
    { name: 'an inherited method name', value: 'toString' },
    { name: 'a number', value: 1 },
    { name: 'null', value: null },
  ])('refuses $name', ({ value }) => {
    expect(problem(() => readChoice(value, THEMES, 'theme'))).toBe('not-a-choice')
  })

  test.each([
    { name: 'the text true', value: 'true' },
    { name: 'the number 1', value: 1 },
    { name: 'null', value: null },
  ])('refuses $name as a boolean', ({ value }) => {
    expect(problem(() => readBoolean(value, 'muted'))).toBe('not-a-boolean')
  })

  test('accepts a real boolean', () => {
    expect(readBoolean(false, 'muted')).toBe(false)
  })
})

describe('InputRecord: an object from outside, read field by field', () => {
  test.each([
    { name: 'null', value: null },
    { name: 'an array', value: [] },
    { name: 'a text', value: '{}' },
    { name: 'a number', value: 3 },
  ])('refuses $name as a record', ({ value }) => {
    expect(problem(() => InputRecord.from(value, 'save'))).toBe('not-a-record')
  })

  test('refuses text that is not JSON', () => {
    expect(problem(() => InputRecord.parse('{level: 3', 'save'))).toBe('bad-format')
  })

  test('reads typed fields from JSON', () => {
    const save = InputRecord.parse('{"level": 3, "name": " Ana ", "muted": true}', 'save')
    expect(save.number('level', LEVEL)).toBe(3)
    expect(save.text('name', NAME)).toBe('Ana')
    expect(save.boolean('muted')).toBe(true)
  })

  test('names the path of a refused field', () => {
    const state = InputRecord.parse('{"save": {"level": "3"}}', 'state')
    expect(() => state.record('save').number('level', LEVEL)).toThrow(
      'state.save.level: not-a-number',
    )
  })

  test('sees only its own fields, never inherited ones', () => {
    const save = InputRecord.from({}, 'save')
    expect(save.has('toString')).toBe(false)
    expect(problem(() => save.text('toString', NAME))).toBe('not-text')
    expect(problem(() => save.record('constructor'))).toBe('not-a-record')
  })

  test('reads a list item by item, with the index in the path', () => {
    const save = InputRecord.parse('{"stars": [3, 2, "1"]}', 'save')
    const stars = {
      maxItems: 60,
      item: (value: unknown, field: string) => readNumber(value, LEVEL, field),
    }
    expect(() => save.list('stars', stars)).toThrow('save.stars[2]: not-a-number')
  })

  test('refuses a list longer than allowed, or a field that is not a list', () => {
    const save = InputRecord.parse('{"stars": [1, 2, 3], "name": "Ana"}', 'save')
    const two = {
      maxItems: 2,
      item: (value: unknown, field: string) => readNumber(value, LEVEL, field),
    }
    expect(problem(() => save.list('stars', two))).toBe('too-many')
    expect(problem(() => save.list('name', two))).toBe('not-a-list')
  })
})

describe('orElse: a read with a fallback', () => {
  test('gives the fallback when the value is refused', () => {
    expect(orElse(() => readNumber('0.5', VOLUME, 'volume'), 0.8)).toBe(0.8)
  })

  test('gives the value when it is accepted', () => {
    expect(orElse(() => readNumber(0.5, VOLUME, 'volume'), 0.8)).toBe(0.5)
  })

  test('lets programming errors through', () => {
    const unanchored = { maxLength: 9, pattern: /[a-z]+/ } as const
    expect(() => orElse(() => readText('abc', unanchored, 'slug'), '')).toThrow(TypeError)
  })
})
