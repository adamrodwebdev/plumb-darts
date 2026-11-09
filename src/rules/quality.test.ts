import { describe, expect, test } from 'vitest'
import { type DeviceHints, chooseTier, median } from './quality'

const desktop: DeviceHints = {
  cores: 16,
  memory: 8,
  saveData: false,
  narrow: false,
  webgl2: true,
  frameMs: 16.7,
}

describe('chooseTier', () => {
  test.each([
    { name: 'a capable desktop', hints: desktop, tier: 'high' },
    { name: 'a phone (narrow screen)', hints: { ...desktop, narrow: true }, tier: 'medium' },
    { name: 'a quad-core laptop', hints: { ...desktop, cores: 4 }, tier: 'medium' },
    { name: 'a device with 3 GB of memory', hints: { ...desktop, memory: 3 }, tier: 'medium' },
    { name: 'a slow device (30 ms frames)', hints: { ...desktop, frameMs: 30 }, tier: 'low' },
    { name: 'a dual-core device', hints: { ...desktop, cores: 2 }, tier: 'low' },
    { name: 'a browser without WebGL 2', hints: { ...desktop, webgl2: false }, tier: null },
    { name: 'a visitor saving data', hints: { ...desktop, saveData: true }, tier: null },
    { name: 'a device that cannot keep up (50 ms)', hints: { ...desktop, frameMs: 50 }, tier: null },
  ] as const)('gives $name the $tier tier', ({ hints, tier }) => {
    expect(chooseTier(hints)).toBe(tier)
  })
})

describe('median', () => {
  test('ignores a single long frame', () => {
    expect(median([16, 17, 16, 120, 17])).toBe(17)
  })

  test('averages the two middle values of an even list', () => {
    expect(median([10, 20, 30, 40])).toBe(25)
  })

  test('is infinite without any measure (treated as too slow)', () => {
    expect(median([])).toBe(Number.POSITIVE_INFINITY)
  })
})
