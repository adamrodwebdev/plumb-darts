import { SoundEngine } from './design/audio/SoundEngine'
import { Announcer, SoundToggle, ThemeToggle, revealOnScroll } from './design/dom/controls'
import { Hud } from './design/dom/Hud'
import { LanguageMenu } from './design/dom/LanguageMenu'
import { MarkerLayer } from './design/dom/MarkerLayer'
import { OrbitCarousel } from './design/dom/OrbitCarousel'
import type { JourneyElements, ScrollEffects } from './design/dom/ScrollEffects'
import { ThrowPanel } from './design/dom/ThrowPanel'
import type { SceneHandle } from './design/scene/createScene'
import { openStageContext } from './design/scene/stageContext'
import { languageOf } from './i18n/languages'
import { loadMessages } from './i18n/loadMessages'
import { Translator } from './i18n/Translator'
import { ChapterTracker } from './logic/ChapterTracker'
import { probeDevice } from './logic/deviceProbe'
import { BrowserStore, MotionPreference, ThemePreference } from './logic/preferences'
import { ThrowSession } from './logic/ThrowSession'
import type { Layout } from './rules/choreography'
import { CHAPTERS, chapterById } from './rules/chapters'
import { JOURNEY_MEDIA } from './rules/journey'
import { turnFor } from './rules/orbit'
import { QUALITY, chooseTier } from './rules/quality'
import { performanceClock } from './time/clock'
import { nextTask } from './time/nextTask'
import { SeededRandom } from './time/random'

/** If the 3D scene is not on screen by then, the page stays without it (readable and complete) */
const WATCHDOG_MS = 8000

function required<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector)
  if (!element) throw new Error(`${selector} is missing from the page`)
  return element
}

/**
 * Composition root: every object is built here and handed what it needs. The work is cut into
 * short tasks, in order of importance: controls and navigation, the game, scroll effects, 3D.
 */
async function start(view: Window): Promise<void> {
  const page = view.document
  const root = page.documentElement
  root.classList.add('js')

  // The page's language, read through the allow-list: its messages are their own chunk, which the
  // boot script preloads with the code
  const language = languageOf(root.lang)
  const translator = new Translator(await loadMessages(language.code), language.intl)
  const clock = performanceClock
  const random = new SeededRandom(view.crypto.getRandomValues(new Uint32Array(1))[0] ?? 1)
  const motion = new MotionPreference(view.matchMedia('(prefers-reduced-motion: reduce)'))
  const theme = new ThemePreference(
    new BrowserStore(() => view.localStorage),
    root,
    view.matchMedia('(prefers-color-scheme: dark)'),
  )
  const sound = new SoundEngine(random)
  const motionAllowed = (): boolean => !motion.reduced()

  // 1. Controls and navigation
  new ThemeToggle(required(page, '[data-theme-toggle]'), theme)
  new SoundToggle(required(page, '[data-sound-toggle]'), sound)
  const announcer = new Announcer(required(page, '[data-announcer]'))
  const sections = [...page.querySelectorAll<HTMLElement>('[data-chapter]')]
  const tracker = new ChapterTracker(sections)
  const hud = new Hud(required(page, '.hud'), translator, motionAllowed)
  hud.show(tracker.chapter(), null)
  root.dataset['currentTone'] = tracker.chapter().tone
  root.classList.add('has-sky')
  tracker.onChange((chapter, previous) => {
    root.dataset['currentTone'] = chapter.tone
    hud.show(chapter, previous)
  })
  // Another language opens on the chapter on screen (the first one needs no fragment)
  new LanguageMenu(required(page, '[data-lang-menu]'), () => {
    const id = tracker.chapter().id
    return id === CHAPTERS[0]?.id ? null : id
  })
  await nextTask()

  // 2. The finish works from here, in text; the 3D darts join it later
  const session = new ThrowSession(random)
  const panel = new ThrowPanel(required(page, '[data-throw-panel]'), session, translator, announcer, {
    onGameShot: () => hud.gameShot(),
  })
  await nextTask()

  // 3. 3D or not, decided before any layout depends on it: a capable device whose WebGL 2 a GPU
  // draws (the context is the scene's own, opened before three.js is requested)
  const wanted = chooseTier(await probeDevice(view))
  const context = wanted ? openStageContext(required(page, '[data-stage]'), QUALITY[wanted]) : null
  const tier = context ? wanted : null
  const markers = new MarkerLayer(page)
  root.classList.add(tier ? 'has-3d' : 'no-3d')

  // The journey chapter the visitor came to, kept aside by the head script (build/inline/arrival.js)
  const arrival = chapterById(root.dataset['arrival'] ?? '')?.id ?? null
  delete root.dataset['arrival']

  // 4. Scroll effects, only when motion is welcome
  let effects: ScrollEffects | null = null
  if (motionAllowed()) {
    root.classList.add('motion-ok')
    revealOnScroll(page)
    // The orbit takes its 3D height before the pins are measured
    const orbitRoot = page.querySelector<HTMLElement>('[data-orbit]')
    const orbit = orbitRoot ? new OrbitCarousel(orbitRoot, translator, announcer) : null
    orbit?.enable((index) => effects?.scrollToOrbit(index, orbit.count()))
    await nextTask()
    const { ScrollEffects } = await import('./design/dom/ScrollEffects')
    // The module's evaluation (GSAP) is a task of its own, then each chapter's trigger
    await nextTask()
    effects = new ScrollEffects({
      sections,
      journey: journeyOf(page),
      sideways: view.matchMedia(JOURNEY_MEDIA),
      arrival,
    })
    await effects.init()
    if (orbit) effects.onOrbitTurn(turnFor(orbit.count() - 1, orbit.count()), (turn) => orbit.setTurn(turn))
  }
  const progress = required<HTMLElement>(page, '[data-boot-progress]')
  if (arrival && !effects) {
    // Motion turned off since the head script ran: the browser's own jump, done here
    view.history.replaceState(view.history.state, '', `#${arrival}`)
    page.getElementById(arrival)?.scrollIntoView({ block: 'start' })
  }
  if (!tier || !context) {
    // Nothing more to load: the page is complete, its scroll effects included
    progress.classList.add('is-done')
    return
  }

  // 5. The 3D scene
  const setProgress = (value: number): void => {
    progress.style.setProperty('--progress', value.toFixed(2))
  }
  let settled = false
  const fallBack = (): void => {
    settled = true
    root.classList.remove('has-3d')
    root.classList.add('no-3d')
    progress.classList.add('is-done')
    markers.hideAll()
    effects?.refresh()
  }
  const watchdog = setTimeout(() => {
    if (!settled) fallBack()
  }, WATCHDOG_MS)

  try {
    setProgress(0.2)
    const { createScene } = await import('./design/scene/createScene')
    setProgress(0.35)
    const wide = view.matchMedia('(width >= 64rem)')
    const layout = (): Layout => (wide.matches ? 'wide' : 'narrow')
    const scene = await createScene({
      context,
      quality: QUALITY[tier],
      layout: layout(),
      clock,
      random,
      sound,
      markers,
      motion: motionAllowed,
      onProgress: setProgress,
    })
    if (settled) return
    settled = true
    clearTimeout(watchdog)

    wide.addEventListener('change', () => scene.director.setLayout(layout()))
    tracker.onChange((chapter) => scene.director.setChapter(chapter.id))
    scene.director.setChapter(tracker.chapter().id)
    if (effects) {
      const scroll = effects
      // The set leaves over half a screen of scrolling once the checkout has been shown
      const applyRanges = (): void =>
        scene.director.setRanges(scroll.ranges(), view.innerHeight * 0.5)
      applyRanges()
      scroll.onRefresh(applyRanges)
      scroll.onSmoothedScroll((y) => scene.director.setScroll(y))
      scene.director.setScroll(view.scrollY)
    } else {
      scene.director.showChapter(tracker.chapter().id)
      // Reduced motion: the dart is gone as soon as the closing dusk comes on screen
      const dusk = page.querySelector('.dusk')
      if (dusk) {
        new IntersectionObserver(([entry]) => {
          if (entry?.isIntersecting) scene.director.showExit()
          else scene.director.showChapter(tracker.chapter().id)
        }).observe(dusk)
      }
    }
    panel.attachStage(scene)
    wireAimPad(page, scene, panel)
    scene.onContextLost(fallBack)

    setProgress(1)
    progress.classList.add('is-done')
    scene.reveal()
  } catch {
    // The scene failed to build: the page keeps its content and fallback art
    clearTimeout(watchdog)
    if (!settled) fallBack()
  }
}

/** Chapters 3 to 7's journey, its sticky frame and its strip, when the page has them */
function journeyOf(page: ParentNode): JourneyElements | null {
  const root = page.querySelector<HTMLElement>('[data-journey]')
  const frame = page.querySelector<HTMLElement>('[data-journey-frame]')
  const track = page.querySelector<HTMLElement>('[data-journey-track]')
  return root && frame && track ? { root, frame, track } : null
}

/** Pointer aiming over the 3D board: the pad follows the board's circle on screen */
function wireAimPad(page: Document, scene: SceneHandle, panel: ThrowPanel): void {
  const pad = required<HTMLElement>(page, '[data-aim-pad]')
  const reticle = pad.firstElementChild instanceof HTMLElement ? pad.firstElementChild : null
  scene.onRender(() => {
    const circle = scene.boardCircle()
    pad.classList.toggle('is-live', circle !== null)
    if (!circle) return
    pad.style.setProperty('--cx', circle.cx.toFixed(1))
    pad.style.setProperty('--cy', circle.cy.toFixed(1))
    pad.style.setProperty('--r', circle.r.toFixed(1))
  })
  pad.addEventListener('pointermove', (event) => {
    const box = pad.getBoundingClientRect()
    reticle?.style.setProperty('--ax', String(event.clientX - box.left))
    reticle?.style.setProperty('--ay', String(event.clientY - box.top))
  })
  pad.addEventListener('click', (event) => {
    const point = scene.boardPointAt(event.clientX, event.clientY)
    if (point) void panel.throwAt(point)
  })
}

void start(window)
