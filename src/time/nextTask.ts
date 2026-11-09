/** Task scheduler of the browsers that offer it: `scheduler.yield()` */
interface YieldingScheduler {
  yield(): Promise<void>
}

/**
 * A promise kept at the next task, without waiting for a frame: the work that follows is not added
 * to the current task (Lighthouse: blocking time). `scheduler.yield()` where the browser has it,
 * otherwise a message to self, without setTimeout's minimum delay.
 */
export function nextTask(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: Partial<YieldingScheduler> }).scheduler
  if (typeof scheduler?.yield === 'function') return scheduler.yield()
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      resolve()
    }
    channel.port2.postMessage(null)
  })
}

/** A promise kept after the next frame has been painted (the pending layout done first). */
export function afterNextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (document.visibilityState !== 'visible') {
      setTimeout(resolve)
      return
    }
    requestAnimationFrame(() => setTimeout(resolve))
  })
}
