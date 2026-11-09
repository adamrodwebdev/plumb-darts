export interface ScreenPoint {
  readonly x: number
  readonly y: number
  readonly visible: boolean
}

export type MarkerVisibility = Readonly<Record<'cog' | 'parts', number>>

/** Which side of its anchor a label sits, with a leader line between them */
const SIDES: ReadonlyMap<string, 'above' | 'below'> = new Map([
  ['tip', 'above'],
  ['barrel', 'below'],
  ['shaft', 'above'],
  ['flight', 'below'],
  ['cog', 'below'],
])

/**
 * Labels pinned to points of the 3D dart (its parts, its centre of gravity). The labels are the
 * page's own text: without 3D they stay a plain list, with it they follow the model.
 */
export class MarkerLayer {
  private readonly markers: HTMLElement[]

  constructor(root: ParentNode) {
    this.markers = [...root.querySelectorAll<HTMLElement>('[data-anchor]')]
    for (const marker of this.markers) {
      // A map, not an object: an attribute such as `toString` finds nothing instead of a method
      marker.classList.add(`marker--${SIDES.get(marker.dataset['anchor'] ?? '') ?? 'below'}`)
    }
  }

  anchors(): string[] {
    return this.markers.map((marker) => marker.dataset['anchor'] ?? '')
  }

  /** Places every label from screen points; reads all layout first, then writes */
  update(points: ReadonlyMap<string, ScreenPoint>, visibility: MarkerVisibility): void {
    const origins = this.markers.map((marker) => {
      const parent = marker.offsetParent
      return parent ? parent.getBoundingClientRect() : { left: 0, top: 0 }
    })
    this.markers.forEach((marker, index) => {
      const anchor = marker.dataset['anchor'] ?? ''
      const point = points.get(anchor)
      const origin = origins[index]
      const shown = anchor === 'cog' ? visibility.cog : visibility.parts
      if (!point || !origin || !point.visible || shown < 0.02) {
        marker.style.setProperty('--o', '0')
        return
      }
      marker.style.setProperty('--x', String(Math.round(point.x - origin.left)))
      marker.style.setProperty('--y', String(Math.round(point.y - origin.top)))
      // Where the label's frame starts on screen: CSS keeps a label below the masthead, which is
      // fixed to the screen, not to the chapter (a stacked chapter scrolls past it)
      marker.style.setProperty('--top', String(Math.round(origin.top)))
      marker.style.setProperty('--o', shown.toFixed(2))
    })
  }

  hideAll(): void {
    for (const marker of this.markers) marker.style.setProperty('--o', '0')
  }
}
