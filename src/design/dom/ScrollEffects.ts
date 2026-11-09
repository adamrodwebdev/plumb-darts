import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { ChapterId } from '../../rules/chapters'
import type { ChapterRange } from '../../rules/choreography'

gsap.registerPlugin(ScrollTrigger)

/** How long each pinned chapter holds the screen, in viewport heights of scrolling */
const PIN_LENGTH: Partial<Record<ChapterId, number>> = {
  press: 1.8,
  grip: 1.2,
  weight: 1.0,
  anatomy: 1.5,
}

/** Scrub smoothing: the lag that gives the scroll story its weight */
const SCRUB = 0.6

/**
 * Scroll-driven effects, loaded only when motion is welcome: pinned chapters, colour-filled
 * titles, the weight gauge, and a smoothed scroll position for the 3D choreography.
 */
export class ScrollEffects {
  private readonly triggers = new Map<ChapterId, ScrollTrigger>()
  private readonly smoothed = { y: 0 }

  constructor(private readonly sections: readonly HTMLElement[]) {}

  init(): void {
    for (const section of this.sections) {
      const id = section.dataset['chapter'] as ChapterId
      const length = PIN_LENGTH[id]
      const trigger =
        length && section.hasAttribute('data-pin')
          ? ScrollTrigger.create({
              trigger: section,
              start: 'top top',
              end: () => `+=${Math.round(window.innerHeight * length)}`,
              pin: true,
              anticipatePin: 1,
              invalidateOnRefresh: true,
            })
          : // A chapter that scrolls through holds its pose while its top is near the screen's top
            ScrollTrigger.create({ trigger: section, start: 'top 12%', end: 'top -12%' })
      this.triggers.set(id, trigger)
    }

    for (const title of document.querySelectorAll<HTMLElement>('.fill-title')) {
      gsap.fromTo(
        title,
        { '--p': 0 },
        {
          '--p': 1,
          ease: 'none',
          scrollTrigger: { trigger: title, start: 'top 88%', end: 'top 38%', scrub: SCRUB },
        },
      )
    }

    const gauge = document.querySelector('.gauge__value')
    const weight = document.getElementById('weight')
    if (gauge && weight) {
      gsap.fromTo(
        gauge,
        { '--g': 0 },
        {
          '--g': 0.73,
          ease: 'none',
          scrollTrigger: { trigger: weight, start: 'top 70%', end: 'top top', scrub: SCRUB },
        },
      )
    }
  }

  /** Scroll ranges where each chapter holds the screen, in page order */
  ranges(): ChapterRange[] {
    return this.sections.flatMap((section) => {
      const id = section.dataset['chapter'] as ChapterId
      const trigger = this.triggers.get(id)
      return trigger ? [{ id, start: trigger.start, end: trigger.end }] : []
    })
  }

  /** A scroll position that follows the real one with the scrub's lag */
  onSmoothedScroll(listener: (y: number) => void): void {
    gsap.to(this.smoothed, {
      y: () => ScrollTrigger.maxScroll(window),
      ease: 'none',
      scrollTrigger: { start: 0, end: 'max', scrub: SCRUB, invalidateOnRefresh: true },
      onUpdate: () => listener(this.smoothed.y),
    })
  }

  /**
   * The orbit's turn across the press chapter's pin: each clipping comes to the front in turn,
   * the last one at the end of the pin (`endTurn`, in degrees)
   */
  onOrbitTurn(endTurn: number, listener: (turn: number) => void): void {
    const pin = this.triggers.get('press')
    const press = document.getElementById('press')
    if (!pin || !press) return
    const turn = { value: 0 }
    gsap.to(turn, {
      value: endTurn,
      ease: 'none',
      scrollTrigger: {
        trigger: press,
        start: () => pin.start,
        end: () => pin.end,
        scrub: SCRUB,
        invalidateOnRefresh: true,
      },
      onUpdate: () => listener(turn.value),
    })
  }

  /** Scrolls the story to the point where a clipping faces the front */
  scrollToOrbit(index: number, count: number): void {
    const pin = this.triggers.get('press')
    if (!pin || count < 2) return
    const top = pin.start + (pin.end - pin.start) * (index / (count - 1))
    window.scrollTo({ top: Math.round(top), behavior: 'smooth' })
  }

  onRefresh(listener: () => void): void {
    ScrollTrigger.addEventListener('refresh', listener)
  }

  refresh(): void {
    ScrollTrigger.refresh()
  }
}
