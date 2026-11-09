export type Tier = 'high' | 'medium' | 'low'

export interface QualitySettings {
  /** Render scale cap: sharp enough, never the full 3× of a phone */
  readonly maxPixelRatio: number
  readonly antialias: boolean
  /** Board face texture size in pixels: it picks the board's model file (rules/models.ts) */
  readonly boardTexture: number
  /** Thrown darts cast their shadow on the board (one shadow map, 1024 px) */
  readonly shadows: boolean
}

export const QUALITY: Readonly<Record<Tier, QualitySettings>> = {
  high: { maxPixelRatio: 1.5, antialias: true, boardTexture: 2048, shadows: true },
  medium: { maxPixelRatio: 1.25, antialias: true, boardTexture: 1024, shadows: true },
  low: { maxPixelRatio: 1, antialias: false, boardTexture: 1024, shadows: false },
}

export interface DeviceHints {
  readonly cores: number
  /** navigator.deviceMemory in GB, when the browser tells */
  readonly memory: number | undefined
  readonly saveData: boolean
  readonly narrow: boolean
  readonly webgl2: boolean
  /** Median frame time measured at start, in milliseconds */
  readonly frameMs: number
}

/** The 3D tier for this device, or null to keep the page without 3D (the fallback art) */
export function chooseTier(hints: DeviceHints): Tier | null {
  if (!hints.webgl2 || hints.saveData || hints.frameMs > 45) return null
  const lowMemory = hints.memory !== undefined && hints.memory < 4
  if (hints.frameMs > 25 || hints.cores <= 2 || (hints.memory !== undefined && hints.memory < 2)) {
    return 'low'
  }
  if (hints.narrow || hints.cores <= 4 || lowMemory) return 'medium'
  return 'high'
}

/**
 * WebGL drawn by the processor instead of a GPU: SwiftShader (Chrome without a usable GPU, lab
 * machines such as Lighthouse's), llvmpipe and lavapipe (Linux), Windows' basic render driver,
 * Apple's software renderer. One frame of the scene there blocked the page for 0.8 s (2026-11-09).
 */
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|lavapipe|softpipe|software|basic render driver/i

/** Whether a WebGL renderer name is drawn by the processor; an unknown name ('') is not */
export function drawnBySoftware(renderer: string): boolean {
  return SOFTWARE_RENDERER.test(renderer)
}

/** Median of measured frame times (ignores the outliers a single long frame brings) */
export function median(values: readonly number[]): number {
  if (values.length === 0) return Number.POSITIVE_INFINITY
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}
