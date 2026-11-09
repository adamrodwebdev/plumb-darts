import { LENGTH, TIP_END } from './dartProfile.ts'
import { parseNumber } from './input.ts'
import { unbreakable } from './typography.ts'

/**
 * The Plumb dart's measured facts, written once and formatted by Intl in each page's language
 * (decimal comma, unit symbols, the space before %), never typed by hand into a translation. The
 * copy names them as {placeholders}, filled when the pages are built.
 */

const MILLIMETRES_PER_CENTIMETRE = 10

interface Spec {
  readonly value: number
  readonly unit?: 'millimeter' | 'gram' | 'percent'
}

export const DART_SPECS = {
  ringDepth: { value: 0.3, unit: 'millimeter' },
  ringPitch: { value: 1.2, unit: 'millimeter' },
  rings: { value: 18 },
  weight: { value: 25, unit: 'gram' },
  tungsten: { value: 0.9, unit: 'percent' },
  barrelLength: { value: 50 },
  barrelDiameter: { value: 6.6, unit: 'millimeter' },
  length: { value: LENGTH * MILLIMETRES_PER_CENTIMETRE, unit: 'millimeter' },
  // The point ends TIP_END from the centre of gravity: 38 % of the dart's length from the tip
  centreOfGravity: { value: TIP_END / LENGTH, unit: 'percent' },
  tipLength: { value: 32, unit: 'millimeter' },
  // Microns have no Intl unit: the copy says the word, Intl writes the number
  flightThickness: { value: 100 },
} as const satisfies Readonly<Record<string, Spec>>

function formatter(locale: string, spec: Spec, unitDisplay: 'short' | 'long'): Intl.NumberFormat {
  if (spec.unit === 'percent') return new Intl.NumberFormat(locale, { style: 'percent' })
  if (spec.unit)
    return new Intl.NumberFormat(locale, { style: 'unit', unit: spec.unit, unitDisplay })
  return new Intl.NumberFormat(locale)
}

/** One measure in a locale: "0.3 mm", "0,3 мм", "90 %" */
function measure(locale: string, spec: Spec, unitDisplay: 'short' | 'long' = 'short'): string {
  return unbreakable(formatter(locale, spec, unitDisplay).format(spec.value))
}

/** A measure's number and its unit symbol apart, for a figure set large: ["25", "г"] */
function numberAndUnit(locale: string, spec: Spec): readonly [string, string] {
  const parts = formatter(locale, spec, 'short').formatToParts(spec.value)
  const number = parts
    .filter((part) => part.type !== 'unit' && part.type !== 'literal')
    .map((part) => part.value)
    .join('')
  const unit = parts.find((part) => part.type === 'unit')?.value ?? ''
  return [unbreakable(number), unit]
}

export type SpecName =
  | 'ringDepth'
  | 'ringPitch'
  | 'rings'
  | 'weight'
  | 'weightValue'
  | 'weightUnit'
  | 'weightLong'
  | 'tungsten'
  | 'barrelSize'
  | 'length'
  | 'cog'
  | 'tipLength'
  | 'flightThickness'

/** Every fact the copy and the pages name, formatted for one locale */
export function formatSpecs(locale: string): Readonly<Record<SpecName, string>> {
  const [weightValue, weightUnit] = numberAndUnit(locale, DART_SPECS.weight)
  return {
    ringDepth: measure(locale, DART_SPECS.ringDepth),
    ringPitch: measure(locale, DART_SPECS.ringPitch),
    rings: measure(locale, DART_SPECS.rings),
    weight: measure(locale, DART_SPECS.weight),
    weightValue,
    weightUnit,
    weightLong: measure(locale, DART_SPECS.weight, 'long'),
    tungsten: measure(locale, DART_SPECS.tungsten),
    // The barrel's length by its diameter: "50 × 6.6 mm"
    barrelSize: `${measure(locale, DART_SPECS.barrelLength)} × ${measure(locale, DART_SPECS.barrelDiameter)}`,
    length: measure(locale, DART_SPECS.length),
    cog: measure(locale, DART_SPECS.centreOfGravity),
    tipLength: measure(locale, DART_SPECS.tipLength),
    flightThickness: measure(locale, DART_SPECS.flightThickness),
  }
}

const YEAR = { min: 2000, max: 2100, integer: true } as const
const MONTH = { min: 1, max: 12, integer: true } as const
const DAY = { min: 1, max: 31, integer: true } as const

/** A clipping's date as a newspaper's source line prints it: "12 Oct 2026", "12 oct. 2026" */
export function formatDate(locale: string, isoDate: string): string {
  const [year, month, day] = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)?.slice(1) ?? []
  const date = new Date(
    Date.UTC(
      parseNumber(year, YEAR, 'year'),
      parseNumber(month, MONTH, 'month') - 1,
      parseNumber(day, DAY, 'day'),
    ),
  )
  if (date.toISOString().slice(0, 10) !== isoDate) throw new Error(`${isoDate}: no such day`)
  return unbreakable(
    new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date),
  )
}
