/**
 * The Plumb dart's layout in centimetres, around the Y axis with the origin at the centre of
 * gravity: the point ends at +5.9 cm, 38% of the 15.5 cm length from it. The shapes themselves
 * are in the model file (models/dart.glb, made by the 3D library's gen-dart.py to these numbers).
 */
export const TIP_END = 5.9
export const LENGTH = 15.5

export type DartPart = 'tip' | 'barrel' | 'shaft' | 'flight'

/** Where each part's label points to, in the dart's own space (on its surface) */
export const PART_ANCHORS: Readonly<Record<DartPart, readonly [number, number, number]>> = {
  tip: [0, 4.4, 0.11],
  barrel: [0, 1.0, 0.33],
  shaft: [0, -4.1, 0.205],
  flight: [0, -8.1, 1.1],
}

/** How far each part travels along the axis in the exploded view (centimetres at full explode) */
export const EXPLODE_OFFSETS: Readonly<Record<DartPart, number>> = {
  tip: 2.2,
  barrel: 0,
  shaft: -2.0,
  flight: -3.8,
}
