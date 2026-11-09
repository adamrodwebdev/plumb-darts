/// <reference lib="webworker" />
import { InputRecord, orElse } from '../../rules/input'
import { SeededRandom } from '../../time/random'
import { drawBoardFace } from './boardFace'

/** The face is a square texture: from a thumbnail to the largest size a GPU is asked for */
const SIZE = { min: 64, max: 4096, integer: true } as const
const SEED = { min: 0, max: 2 ** 32 - 1, integer: true } as const

interface FaceRequest {
  readonly size: number
  readonly seed: number
}

/** A message is only data until its fields are checked: anything else gets no face */
function readRequest(data: unknown): FaceRequest | null {
  return orElse(() => {
    const message = InputRecord.from(data, 'boardFace')
    return { size: message.number('size', SIZE), seed: message.number('seed', SEED) }
  }, null)
}

/** Draws the board face off the main thread and hands back a bitmap (no long task on the page) */
self.onmessage = (event: MessageEvent<unknown>) => {
  const request = readRequest(event.data)
  const canvas = request ? new OffscreenCanvas(request.size, request.size) : null
  const context = canvas?.getContext('2d')
  if (!request || !canvas || !context) {
    self.postMessage(null)
    return
  }
  drawBoardFace(context, request.size, new SeededRandom(request.seed))
  const bitmap = canvas.transferToImageBitmap()
  self.postMessage(bitmap, [bitmap])
}
