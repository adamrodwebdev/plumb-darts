import type { Translator } from '../../i18n/Translator'
import { type Chapter, MAXIMUM_VISIT, scoreDigits, visitBetween } from '../../rules/chapters'

/**
 * The score counter: a leg of 501 played down to the checkout as the chapters go by. Its button
 * opens the chapter list (a native popover, usable without the script).
 */
export class Hud {
  private readonly digits: HTMLElement[]
  private readonly chapterLabel: HTMLElement
  private readonly accessibleName: HTMLElement
  private readonly flash: HTMLElement
  private readonly menu: HTMLElement
  private readonly links: HTMLAnchorElement[]

  constructor(
    root: HTMLElement,
    private readonly translator: Translator,
    private readonly motionAllowed: () => boolean,
  ) {
    this.digits = [...root.querySelectorAll<HTMLElement>('[data-digit]')]
    this.chapterLabel = required(root, '[data-hud-chapter]')
    this.accessibleName = required(root, '[data-hud-name]')
    this.flash = required(root, '[data-hud-flash]')
    this.menu = required(root, '[popover]')
    this.links = [...root.querySelectorAll<HTMLAnchorElement>('[data-chapter-link]')]
    // A chapter link closes the list (a click outside already does: light dismiss)
    for (const link of this.links) link.addEventListener('click', () => this.closeMenu())
  }

  show(chapter: Chapter, previous: Chapter | null): void {
    this.setScore(chapter.remaining)
    const name = this.translator.t(chapter.name)
    this.chapterLabel.textContent = name
    this.accessibleName.textContent = this.translator.t('hud.current', {
      chapter: name,
      remaining: chapter.remaining,
    })
    for (const link of this.links) {
      if (link.dataset['chapterLink'] === chapter.id) link.setAttribute('aria-current', 'true')
      else link.removeAttribute('aria-current')
    }
    if (previous && visitBetween(previous, chapter) === MAXIMUM_VISIT) this.celebrate('180')
  }

  /** The leg is won: the counter drops to zero */
  gameShot(): void {
    this.setScore(0)
    this.celebrate('0')
  }

  private setScore(score: number): void {
    scoreDigits(score).forEach((digit, index) => {
      const element = this.digits[index]
      if (!element) return
      element.classList.toggle('is-blank', digit === null)
      // CSSOM, not a style attribute: the CSP forbids inline style attributes
      const strip = element.firstElementChild
      if (strip instanceof HTMLElement) strip.style.setProperty('--n', String(digit ?? 0))
    })
  }

  private celebrate(text: string): void {
    if (!this.motionAllowed()) return
    this.flash.textContent = text
    this.flash.animate(
      [
        { opacity: 0, transform: 'translateY(1rem) scale(0.6)' },
        { opacity: 1, transform: 'translateY(0) scale(1.08)', offset: 0.2 },
        { opacity: 1, transform: 'translateY(-0.25rem) scale(1)', offset: 0.7 },
        { opacity: 0, transform: 'translateY(-1rem) scale(1)' },
      ],
      { duration: 1600, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    )
  }

  private closeMenu(): void {
    if (this.menu.matches(':popover-open')) this.menu.hidePopover()
  }
}

function required(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector)
  if (!element) throw new Error(`Hud: ${selector} is missing`)
  return element
}
