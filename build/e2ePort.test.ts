import { describe, expect, test } from 'vitest'
import { InvalidInput } from '../src/rules/input.ts'
import { DEFAULT_E2E_PORT, e2ePort } from './e2ePort.ts'

describe('e2ePort: the end-to-end server’s port, from E2E_PORT', () => {
  test('keeps the default when the variable is unset', () => {
    expect(e2ePort(undefined)).toBe(DEFAULT_E2E_PORT)
  })

  test.each([
    { text: '4271', port: 4271 },
    { text: '1024', port: 1024 },
    { text: '65535', port: 65535 },
    { text: ' 4271 ', port: 4271 },
  ])('reads "$text" as $port', ({ text, port }) => {
    expect(e2ePort(text)).toBe(port)
  })

  test.each([
    '',
    '1023',
    '65536',
    '0',
    '-4271',
    '4271.5',
    '4271abc',
    '4e3',
    '0x10AF',
    '+4271',
    'NaN',
    'Infinity',
    '4 271',
    '４２７１',
  ])('refuses %j instead of guessing a port', (text) => {
    expect(() => e2ePort(text)).toThrow(InvalidInput)
  })
})
