import { orElse, parseNumber } from '../../rules/input'

/** A computed length longer than this is not one the page sets */
const MAX_PIXELS = 100_000

/**
 * A computed CSS length in pixels ('72px', '4.5px'), read strictly like any value from outside;
 * 0 when it is not a plain pixel length ('auto', '1e3px', '-4px', '')
 */
export function cssPixels(value: string): number {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value)
  return match ? orElse(() => parseNumber(match[1], { min: 0, max: MAX_PIXELS }, 'css length'), 0) : 0
}
