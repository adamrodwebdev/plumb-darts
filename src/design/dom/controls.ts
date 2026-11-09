import type { ThemePreference } from '../../logic/preferences'
import type { SoundEngine } from '../audio/SoundEngine'

/** Light/dark switch: shows the theme it leads to, remembers the choice */
export class ThemeToggle {
  constructor(
    private readonly button: HTMLButtonElement,
    private readonly theme: ThemePreference,
  ) {
    button.addEventListener('click', () => {
      theme.toggle()
      this.render()
    })
    theme.onSystemChange(() => this.render())
    this.render()
    button.classList.add('is-ready')
  }

  private render(): void {
    const dark = this.theme.current() === 'dark'
    this.button.dataset['showing'] = dark ? 'sun' : 'moon'
    const label = dark ? this.button.dataset['labelLight'] : this.button.dataset['labelDark']
    this.button.setAttribute('aria-label', label ?? '')
  }
}

/** Sound on or off; off by default, and the audio only starts on this click */
export class SoundToggle {
  constructor(
    private readonly button: HTMLButtonElement,
    private readonly sound: SoundEngine,
  ) {
    button.addEventListener('click', () => {
      sound.setEnabled(!sound.isEnabled())
      this.render()
      sound.play('tick')
    })
    this.render()
    button.classList.add('is-ready')
  }

  private render(): void {
    this.button.setAttribute('aria-pressed', String(this.sound.isEnabled()))
  }
}

/** Polite announcements for screen readers (throw results) */
export class Announcer {
  constructor(private readonly region: HTMLElement) {}

  say(text: string): void {
    // Emptied first, so the same sentence twice is still announced twice
    this.region.textContent = ''
    requestAnimationFrame(() => {
      this.region.textContent = text
    })
  }
}

/**
 * Entrances that replay each time an element comes back on screen. Only below the hero: nothing
 * of the first screen waits for the script to appear.
 */
export function revealOnScroll(root: ParentNode): void {
  const groups = root.querySelectorAll<HTMLElement>('.chapter:not(.chapter--hero), .footer')
  const targets: HTMLElement[] = []
  for (const group of groups) {
    const items = group.querySelectorAll<HTMLElement>(
      '.kicker, .chapter__body, .specs__item, .gauge, .throw-panel, .actions, .footer__grid',
    )
    items.forEach((item, index) => {
      item.dataset['reveal'] = ''
      item.style.setProperty('--i', String(index))
      targets.push(item)
    })
  }
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.classList.toggle('is-in', entry.isIntersecting)
    },
    { rootMargin: '0px 0px -8% 0px' },
  )
  for (const target of targets) observer.observe(target)
}
