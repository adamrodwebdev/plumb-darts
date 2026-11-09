import type { Translator } from '../../i18n/Translator'
import { frontCard, orbitSlots } from '../../rules/orbit'
import type { Announcer } from './controls'

/**
 * Press clippings orbiting the headline in CSS 3D. The page's own list of articles: flat without
 * the script or with reduced motion; with them, a ring the scroll turns, plus Previous and Next
 * buttons that move the story to a clipping (keyboard and screen readers included).
 */
export class OrbitCarousel {
  private readonly ring: HTMLElement
  private readonly cards: HTMLElement[]
  private readonly status: HTMLElement
  private readonly controls: HTMLElement
  private current = 0
  private navigate: ((index: number) => void) | null = null

  constructor(
    private readonly root: HTMLElement,
    private readonly translator: Translator,
    private readonly announcer: Announcer,
  ) {
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

  /** Places the clippings around the ring; `navigate` moves the story to a clipping */
  enable(navigate: (index: number) => void): void {
    orbitSlots(this.cards.length).forEach((slot, index) => {
      const card = this.cards[index]
      if (!card) return
      card.style.setProperty('--a', `${slot.angle}deg`)
      card.style.setProperty('--lift', `${slot.lift}rem`)
      card.style.setProperty('--tilt', `${slot.tilt}deg`)
    })
    this.navigate = navigate
    this.root.classList.add('is-3d')
    this.controls.classList.add('is-ready')
    this.renderStatus()
  }

  /** Turns the ring (degrees); the status names the clipping in front */
  setTurn(turn: number): void {
    this.ring.style.setProperty('--turn', `${turn.toFixed(2)}deg`)
    const front = frontCard(turn, this.cards.length)
    if (front === this.current) return
    this.current = front
    this.renderStatus()
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
