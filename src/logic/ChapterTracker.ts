import { type Chapter, CHAPTERS, chapterById } from '../rules/chapters'

export type ChapterListener = (chapter: Chapter, previous: Chapter) => void

/**
 * The chapter on screen: the one crossing the middle of the viewport. Works the same whether a
 * chapter is pinned (it stays across the middle line) or scrolls through.
 */
export class ChapterTracker {
  private current: Chapter = CHAPTERS[0] as Chapter
  private readonly listeners = new Set<ChapterListener>()
  private readonly observer: IntersectionObserver

  constructor(sections: readonly HTMLElement[]) {
    this.observer = new IntersectionObserver((entries) => this.update(entries), {
      rootMargin: '-50% 0px -50% 0px',
    })
    for (const section of sections) this.observer.observe(section)
  }

  chapter(): Chapter {
    return this.current
  }

  onChange(listener: ChapterListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private update(entries: readonly IntersectionObserverEntry[]): void {
    const entering = entries.filter((entry) => entry.isIntersecting).at(-1)
    if (!entering) return
    const next = chapterById((entering.target as HTMLElement).dataset['chapter'] ?? '')
    if (!next || next.id === this.current.id) return
    const previous = this.current
    this.current = next
    for (const listener of this.listeners) listener(next, previous)
  }
}
