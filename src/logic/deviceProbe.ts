import { type DeviceHints, median } from '../rules/quality'

interface NavigatorHints {
  readonly hardwareConcurrency?: number
  readonly deviceMemory?: number
  readonly connection?: { readonly saveData?: boolean }
}

/** Median frame time over a few frames, in milliseconds (a busy or weak device shows here first) */
export function measureFrameTime(frames = 12): Promise<number> {
  return new Promise((resolve) => {
    if (document.visibilityState !== 'visible') {
      resolve(16.7)
      return
    }
    const deltas: number[] = []
    let last = -1
    const step = (time: number) => {
      if (last >= 0) deltas.push(time - last)
      last = time
      if (deltas.length >= frames) resolve(median(deltas))
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

/**
 * WebGL 2 in the browser. Creating a context only to test it would cost a main-thread task: once
 * the tier is known, main.ts opens the scene's own (openStageContext), which also refuses WebGL
 * drawn by the processor.
 */
function supportsWebgl2(view: Window): boolean {
  return 'WebGL2RenderingContext' in view
}

/** What the browser tells about the device, plus a measured frame time */
export async function probeDevice(view: Window): Promise<DeviceHints> {
  const hints = view.navigator as Navigator & NavigatorHints
  return {
    cores: hints.hardwareConcurrency ?? 4,
    memory: hints.deviceMemory,
    saveData: hints.connection?.saveData === true,
    narrow: !view.matchMedia('(width >= 64rem)').matches,
    webgl2: supportsWebgl2(view),
    frameMs: await measureFrameTime(),
  }
}
