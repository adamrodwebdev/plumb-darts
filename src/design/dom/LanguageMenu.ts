import type { ChapterId } from '../../rules/chapters'

/**
 * The language menu of the masthead: a native <details> listing each language's page, usable
 * without the script. With it, the menu closes on Escape (the focus back on its button) or on a
 * click elsewhere, and every language's link carries the chapter on screen as its #fragment, so
 * the reader lands on the same chapter in the other language.
 */
export class LanguageMenu {
  private readonly toggle: HTMLElement | null
  private readonly links: readonly HTMLAnchorElement[]

  /** `chapter` names the chapter on screen, or null at the top of the page (no fragment) */
  constructor(
    private readonly root: HTMLDetailsElement,
    private readonly chapter: () => ChapterId | null,
  ) {
    this.toggle = root.querySelector('summary')
    this.links = [...root.querySelectorAll<HTMLAnchorElement>('a[hreflang]')]
    root.addEventListener('toggle', () => {
      if (root.open) this.carryChapter()
    })
    // The chapter may have changed while the menu stayed open
    for (const link of this.links) link.addEventListener('click', () => this.carryChapter())
    const page = root.ownerDocument
    page.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !root.open) return
      const focusInside = root.contains(page.activeElement)
      this.close()
      if (focusInside) this.toggle?.focus()
    })
    page.addEventListener('click', (event) => {
      if (root.open && event.target instanceof Node && !root.contains(event.target)) this.close()
    })
  }

  private close(): void {
    this.root.open = false
  }

  private carryChapter(): void {
    const id = this.chapter()
    for (const link of this.links) link.hash = id ? `#${id}` : ''
  }
}
