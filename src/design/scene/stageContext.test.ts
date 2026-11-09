import { describe, expect, test } from 'vitest'
import { type RendererSource, rendererOf } from './stageContext'

const RENDERER = 0x1f01
const UNMASKED_RENDERER = 0x9246
const UNMASKED_VENDOR = 0x9245

/** A context as a browser shows it: its RENDERER, and its debug extension if it offers one */
class FakeContext implements RendererSource {
  readonly RENDERER = RENDERER
  readonly extensionsAsked: string[] = []

  constructor(
    private readonly plain: unknown,
    private readonly unmasked: unknown,
    private readonly offersDebug = true,
  ) {}

  getParameter(name: GLenum): unknown {
    if (name === RENDERER) return this.plain
    if (name === UNMASKED_RENDERER) return this.unmasked
    return null
  }

  getExtension(name: 'WEBGL_debug_renderer_info'): WEBGL_debug_renderer_info | null {
    this.extensionsAsked.push(name)
    return this.offersDebug
      ? { UNMASKED_RENDERER_WEBGL: UNMASKED_RENDERER, UNMASKED_VENDOR_WEBGL: UNMASKED_VENDOR }
      : null
  }
}

const SWIFTSHADER =
  'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'

describe('rendererOf', () => {
  test('reads the name Chrome and Safari keep behind the debug extension', () => {
    expect(rendererOf(new FakeContext('WebKit WebGL', SWIFTSHADER))).toBe(SWIFTSHADER)
  })

  test('takes the name Firefox gives as RENDERER, without asking for the deprecated extension', () => {
    const firefox = new FakeContext('llvmpipe, or similar', null)

    expect(rendererOf(firefox)).toBe('llvmpipe, or similar')
    expect(firefox.extensionsAsked).toEqual([])
  })

  test('gives an unknown name when the masked renderer has no debug extension', () => {
    expect(rendererOf(new FakeContext('WebKit WebGL', SWIFTSHADER, false))).toBe('')
  })

  test.each([
    { name: 'not text', value: 42 },
    { name: 'missing', value: null },
    { name: 'longer than 256 characters', value: `SwiftShader ${'x'.repeat(256)}` },
  ])('gives an unknown name when the browser sends one $name', ({ value }) => {
    expect(rendererOf(new FakeContext('WebKit WebGL', value))).toBe('')
  })

  test('cleans invisible characters out of the name before it is matched', () => {
    expect(rendererOf(new FakeContext('WebKit WebGL', 'Swift​Shader'))).toBe('SwiftShader')
  })
})
