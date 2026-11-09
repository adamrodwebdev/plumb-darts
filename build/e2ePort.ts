import { parseNumber } from '../src/rules/input.ts'

/** The port the end-to-end suite serves the build on, unless E2E_PORT names another */
export const DEFAULT_E2E_PORT = 4186

const PORT = { min: 1024, max: 65535, integer: true } as const

/**
 * The port from the environment, read at the door: unset means the default; anything else must be
 * a whole port number above the system range, written as digits alone ("4271"), or the run stops
 * there instead of serving on a port nobody asked for.
 */
export function e2ePort(value: string | undefined): number {
  return value === undefined ? DEFAULT_E2E_PORT : parseNumber(value, PORT, 'E2E_PORT')
}
