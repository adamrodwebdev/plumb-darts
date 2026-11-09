/// <reference lib="webworker" />
import { SeededRandom } from '../../time/random'
import { drawBoardFace } from './boardFace'

/** Draws the board face off the main thread and hands back a bitmap (no long task on the page) */
self.onmessage = (event: MessageEvent<{ size: number; seed: number }>) => {
  const { size, seed } = event.data
  const canvas = new OffscreenCanvas(size, size)
  const context = canvas.getContext('2d')
  if (!context) {
    self.postMessage(null)
    return
  }
  drawBoardFace(context, size, new SeededRandom(seed))
  const bitmap = canvas.transferToImageBitmap()
  self.postMessage(bitmap, [bitmap])
}
