import type { ScreenBand } from '../../rules/choreography'

/**
 * The room a phone's hero leaves above its text, in fractions of the screen's height: from the
 * masthead's bottom to the hero's first line, as it stands when the page is at its top.
 */
export function readHeroBand(page: ParentNode, view: Window): ScreenBand | null {
  const masthead = page.querySelector('.masthead')
  const first = page.querySelector('.hero > *')
  const height = view.innerHeight
  if (!masthead || !first || height <= 0) return null
  const top = masthead.getBoundingClientRect().bottom / height
  const bottom = (first.getBoundingClientRect().top + view.scrollY) / height
  return Number.isFinite(top) && Number.isFinite(bottom) && bottom > top ? { top, bottom } : null
}

/** Gives the band now, again once the fonts are in, and after each resize (one read a frame) */
export function watchHeroBand(
  page: ParentNode,
  view: Window,
  listener: (band: ScreenBand) => void,
): void {
  let queued = false
  const measure = (): void => {
    queued = false
    const band = readHeroBand(page, view)
    if (band) listener(band)
  }
  const queue = (): void => {
    if (queued) return
    queued = true
    view.requestAnimationFrame(measure)
  }
  measure()
  void view.document.fonts.ready.then(queue)
  view.addEventListener('resize', queue, { passive: true })
}
