import { BOARD, BOARD_COLOURS, SEGMENT_DEGREES, SEGMENTS } from '../../rules/board'
import type { RandomSource } from '../../time/random'

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

const radians = (degrees: number): number => (degrees * Math.PI) / 180

/**
 * Draws a regulation board face on a square canvas whose edge is the board's edge. Drawn in
 * board millimetres with y up (as the scoring rules), so the canvas reads upside down: uploaded
 * without flipping, it lands the right way up on the 3D face. Text is flipped back locally.
 */
export function drawBoardFace(context: Context2D, size: number, random: RandomSource): void {
  const scale = size / (2 * BOARD.edge)
  context.save()
  context.translate(size / 2, size / 2)
  context.scale(scale, scale)

  const disc = (radius: number, colour: string): void => {
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.fillStyle = colour
    context.fill()
  }
  // Clockwise from the top in board space (y up) is counter-clockwise on this canvas
  const bed = (inner: number, outer: number, index: number, colour: string): void => {
    const centre = 90 - index * SEGMENT_DEGREES
    const start = radians(centre - SEGMENT_DEGREES / 2)
    const end = radians(centre + SEGMENT_DEGREES / 2)
    context.beginPath()
    context.arc(0, 0, outer, start, end)
    context.arc(0, 0, inner, end, start, true)
    context.closePath()
    context.fillStyle = colour
    context.fill()
  }

  disc(BOARD.edge, BOARD_COLOURS.surround)
  SEGMENTS.forEach((_, index) => {
    const dark = index % 2 === 0
    const single = dark ? BOARD_COLOURS.black : BOARD_COLOURS.cream
    const ring = dark ? BOARD_COLOURS.red : BOARD_COLOURS.green
    bed(BOARD.outerBull, BOARD.trebleInner, index, single)
    bed(BOARD.trebleInner, BOARD.trebleOuter, index, ring)
    bed(BOARD.trebleOuter, BOARD.doubleInner, index, single)
    bed(BOARD.doubleInner, BOARD.doubleOuter, index, ring)
  })
  disc(BOARD.outerBull, BOARD_COLOURS.green)
  disc(BOARD.bullseye, BOARD_COLOURS.red)

  // Sisal: fine speckles of light and shade over the playing area
  for (let speck = 0; speck < 9000; speck += 1) {
    const radius = BOARD.doubleOuter * Math.sqrt(random.next())
    const angle = random.next() * Math.PI * 2
    context.fillStyle = random.next() > 0.5 ? 'rgb(0 0 0 / 0.1)' : 'rgb(255 255 255 / 0.06)'
    context.fillRect(radius * Math.cos(angle), radius * Math.sin(angle), 0.9, 0.9)
  }

  // The wire spider
  context.strokeStyle = BOARD_COLOURS.wire
  context.lineWidth = 0.9
  for (const radius of [
    BOARD.bullseye,
    BOARD.outerBull,
    BOARD.trebleInner,
    BOARD.trebleOuter,
    BOARD.doubleInner,
    BOARD.doubleOuter,
  ]) {
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.stroke()
  }
  SEGMENTS.forEach((_, index) => {
    const angle = radians(90 - index * SEGMENT_DEGREES + SEGMENT_DEGREES / 2)
    context.beginPath()
    context.moveTo(BOARD.outerBull * Math.cos(angle), BOARD.outerBull * Math.sin(angle))
    context.lineTo(BOARD.doubleOuter * Math.cos(angle), BOARD.doubleOuter * Math.sin(angle))
    context.stroke()
  })

  // Numbers on the surround, upright
  context.fillStyle = BOARD_COLOURS.number
  context.font = '700 26px Arial, Helvetica, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  SEGMENTS.forEach((segment, index) => {
    const angle = radians(90 - index * SEGMENT_DEGREES)
    context.save()
    context.translate(BOARD.numbersRadius * Math.cos(angle), BOARD.numbersRadius * Math.sin(angle))
    context.scale(1, -1)
    context.fillText(String(segment), 0, 0)
    context.restore()
  })
  context.restore()
}
