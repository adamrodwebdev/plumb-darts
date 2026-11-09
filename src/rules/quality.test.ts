import { describe, expect, test } from 'vitest'
import { type DeviceHints, chooseTier, drawnBySoftware, median } from './quality'

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

describe('drawnBySoftware', () => {
  test.each([
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'Google SwiftShader',
    'llvmpipe (LLVM 15.0.7, 256 bits)',
    'Mesa/X.org, llvmpipe (LLVM 12.0.0, 256 bits)',
    'ANGLE (Mesa, lavapipe (LLVM 15.0.7, 256 bits), Vulkan 1.3)',
    'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Apple Software Renderer',
  ])('knows %s is drawn by the processor', (renderer) => {
    expect(drawnBySoftware(renderer)).toBe(true)
  })

  test.each([
    'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU (0x00002860) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (AMD, AMD Radeon 780M Graphics (0x00001900) Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'Adreno (TM) 740',
    'Mali-G78 MC14',
    'Apple GPU',
    'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
    '',
  ])('lets %s draw the scene', (renderer) => {
    expect(drawnBySoftware(renderer)).toBe(false)
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
