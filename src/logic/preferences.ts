/** Key-value storage behind an interface: localStorage in the browser, a map in tests */
export interface KeyValueStore {
  read(key: string): string | null
  write(key: string, value: string): void
}

export class BrowserStore implements KeyValueStore {
  constructor(private readonly storage: () => Storage) {}

  read(key: string): string | null {
    try {
      return this.storage().getItem(key)
    } catch {
      return null
    }
  }

  write(key: string, value: string): void {
    try {
      this.storage().setItem(key, value)
    } catch {
      // Storage blocked or full: the choice lasts for this visit only
    }
  }
}

export type Theme = 'light' | 'dark'

const THEME_KEY = 'plumb.theme'

/** Light or dark: the visitor's choice when made, the system's otherwise */
export class ThemePreference {
  constructor(
    private readonly store: KeyValueStore,
    private readonly root: HTMLElement,
    private readonly systemDark: MediaQueryList,
  ) {}

  current(): Theme {
    const chosen = this.root.dataset['theme']
    if (chosen === 'light' || chosen === 'dark') return chosen
    return this.systemDark.matches ? 'dark' : 'light'
  }

  toggle(): void {
    const next: Theme = this.current() === 'dark' ? 'light' : 'dark'
    this.root.dataset['theme'] = next
    this.store.write(THEME_KEY, next)
  }

  onSystemChange(listener: () => void): void {
    this.systemDark.addEventListener('change', listener)
  }
}

/** Whether the visitor asked their system for less motion (followed live) */
export class MotionPreference {
  private readonly listeners = new Set<(reduced: boolean) => void>()

  constructor(private readonly query: MediaQueryList) {
    query.addEventListener('change', () => {
      for (const listener of this.listeners) listener(query.matches)
    })
  }

  reduced(): boolean {
    return this.query.matches
  }

  onChange(listener: (reduced: boolean) => void): void {
    this.listeners.add(listener)
  }
}
