import { orElse, readText } from '../../rules/input'
import { type QualitySettings, drawnBySoftware } from '../../rules/quality'

/** The longest renderer name read; a longer one counts as unknown */
const RENDERER_MAX_LENGTH = 256

/** What Chrome and Safari give as RENDERER: it names no GPU, the debug extension does */
const MASKED_RENDERER = 'WebKit WebGL'

/**
 * Opens the stage's WebGL 2 context before three.js is even requested, or gives null when the
 * browser has none or would draw it with the processor. The page then keeps its art without 3D
 * at once: a device without a usable GPU (and a lab machine such as Lighthouse's) would otherwise
 * freeze for most of a second on each frame. The attributes are the ones three.js asks for.
 */
export function openStageContext(
  canvas: HTMLCanvasElement,
  quality: QualitySettings,
): WebGL2RenderingContext | null {
  const context = canvas.getContext('webgl2', {
    alpha: true,
    depth: true,
    stencil: false,
    antialias: quality.antialias,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
    // Refuses some software fallbacks early; SwiftShader in a headless Chrome still opens (seen
    // 2026-11-09), hence the renderer's name below
    failIfMajorPerformanceCaveat: true,
  })
  if (!context || drawnBySoftware(rendererOf(context))) return null
  return context
}

/** The GPU's name: Firefox gives it as RENDERER, Chrome and Safari behind the debug extension */
function rendererOf(context: WebGL2RenderingContext): string {
  const plain = rendererName(context.getParameter(context.RENDERER))
  if (plain !== '' && plain !== MASKED_RENDERER) return plain
  const debug = context.getExtension('WEBGL_debug_renderer_info')
  return debug ? rendererName(context.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : plain
}

/** A name from the browser, read as text like any value from outside; unknown when refused */
function rendererName(value: unknown): string {
  return orElse(() => readText(value, { maxLength: RENDERER_MAX_LENGTH }, 'renderer'), '')
}
