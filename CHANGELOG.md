# Changelog

All notable changes to this project are written here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The journey: chapters 3 to 7 (the grip to the checkout) travel sideways where the screen is at
  least 40rem tall and motion is welcome. Their frame sticks to the screen (CSS sticky) while a
  strip of five screens slides left as the page scrolls down, each chapter holding the screen for
  a while; the 3D dart and the board follow. The chapter menu, in-page links, an address such as
  `#weight` and keyboard focus bring each chapter on; a chapter taller than its screen (the
  finish on a phone) scrolls its text during its hold, and a focused control always shows above
  the counter. Short screens and reduced motion keep the stacked story, and turning a phone to
  landscape keeps the reader in the same chapter.
- End-to-end checks of the journey: the chapter menu, a link on arrival, focus above the counter,
  reduced motion, a screen that gets short.
- Realistic models made in Blender by our own generators (`public/models/`). The dart: a 90%
  tungsten barrel in gunmetal PVD with 18 shark-fin rings and a knurled zone cut to bright
  tungsten and an orange band; a polished, grooved steel point; an anodised aluminium shaft with
  diamond-cut rings, its thread and O-ring; a folded standard flight. Hidden parts (the point's
  shank, the shaft's thread) show in the exploded view. The board: a sisal face with fibre,
  pressed seams and a few dart holes, a real wire spider, a number ring bent from wire and a
  steel rim, at the scoring rules' radii.
- Thrown darts cast their shadow on the board (high and medium quality tiers).
- Tests: the GLB reader against hostile files; the shipped model files (size limits, nodes,
  extensions); end to end, the scene goes live from its two model files, and the page without 3D
  requests none.

### Changed

- The board slides in from the right with the finish and leaves by the left with it, receding,
  and fades only on its way out of shot: it used to vanish in one frame. The darts thrown stay
  pinned in it and leave with it, where they floated in the air.
- The dart and the board come from two model files instead of shapes built in code: 311 kB for
  the dart, 497 kB for the board (306 kB with a 1024 px face on phones and smaller GPUs), meshopt
  geometry and WebP maps, downloaded while the stage lights up; textures upload one per task.
- The board's face takes a third of the room's reflected light: under the full light its colours
  went pastel.
- The flight's wordmark reads left to right on the hero.

### Fixed

- On wide screens the board's rim covered the first letters of the finish's text (17 to 39 px from
  1024 to 1920 px wide): the camera now keeps it clear of the words.
- Playing the finish with the keyboard: the Throw button kept the focus only by chance. It was
  disabled while the dart flew, and a disabled button loses the focus (Chrome hands it to the
  page), so the next Enter went nowhere. It now waits as `aria-disabled`; after the last dart the
  focus moves on to Collect the darts, then back to Throw.

### Removed

- The board face drawn in a Web Worker, the turned profiles of the dart, and the quality and
  colour settings only they used.

### Security

- Model files are checked at the door: refused above their size limit while they stream, their
  GLB container read before the parser, then their nodes, maps, vertex and texture budget, the
  point's position and the board's radius checked; a refused file leaves the page without 3D.
- Content Security Policy: `'wasm-unsafe-eval'` lets three's meshopt decoder compile its
  WebAssembly (eval stays refused), `connect-src` adds `blob:` for the images GLTFLoader reads back
  from its own blob URLs, and `worker-src` is now `'none'` (no worker left).

## [0.2.0] - 2026-11-09

First published version, on GitHub Pages. Lighthouse 100 in the four categories on mobile
(worst of three runs, locally and in CI) and on desktop.

### Added

- "Trusted on the oche": six sample press clippings orbiting their headline in CSS 3D, turned by
  the scroll, with Previous and Next buttons. It prototypes the Halloween press ring planned for
  Skull Darts 71. Flat grid without script or with reduced motion; a cover flow on phones.
- End-to-end tests (Playwright) on Chromium, Firefox, WebKit and two phones: no error, CSP
  violation or outside request down to the end of the story; the finish played with the keyboard
  alone; the cursors; the 404 page; axe (WCAG 2.2 AA) in light and dark; no sideways scroll from
  320 to 2,560 px and at 320 × 256; a stable page length; a phone that never zooms the page out.
  They run in CI on every pull request, standing for a device with a GPU, and check the page
  without 3D by naming a software renderer.
- Lighthouse in CI on every pull request: 100 in the four categories on the worst of three mobile
  runs, after three warm-up runs, with the CPU slowdown fitted to the runner's speed.

### Changed

- Each chapter has its own composition instead of one left column: diagonal hero, centred
  press, grip on the right, a centred band for the weight, a split title for the anatomy, the
  finish on the right, a centred checkout.
- The 3D dart follows each composition, and leaves the stage during the press orbit.
- The page no longer stretches (labels clipped to their chapter); thrown darts land tail up; the
  counter is compact on phones.
- 3D needs WebGL 2 drawn by a GPU: the context is opened, and its renderer checked, before
  Three.js is requested. Where the processor would draw it (no usable GPU; lab machines such as
  Lighthouse's), the page keeps its art: one software frame blocked the page for 0.8 s.
- Without 3D, the drawn dart takes the 3D one's place across the headline and flies in; it stays
  out of the flow, so showing it never moves the page.
- The scroll effects start one task per chapter: their eight triggers in one task blocked a phone
  for 99 ms.

### Fixed

- `vite preview` served the build under `/` instead of `/plumb-darts/`: every local preview fell
  back to the home page without its scripts.
- Without WebGL 2 (no GPU, a blocked one, Firefox on a CI runner) the page goes on without 3D
  silently: the stage creates the context itself, where three.js logged two console errors first.
- The drawn dart no longer pushed the headline up once the device was known (layout shift 0.08).
- On phones, the drawn dart flying in from the right no longer zoomed the whole page out and back
  in (layout shift 0.32): the hero clips what it draws sideways.
- Clippings turning away on the press ring no longer show faint text: their print leaves before
  their paper fades (back cards read at 1.5 to 2.9 : 1, under the 4.5 : 1 of WCAG 1.4.3).

### Security

- Data from outside is checked at the door (`src/rules/input.ts`): a number must be a finite number
  within its range, a text must be a string, cleaned of invisible characters and within its
  length; nothing is coerced. The aim-target check no longer accepts inherited keys such as
  `toString` or `__proto__`, and the board face worker checks its message and its reply.
- minimatch pinned to 11.0.5 for the dev tools (ESLint, typescript-eslint): the moderate advisory
  GHSA-g3hv-75wg-m249 is fixed and `npm audit` finds nothing.
- The policy drops `upgrade-insecure-requests`: GitHub Pages serves HTTPS only and every URL is
  relative, so it upgraded nothing there, while over plain HTTP (a preview on the local network,
  WebKit even on localhost) it sent the scripts and fonts to an address that does not answer.

## [0.1.0] - 2026-11-09

### Added

- Prototype of the Plumb page: six chapters (game on, grip, weight, anatomy, the finish,
  checkout), the 501 counter with its chapter menu, and the night → steel → studio → dusk arc.
- Procedural 3D scene: the dart's turned parts, a board face drawn in a Web Worker, thrown darts
  that arc, spin and wobble, labels pinned to the model, an exploded view.
- The finish: three darts at double 20, playable by pointer or keyboard, results announced.
- Optional sound made with the Web Audio API.
- Performance contract: first paint from the HTML (inline CSS, embedded hero font subset),
  code requested after the first paint, 3D booted in short tasks, render on demand.
- Reduced-motion and no-3D versions, an 8-second watchdog, light and dark themes.
- Content Security Policy by hash in each page; unit tests (70).

[Unreleased]: https://github.com/adamrodwebdev/plumb-darts/compare/v0.2.0...dev
[0.2.0]: https://github.com/adamrodwebdev/plumb-darts/releases/tag/v0.2.0
