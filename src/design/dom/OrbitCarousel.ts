import type { Translator } from '../../i18n/Translator'
import {
  FULL_SIZE,
  fitRing,
  frontCard,
  orbitSlots,
  type RingFit,
  type Span,
  turnFor,
} from '../../rules/orbit'
import type { Announcer } from './controls'
import { cssPixels } from './cssPixels'

/**
 * Press clippings orbiting the headline in CSS 3D. The page's own list of articles: flat without
 * the script, with reduced motion or on a screen too short for it; otherwise a ring the scroll
 * turns, plus Previous and Next buttons that move the story to a clipping (keyboard and screen
 * readers included). The ring's scene is scaled and centred in its stage so that every clipping,
 * brought to the front, stays inside it.
 */
export class OrbitCarousel {
  private readonly stage: HTMLElement
  private readonly title: HTMLElement
  private readonly ring: HTMLElement
  private readonly cards: HTMLElement[]
  private readonly status: HTMLElement
  private readonly controls: HTMLElement
  /** A new size of the orbit (the screen turned, the window resized): fitted again */
  private readonly resize = new ResizeObserver(() => {
    if (this.root.clientWidth === this.size.width && this.root.clientHeight === this.size.height)
      return
    this.fit()
  })
  private size = { width: 0, height: 0 }
  private current = 0
  private turn = 0
  private fitted: RingFit = FULL_SIZE
  private navigate: ((index: number) => void) | null = null

  constructor(
    private readonly root: HTMLElement,
    private readonly translator: Translator,
    private readonly announcer: Announcer,
  ) {
    this.stage = required(root, '[data-orbit-stage]')
    this.title = required(root, '.orbit__title')
    this.ring = required(root, '[data-orbit-ring]')
    this.cards = [...this.ring.children].filter((card) => card instanceof HTMLElement)
    this.status = required(root, '[data-orbit-status]')
    this.controls = required(root, '[data-orbit-controls]')
    required<HTMLButtonElement>(root, '[data-orbit-previous]').addEventListener('click', () =>
      this.go(this.current - 1),
    )
    required<HTMLButtonElement>(root, '[data-orbit-next]').addEventListener('click', () =>
      this.go(this.current + 1),
    )
    // A link or control inside a clipping that takes the focus brings that clipping to the front
    this.ring.addEventListener('focusin', (event) => {
      const index = this.cards.findIndex((card) => card.contains(event.target as Node))
      if (index >= 0 && index !== this.current) this.navigate?.(index)
    })
  }

  count(): number {
    return this.cards.length
  }

  /**
   * Places the clippings around the ring, a ring wherever `screen` matches (a flat grid
   * elsewhere, followed as the screen turns); `navigate` moves the story to a clipping
   */
  enable(navigate: (index: number) => void, screen: MediaQueryList): void {
    orbitSlots(this.cards.length).forEach((slot, index) => {
      const card = this.cards[index]
      if (!card) return
      card.style.setProperty('--a', `${slot.angle}deg`)
      card.style.setProperty('--lift', `${slot.lift}rem`)
      card.style.setProperty('--tilt', `${slot.tilt}deg`)
    })
    this.navigate = navigate
    this.controls.classList.add('is-ready')
    this.renderStatus()
    this.shape(screen.matches)
    screen.addEventListener('change', (event) => this.shape(event.matches))
    // The headline's face, once loaded, changes the scene's height
    const fonts = this.root.ownerDocument.fonts
    if (fonts.status !== 'loaded') void fonts.ready.then(() => this.fit())
    this.resize.observe(this.root)
  }

  /** Turns the ring (degrees); the status names the clipping in front */
  setTurn(turn: number): void {
    this.turn = turn
    this.ring.style.setProperty('--turn', `${turn.toFixed(2)}deg`)
    const front = frontCard(turn, this.cards.length)
    if (front === this.current) return
    this.current = front
    this.renderStatus()
  }

  /** A ring, fitted to its stage, or the flat grid */
  private shape(ring: boolean): void {
    this.root.classList.toggle('is-3d', ring)
    this.fit()
  }

  /**
   * Scales and centres the scene in its stage, from where the headline and the clippings reach
   * with each clipping brought to the front in turn. Read in one task, so no turn is ever painted.
   */
  private fit(): void {
    if (!this.root.classList.contains('is-3d') || this.cards.length === 0) return
    let scene = this.measureScene()
    // On a phone the headline sits above the ring: the ring is made as tall as its clippings
    // reach, so none climbs onto the headline, nor leaves a gap under it, in any language. The
    // clippings sit in the middle of the ring: a ring taller by 2 px lowers them by 1 px.
    const above = getComputedStyle(this.title).position === 'static'
    for (let round = 0; above && round < 3; round += 1) {
      const gap = (scene.cards.top - scene.title.bottom) / this.fitted.scale
      const change = 2 * (cssPixels(getComputedStyle(this.title).marginBlockEnd) - gap)
      if (Math.abs(change) < 1) break
      const height = Math.max(0, Math.round(this.ring.offsetHeight + change))
      this.ring.style.setProperty('--ring-height', `${height}px`)
      scene = this.measureScene()
    }
    const extent = {
      top: Math.min(scene.title.top, scene.cards.top),
      bottom: Math.max(scene.title.bottom, scene.cards.bottom),
    }
    const next = fitRing(extent, this.stageBand(), this.fitted)
    this.fitted = {
      scale: Math.round(next.scale * 10_000) / 10_000,
      shift: Math.round(next.shift * 100) / 100,
    }
    this.stage.style.setProperty('--fit', String(this.fitted.scale))
    this.stage.style.setProperty('--shift', `${this.fitted.shift}px`)
    // The size this fit is for, the ring's own height included
    this.size = { width: this.root.clientWidth, height: this.root.clientHeight }
  }

  /**
   * Where the headline reaches on screen, and where the clippings reach with each one brought to
   * the front in turn (all of them: the faded ones behind must not cover the intro either)
   */
  private measureScene(): { readonly title: Span; readonly cards: Span } {
    const count = this.cards.length
    const headline = this.title.getBoundingClientRect()
    let top = Number.POSITIVE_INFINITY
    let bottom = Number.NEGATIVE_INFINITY
    for (let front = 0; front < count; front += 1) {
      this.ring.style.setProperty('--turn', `${turnFor(front, count)}deg`)
      for (const card of this.cards) {
        const box = card.getBoundingClientRect()
        top = Math.min(top, box.top)
        bottom = Math.max(bottom, box.bottom)
      }
    }
    this.ring.style.setProperty('--turn', `${this.turn.toFixed(2)}deg`)
    return { title: { top: headline.top, bottom: headline.bottom }, cards: { top, bottom } }
  }

  /** The stage's own box on screen, before its scale and shift (the band the scene may use) */
  private stageBand(): Span {
    const top = this.root.getBoundingClientRect().top + this.stage.offsetTop
    return { top, bottom: top + this.stage.offsetHeight }
  }

  private go(index: number): void {
    const count = this.cards.length
    if (count === 0) return
    const target = (index + count) % count
    this.navigate?.(target)
    this.announcer.say(this.statusFor(target))
  }

  private renderStatus(): void {
    this.status.textContent = this.statusFor(this.current)
  }

  private statusFor(index: number): string {
    const outlet = this.cards[index]?.querySelector('.clipping__outlet')?.textContent ?? ''
    return this.translator.t('press.status', { index: index + 1, count: this.cards.length, outlet })
  }
}

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`OrbitCarousel: ${selector} is missing`)
  return element
}
