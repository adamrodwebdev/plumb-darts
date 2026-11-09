import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { type ChapterId, chapterById } from '../../rules/chapters'
import type { ChapterRange } from '../../rules/choreography'
import {
  JOURNEY_CHAPTERS,
  JOURNEY_HOLDS,
  JOURNEY_MOVE,
  type JourneyPlan,
  type JourneyStop,
  planJourney,
} from '../../rules/journey'
import { nextTask } from '../../time/nextTask'
import { cssPixels } from './cssPixels'

gsap.registerPlugin(ScrollTrigger)

/** How long each pinned chapter holds the screen in the stacked story, in viewport heights */
const PIN_LENGTH: Partial<Record<ChapterId, number>> = {
  press: 1.8,
  grip: 1.2,
  weight: 1.0,
  anatomy: 1.5,
}

/** Scrub smoothing: the lag that gives the scroll story its weight */
const SCRUB = 0.6

/** The weight gauge's needle at the dart's 25 g, on a dial that reads 0 to 30 g (0 to 1) */
const GAUGE_END = 25 / 30

/** Where in a hold a jump lands: just inside it, so the chapter is already the current one */
const LANDING = 0.02

/** A chapter that scrolls through holds its pose while its top is this near the screen's top */
const THROUGH_ZONE = 0.12

/**
 * A chapter taller than its screen (the game on a phone) scrolls its text up during its hold:
 * from this share of the hold, over this share of it
 */
const READ_DELAY = 0.1
const READ_SPAN = 0.8

/** Room kept under a focused control brought into view, in pixels */
const FOCUS_MARGIN = 16

/** A chapter's own text block, the part that scrolls when the chapter is taller than its screen */
function textOf(panel: HTMLElement): HTMLElement | null {
  return panel.querySelector<HTMLElement>('.chapter__text')
}

/** Where an element's bottom sits below its chapter's top, without the text's own scrolling */
function bottomIn(panel: HTMLElement, element: Element, text: HTMLElement): number {
  const shift = gsap.getProperty(text, 'y')
  const scrolled = typeof shift === 'number' ? shift : 0
  return element.getBoundingClientRect().bottom - scrolled - panel.getBoundingClientRect().top
}

/**
 * The height a chapter's content may use: the part of its screen that shows (a chapter sized in
 * svh can be taller than the window, as in WebKit's iPhone, 736 against 664 px), less the room
 * kept for the counter
 */
function roomOf(panel: HTMLElement): number {
  const shown = Math.min(panel.clientHeight, window.innerHeight)
  return shown - cssPixels(getComputedStyle(panel).paddingBottom)
}

/** How far a chapter's text reaches below its room, in pixels (0 when it fits) */
function overflowOf(panel: HTMLElement, text: HTMLElement): number {
  return Math.max(0, Math.ceil(bottomIn(panel, text, text) - roomOf(panel)))
}

/**
 * Pinning wraps a chapter in a spacer, and every refresh takes it out and puts it back: Chromium
 * takes the keyboard focus off a control that moves in the page (the finish's Throw button lost it
 * during the boot, and with it the next Enter, 2026-11-09). The control gets it back, unscrolled.
 */
function giveBackFocus(focused: Element | null): void {
  if (!(focused instanceof HTMLElement) || focused === document.body || !focused.isConnected) return
  if (document.activeElement !== focused) focused.focus({ preventScroll: true })
}

/** Runs a change that may move pinned chapters in the page, keeping the keyboard focus in place */
function keepingFocus<T>(change: () => T): T {
  const focused = document.activeElement
  const result = change()
  giveBackFocus(focused)
  return result
}

/** The chapter a section names, checked against the list (the attribute is only text) */
function chapterOf(element: Element): ChapterId | undefined {
  return element instanceof HTMLElement
    ? chapterById(element.dataset['chapter'] ?? '')?.id
    : undefined
}

/**
 * The journey's elements: the journey itself (as tall as its scrolling, while it travels
 * sideways), its frame sticking to the screen, and the strip sliding inside the frame
 */
export interface JourneyElements {
  readonly root: HTMLElement
  readonly frame: HTMLElement
  readonly track: HTMLElement
}

export interface ScrollEffectsOptions {
  readonly sections: readonly HTMLElement[]
  readonly journey: JourneyElements | null
  /** Screens where the journey travels sideways (tall enough for a chapter to fit one screen) */
  readonly sideways: MediaQueryList
  /** The journey chapter the visitor came to, whose fragment the head script kept aside */
  readonly arrival: ChapterId | null
}

/**
 * Scroll-driven effects, loaded only when motion is welcome: pinned chapters, the sideways journey
 * of chapters 3 to 7 where the screen is tall enough, colour-filled titles, the weight gauge, the
 * press orbit, and a smoothed scroll position for the 3D choreography. Laid out again when the
 * screen crosses the journey's height (a phone turned to landscape).
 */
export class ScrollEffects {
  private readonly sections: readonly HTMLElement[]
  private readonly journey: JourneyElements | null
  private readonly sideways: MediaQueryList
  private readonly arrival: ChapterId | null
  private readonly plan: JourneyPlan = planJourney(JOURNEY_CHAPTERS, JOURNEY_HOLDS, JOURNEY_MOVE)
  private readonly triggers = new Map<ChapterId, ScrollTrigger>()
  private readonly smoothed = { y: 0 }
  private context = gsap.context(() => undefined)
  private journeyScroll: ScrollTrigger | null = null
  private journeyTimeline: gsap.core.Timeline | null = null
  private orbit: { readonly endTurn: number; readonly listener: (turn: number) => void } | null =
    null
  /** The chapter a jump landed on, and the control it must show (focus), kept until the reader moves */
  private landing: { readonly id: ChapterId; readonly show: Element | null } | null = null
  private refreshQueued = false
  /** The chapter on screen the last time the page came to rest, kept for a change of layout */
  private resting: ChapterId | null = null
  private generation = 0
  /** While the triggers are rebuilt, the page's geometry is only half there: no landing then */
  private laying = false

  constructor(options: ScrollEffectsOptions) {
    this.sections = options.sections
    this.journey = options.journey
    this.sideways = options.sideways
    this.arrival = options.arrival
  }

  /** Lays the story out, then follows the screen's height, in-page links, focus and history */
  async init(): Promise<void> {
    await this.layOut()
    // Each trigger measured itself as it came: a full refresh (a long task on a phone, 118 ms in
    // Lighthouse) only when a jump must land exactly, in a task of its own
    if (this.arrival || window.location.hash) {
      await nextTask()
      ScrollTrigger.refresh()
    }
    // A refresh moves pinned chapters (the press) out of their spacer and back: the focused control
    // gets its focus back. And it keeps the old pixels: a jump holds its chapter until the reader moves
    let focusedBefore: Element | null = null
    ScrollTrigger.addEventListener('refreshInit', () => {
      focusedBefore = document.activeElement
      // The journey's height first: every trigger after it is measured with it
      this.sizeJourney()
    })
    ScrollTrigger.addEventListener('refresh', () => {
      giveBackFocus(focusedBefore)
      this.land()
    })
    if (document.fonts.status !== 'loaded')
      void document.fonts.ready.then(() => ScrollTrigger.refresh())
    // A chapter's text that grows (the finish's log after a throw) scrolls further in its hold
    const texts = new ResizeObserver(() => this.queueRecount())
    for (const id of JOURNEY_CHAPTERS) {
      const panel = document.getElementById(id)
      const block = panel ? textOf(panel) : null
      if (block) texts.observe(block)
    }
    for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const) {
      window.addEventListener(type, () => (this.landing = null), { passive: true })
    }
    if (this.arrival) this.arrive(this.arrival)
    else this.revealHash()
    // Where the reader rests, read while nothing moves the page: when the screen crosses the
    // journey's height, Chromium may move the page and refresh the triggers before this hears of
    // it, and the position then named the chapter before (2026-11-09)
    ScrollTrigger.addEventListener('scrollEnd', () => this.rest())
    this.rest()
    this.sideways.addEventListener('change', () => void this.relayOut())
    document.addEventListener('click', (event) => this.followLink(event))
    window.addEventListener('hashchange', () => this.revealHash())
    this.journey?.root.addEventListener('focusin', (event) => this.revealFocus(event))
  }

  /** Scroll ranges where each chapter holds the screen, in page order */
  ranges(): ChapterRange[] {
    return this.sections.flatMap((section) => {
      const id = chapterOf(section)
      if (!id) return []
      const stop = this.journeyStop(id)
      if (stop) return [stop]
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
   * the last one at the end of the pin (`endTurn`, in degrees). Kept across layouts.
   */
  onOrbitTurn(endTurn: number, listener: (turn: number) => void): void {
    this.orbit = { endTurn, listener }
    this.context.add(() => this.turnOrbit())
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

  /**
   * One task per chapter: each trigger measures the page (a forced layout), and eight of them in
   * one task blocked a phone for 99 ms (Lighthouse, 2026-11-09). A newer layout stops an older one.
   */
  private async layOut(): Promise<void> {
    this.generation += 1
    const generation = this.generation
    this.laying = true
    try {
      await this.build(generation)
    } finally {
      if (generation === this.generation) this.laying = false
    }
  }

  private async build(generation: number): Promise<void> {
    keepingFocus(() => this.context.revert())
    this.context = gsap.context(() => undefined)
    this.triggers.clear()
    this.journeyScroll = null
    this.journeyTimeline = null
    const journey = this.sideways.matches ? this.journey : null
    this.journey?.root.classList.toggle('is-sideways', journey !== null)
    this.sizeJourney()

    for (const section of this.sections) {
      const id = chapterOf(section)
      if (!id || (journey && JOURNEY_CHAPTERS.includes(id))) continue
      this.context.add(() =>
        keepingFocus(() => this.triggers.set(id, this.chapterTrigger(section, id))),
      )
      await nextTask()
      if (generation !== this.generation) return
    }
    if (journey) {
      this.context.add(() => keepingFocus(() => this.travel(journey)))
      await nextTask()
      if (generation !== this.generation) return
    }
    this.context.add(() => {
      this.fillTitles(journey)
      this.fillGauge(journey)
      this.turnOrbit()
    })
  }

  /** After the screen crossed the journey's height: the same chapter, in the new layout */
  private async relayOut(): Promise<void> {
    const chapter = this.resting ?? this.chapterAt(window.scrollY)
    // Held from now: the refresh after the resize would put back the old pixels
    if (chapter) this.landing = { id: chapter, show: null }
    await this.layOut()
    ScrollTrigger.refresh()
    this.land()
  }

  private chapterTrigger(section: HTMLElement, id: ChapterId): ScrollTrigger {
    const length = PIN_LENGTH[id]
    return length && section.hasAttribute('data-pin')
      ? ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          end: () => `+=${Math.round(window.innerHeight * length)}`,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        })
      : // A chapter that scrolls through holds its pose while its top is near the screen's top
        ScrollTrigger.create({
          trigger: section,
          start: `top ${THROUGH_ZONE * 100}%`,
          end: `top -${THROUGH_ZONE * 100}%`,
        })
  }

  /**
   * While the journey travels sideways it is as tall as its scrolling plus one screen, so its
   * frame sticks to the screen for exactly the plan; stacked, it takes its content's height
   */
  private sizeJourney(): void {
    const journey = this.journey
    if (!journey) return
    if (!journey.root.classList.contains('is-sideways')) {
      journey.root.style.removeProperty('height')
      return
    }
    const height = this.plan.length * window.innerHeight + journey.frame.offsetHeight
    journey.root.style.setProperty('height', `${Math.round(height)}px`)
  }

  /**
   * The sideways journey: the frame sticks to the screen for the whole plan (CSS, no script pin),
   * and the strip slides one screen to the left between two holds. One timeline unit is one
   * screen of scrolling.
   */
  private travel({ root, frame, track }: JourneyElements): void {
    const timeline = gsap.timeline()
    for (const [index, stop] of this.plan.stops.entries()) {
      const previous = this.plan.stops[index - 1]
      if (!previous) continue
      // From one screen to the next, both ends given: measured again, a slide never starts from
      // wherever the strip happens to be
      timeline.fromTo(
        track,
        { x: () => -(index - 1) * frame.clientWidth },
        {
          x: () => -index * frame.clientWidth,
          duration: stop.start - previous.end,
          ease: 'power2.inOut',
          immediateRender: false,
        },
        previous.end,
      )
      // Each chapter's title fills as its screen slides in (the first one fills on the way up)
      const title = document.getElementById(stop.id)?.querySelector('.fill-title')
      if (title) {
        timeline.fromTo(
          title,
          { '--p': 0 },
          { '--p': 1, duration: stop.start - previous.end, ease: 'none' },
          previous.end,
        )
      }
    }
    // A chapter taller than its screen scrolls its text up while it holds the screen
    for (const stop of this.plan.stops) {
      const panel = document.getElementById(stop.id)
      const text = panel ? textOf(panel) : null
      if (!panel || !text) continue
      const hold = stop.end - stop.start
      timeline.fromTo(
        text,
        { y: 0 },
        { y: () => -overflowOf(panel, text), duration: hold * READ_SPAN, ease: 'none' },
        stop.start + hold * READ_DELAY,
      )
    }
    // The timeline lasts the whole plan, so scrolling maps onto it one screen per unit
    timeline.set({}, {}, this.plan.length)

    const gauge = document.querySelector('.gauge__value')
    const weight = this.plan.stops.find((stop) => stop.id === 'weight')
    if (gauge && weight) {
      timeline.fromTo(
        gauge,
        { '--g': 0 },
        { '--g': GAUGE_END, duration: JOURNEY_MOVE, ease: 'none' },
        Math.max(0, weight.start - JOURNEY_MOVE / 2),
      )
    }

    this.journeyTimeline = timeline
    this.sizeJourney()
    this.journeyScroll = ScrollTrigger.create({
      trigger: root,
      start: 'top top',
      end: () => `+=${Math.round(this.plan.length * window.innerHeight)}`,
      scrub: SCRUB,
      animation: timeline,
      invalidateOnRefresh: true,
    })
  }

  /** Titles fill as they come up the screen; inside the journey, as their screen slides in */
  private fillTitles(journey: JourneyElements | null): void {
    const first = document.getElementById(JOURNEY_CHAPTERS[0] ?? '')
    for (const title of document.querySelectorAll<HTMLElement>('.fill-title')) {
      const travelling =
        journey !== null && journey.track.contains(title) && !first?.contains(title)
      if (travelling) continue
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
  }

  /** The gauge rises to 25 g as the weight chapter arrives (inside the journey: its timeline) */
  private fillGauge(journey: JourneyElements | null): void {
    const gauge = document.querySelector('.gauge__value')
    const weight = document.getElementById('weight')
    if (!gauge || !weight || journey) return
    gsap.fromTo(
      gauge,
      { '--g': 0 },
      {
        '--g': GAUGE_END,
        ease: 'none',
        scrollTrigger: { trigger: weight, start: 'top 70%', end: 'top top', scrub: SCRUB },
      },
    )
  }

  private turnOrbit(): void {
    const pin = this.triggers.get('press')
    const press = document.getElementById('press')
    if (!this.orbit || !pin || !press) return
    const { endTurn, listener } = this.orbit
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

  /** A journey chapter's hold in scroll pixels, while the journey travels sideways */
  private journeyStop(id: ChapterId): ChapterRange | null {
    const pin = this.journeyScroll
    const stop: JourneyStop | undefined = this.plan.stops.find((candidate) => candidate.id === id)
    if (!pin || !stop || this.plan.length <= 0) return null
    const unit = (pin.end - pin.start) / this.plan.length
    return { id, start: pin.start + stop.start * unit, end: pin.start + stop.end * unit }
  }

  /** Notes the chapter on screen, unless the layout is being rebuilt */
  private rest(): void {
    if (this.laying) return
    this.resting = this.landing?.id ?? this.panelOnScreen() ?? this.chapterAt(window.scrollY)
  }

  /** The journey chapter on screen, read from where the panels are */
  private panelOnScreen(): ChapterId | null {
    const frame = this.journey?.frame.getBoundingClientRect()
    const middle = window.innerHeight / 2
    if (!this.journeyScroll || !frame || frame.top > middle || frame.bottom < middle) return null
    let nearest: ChapterId | null = null
    let distance = Number.POSITIVE_INFINITY
    for (const id of JOURNEY_CHAPTERS) {
      const left = document.getElementById(id)?.getBoundingClientRect().left
      if (left === undefined || Math.abs(left) >= distance) continue
      distance = Math.abs(left)
      nearest = id
    }
    return nearest
  }

  /** The chapter holding the screen at a scroll position (the last one started) */
  private chapterAt(scroll: number): ChapterId | null {
    let current: ChapterId | null = null
    for (const range of this.ranges()) if (range.start <= scroll) current = range.id
    return current
  }

  /**
   * Brings a journey chapter on screen, its text scrolled by `reading` (0 to 1 of what does not
   * fit); false when the browser's own anchor jump is right
   */
  private goTo(id: ChapterId, behavior: ScrollBehavior, reading = 0): boolean {
    const stop = this.journeyStop(id)
    if (!stop) return false
    const share = reading > 0 ? READ_DELAY + READ_SPAN * Math.min(1, reading) : LANDING
    const top = stop.start + (stop.end - stop.start) * share
    window.scrollTo({ top: Math.round(top), behavior })
    return true
  }

  /**
   * Jumps at once to a chapter (its hold in the journey, its top otherwise) and holds that place
   * through the next layouts, until the reader scrolls, touches, clicks or types
   */
  private landOn(id: ChapterId, show: Element | null = null): void {
    this.landing = { id, show }
    this.land()
  }

  /**
   * The journey's values measured again on the next frame (how far each text scrolls), however
   * many sizes changed in this one. Not a full refresh, which measures the whole page again
   */
  private queueRecount(): void {
    if (this.refreshQueued) return
    this.refreshQueued = true
    requestAnimationFrame(() => {
      this.refreshQueued = false
      const timeline = this.journeyTimeline
      if (!timeline) return
      const time = timeline.time()
      timeline.invalidate()
      timeline.time(time, true)
    })
  }

  /** How far into its text's scrolling a chapter must be for a control in it to show (0 to 1) */
  private readingFor(id: ChapterId, show: Element | null): number {
    const panel = document.getElementById(id)
    const text = panel ? textOf(panel) : null
    if (!panel || !text || !show || !text.contains(show)) return 0
    const overflow = overflowOf(panel, text)
    if (overflow <= 0) return 0
    const needed = bottomIn(panel, show, text) + FOCUS_MARGIN - roomOf(panel)
    return Math.max(0, needed) / overflow
  }

  /** After the page was measured again: back to the chapter a jump landed on */
  private land(): void {
    if (this.laying || !this.landing) return
    const { id, show } = this.landing
    if (this.goTo(id, 'instant', this.readingFor(id, show))) return
    // Stacked: from the chapter's trigger, never from where it shows (a pinned chapter shows at
    // the top wherever the page is, and comes back down once the pin lets go)
    const trigger = this.triggers.get(id)
    if (!trigger) return
    const top = trigger.pin ? trigger.start : trigger.start + window.innerHeight * THROUGH_ZONE
    window.scrollTo({ top: Math.round(top), behavior: 'instant' })
  }

  /** An in-page link to a journey chapter: its hold, and the reading position moves there */
  private followLink(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null
    const id = link instanceof HTMLAnchorElement ? chapterById(link.hash.slice(1))?.id : undefined
    if (!id || !this.goTo(id, 'smooth')) return
    event.preventDefault()
    history.pushState(null, '', `#${id}`)
    // Where a native jump would leave it: the next Tab starts in the chapter
    const section = document.getElementById(id)
    section?.setAttribute('tabindex', '-1')
    section?.focus({ preventScroll: true })
  }

  /** The chapter the visitor came to: its place in the journey, and its fragment back */
  private arrive(id: ChapterId): void {
    history.replaceState(history.state, '', `#${id}`)
    this.landOn(id)
  }

  /** The address names a journey chapter (on arrival, or back and forward) */
  private revealHash(): void {
    const id = chapterById(window.location.hash.slice(1))?.id
    // Outside the sideways journey the browser's own jump is right
    if (id && this.journeyStop(id)) this.landOn(id)
  }

  /**
   * Keyboard focus moved into a chapter that is off screen, or below what its screen shows: bring
   * the chapter on, its text scrolled just enough to show the focused control
   */
  private revealFocus(event: FocusEvent): void {
    const target = event.target
    // Stacked, the browser scrolls a focused control into view itself
    if (!this.journeyScroll || !(target instanceof Element)) return
    const panel = target.closest('[data-chapter]')
    const id = panel ? chapterOf(panel) : undefined
    if (!(panel instanceof HTMLElement) || !id || panel === target) return
    const box = panel.getBoundingClientRect()
    const onScreen = Math.abs(box.left) < 1
    // Above the counter fixed at the bottom of the screen, never under it (WCAG 2.4.11)
    const shown = target.getBoundingClientRect().bottom <= box.top + roomOf(panel) - FOCUS_MARGIN
    if (onScreen && shown) return
    // After the browser's own scroll to the focused control: WebKit does it once the focus events
    // are dispatched, from where the control sat before the pin, and undid this landing (seen
    // 2026-11-09)
    requestAnimationFrame(() => this.landOn(id, target))
  }
}
