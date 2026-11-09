# Plumb — an immersive 3D product page that still scores 100

**Plumb is a fictional tungsten dart.** This repository tells its launch story as an award-style
immersive page — a live 3D dart, scroll-driven chapters, an exploded view, a throw you can play —
built to keep **Lighthouse at 100** in all four categories and to meet **WCAG 2.2 AA**.

It is a design and engineering demo: nothing is for sale. The name comes from the *plumbata*, the
lead-weighted throwing dart of Roman soldiers.

- Live: https://adamrodwebdev.github.io/plumb-darts/
- Status: **v0.2**, published on 2026-11-09 (see [ROADMAP.md](ROADMAP.md) and [CHANGELOG.md](CHANGELOG.md))

## What it shows

| Chapter | What happens | Pattern |
|---|---|---|
| Game on | Giant headline painted from the HTML; the 3D dart flies in front of it | text behind the object, light sweep |
| The grip | Pinned: the camera glides along the 18 ring grooves while the dart turns | scrubbed 3D camera move |
| The weight | A gauge fills to 25 g; a label tracks the centre of gravity on the model | DOM labels pinned to 3D points |
| Anatomy | The dart explodes into tip, barrel, shaft and flight, each labelled | exploded view |
| The finish | Throw three darts at the board (click, tap, or keyboard); double 20 wins | interactive proof |
| Checkout | The set of three, the honest call to action | finale |

From the grip to the checkout, the chapters travel **sideways** on any screen at least 40rem
tall: their frame sticks to the screen while the story slides left as you scroll down, each chapter
holding the screen before the next one slides in. Short screens and reduced motion keep the
stacked story.

A **501 counter** plays a leg of darts down to the checkout as the chapters go by (60, 120, then
a 180) and doubles as the chapter menu. The page's tones shift from a dark bar to a bright studio
and back through a dusk gradient. Sound is optional and made in code.

## Built to work for everyone

- **All text is real HTML**, painted before any script; the 3D canvas is decoration.
- **Keyboard and screen readers:** a skip link, a chapter menu (native popover), a target list
  and Throw button for the game, results announced politely.
- **Reduced motion:** no pinning, no scrubbing, no fly-in; each chapter shows a still pose.
- **No 3D** (no WebGL 2, WebGL drawn by the processor for want of a usable GPU, Save-Data, a
  slow device): the page keeps its content, and a drawn dart takes the 3D one's place.
- **Watchdog:** if the scene is not up within 8 s, the page falls back.
- **Light and dark themes**, following the system, with a remembered toggle.

## Languages

Six static pages, one per language, built from the same `index.html`. Nothing redirects a visitor
by their browser's language: the menu in the masthead offers the others.

| Language | Address | Speaks to the reader with |
|---|---|---|
| English (the base, and the x-default) | [/plumb-darts/](https://adamrodwebdev.github.io/plumb-darts/) | you |
| Français | [/plumb-darts/fr/](https://adamrodwebdev.github.io/plumb-darts/fr/) | vous |
| Русский | [/plumb-darts/ru/](https://adamrodwebdev.github.io/plumb-darts/ru/) | вы |
| Español | [/plumb-darts/es/](https://adamrodwebdev.github.io/plumb-darts/es/) | tú |
| Italiano | [/plumb-darts/it/](https://adamrodwebdev.github.io/plumb-darts/it/) | tu |
| Bahasa Indonesia | [/plumb-darts/id/](https://adamrodwebdev.github.io/plumb-darts/id/) | kamu |

- **Each page stands alone:** its `lang`, a translated title and description, its own canonical
  address, `og:locale` with the others as alternates, and `hreflang` links to all six languages
  plus the x-default. It embeds its own headline font subset and carries its own CSP hashes.
- **The language menu** is a native `<details>` that works without JavaScript; each language is
  named in itself, with its `lang` and `hreflang`, and the current one is marked
  `aria-current`. With JavaScript, the links carry the chapter on screen, so the reader lands on
  the same chapter in the other language.
- **Only the active language ships:** the page reads its `<html lang>` through an allow-list and
  imports its own messages (`src/i18n/locales/<code>.json`), a chunk the boot script preloads
  with the code.
- **Numbers, units and dates go through `Intl`:** the dart's measures live once in
  `src/rules/specs.ts` and each page writes them its own way (0.3 mm, 0,3 мм, 90 %), clipping dates
  too; counts follow `Intl.PluralRules` (Russian one, few and many).
- **Russian type:** Big Shoulders Display has no Cyrillic, so the Russian page sets its headlines in
  Oswald (OFL): the same cap height, and Russian letterforms by default (a closer match, Sofia Sans
  Extra Condensed, draws Bulgarian forms unless the browser applies `locl`, which Safari does not
  reliably do). It is set at 500 to keep Big Shoulders' colour, with a looser leading for Ё, Й and
  the descenders of Д, Ц and Щ. Geist Mono's Cyrillic subset sets the small print; the wordmark
  keeps the brand's face in every language.
- **The 404 page** stays in English (GitHub Pages serves one) and leads home in every language.
- **Native review:** the Russian and Indonesian copy waits for a native speaker's review.
- **Adding a language:** a line in `src/i18n/languages.ts`, its messages file and its line in
  `src/i18n/loadMessages.ts`. The unit tests then ask for every key, placeholder and plural form,
  every character in the page's fonts, and its typography; the build writes its page.

## Performance contract

1. The first paint comes from each language's page alone: inline CSS, and the hero headline,
   wordmark and score digits set in an embedded subset of that page's display face, cut from its
   own headline's glyphs at build (about 5 kB; no request, no swap).
2. The faces below the headline (titles, figures, small print) are cut at build to the characters
   of each page's language and the weights its styles use (`build/pageFonts.ts`): about 20 kB of
   fonts per page, 30 kB in Russian, instead of 59 and 80 kB for the packages' files.
3. Code is requested only once the browser reports that first paint (`build/deferredBoot.ts`).
4. The 3D scene (Three.js, about 150 kB gzip) loads only on devices that get 3D: the WebGL 2
   context is opened, and its renderer checked, before Three.js is requested, so a device whose
   processor would draw it (one frame blocked the page for 0.8 s) never downloads it, nor its
   models. The scene boots one short task at a time: renderer, light, models, textures (one task
   each), shaders compiled asynchronously.
5. The two model files download while the stage lights up: the dart (311 kB) and the board
   (497 kB, or 306 kB with a 1024 px face on phones and smaller GPUs), with meshopt geometry and
   WebP maps. Their loader (GLTFLoader and the meshopt decoder, 21 kB gzip) loads with them.
6. Render scale is capped (DPR 1.5 / 1.25 / 1 by quality tier); the scene renders only when
   something moves, and pauses in a hidden tab.

## The 3D models

The dart and the board are modelled in Blender 5.2 LTS by the author's own parametric
generators (no paid service, no third-party asset), baked onto light meshes and packed for the
web with glTF Transform and meshoptimizer (`public/models/`).

- **The dart** (`models/dart.glb`, 12,096 triangles): four nodes, `tip`, `barrel`, `shaft` and
  `flight`, around +Y with the point first and the origin at the centre of gravity, in metres.
  The 90% tungsten barrel has a gunmetal PVD coating, its 18 shark-fin rings (0.3 mm deep,
  1.2 mm apart) and a diamond-knurled zone cut through it to bright tungsten, and an orange band
  between two cut lines; the steel point is polished and grooved, with its knurled shank hidden
  in the barrel; the anodised shaft has diamond-cut rings, the threaded stud and its O-ring; the
  standard flight is folded and slightly bowed. Hidden parts show once the dart is exploded. The
  flight's print is drawn by the page in its display face.
- **The board** (`models/board.glb`, 15,142 triangles): a sisal face at the radii of the scoring
  rules (fibre, segment colours, the shadows of every wire and a few dart holes baked into one
  map, the fibre relief in a small repeated normal map), a real wire spider (round rings, blade
  wires), a number ring bent from wire and a steel rim. Thrown darts cast their shadow on it.
- **Checked on loading** (`src/design/scene/SceneModels.ts`): each file is refused above its size
  limit while it streams, then its GLB container is read before the parser sees it; the nodes
  the scene uses, their maps, a vertex and texture budget, the point's position and the board's
  radius (the scoring rules') must all be there. A refused file sends the page to its art
  without 3D, as any other failure of the scene does.

## Run it

Node 24 (LTS).

```bash
npm ci
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on http://localhost:5173 |
| `npm run build` | Production build in `dist/` (base path `/plumb-darts/`) |
| `npm run preview` | Serves the build on http://localhost:4173/plumb-darts/ |
| `npm run lint` | oxlint, then ESLint |
| `npm run typecheck` | TypeScript, app and build scripts |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | End-to-end tests (Playwright) on the build: run `npm run build` first |

## Architecture

Three layers that never mix: **rules** (pure data and functions), **logic** (state and services),
**design** (DOM, 3D, sound). `src/main.ts` is the composition root: it builds every object and
hands it what it needs — no singleton, clock and randomness injected.

```
src/
  rules/        board geometry, scoring, chapters, choreography poses, quality tiers, dart layout,
                the dart's specs (formatted by Intl per language), the model files' contract and
                their GLB reader
  logic/        ThrowSession, ChapterTracker, preferences, device probe
  design/dom/   score counter, controls, throw panel, markers, scroll effects (GSAP)
  design/scene/ Stage, SceneModels (model files, loaded and checked), DartModel, BoardModel,
                DartFlight, SceneDirector, createScene
  design/audio/ SoundEngine (Web Audio, no files)
  i18n/         locales/*.json (every visible string, six languages), the language list, the
                messages loader (one chunk per language) and the Translator (Intl plurals)
  styles/       tokens (light-dark), layout, components, motion — inlined at build
build/          Vite plugins: html i18n (a page per language), inline styles with each page's fonts
                (embedded headline subsets, faces cut to its language), deferred boot, CSP, compile
                hints; the WOFF2 coverage reader
public/models/  the dart and the board (GLB: meshopt geometry, WebP maps)
```

## Tests

`npm test` runs the unit suite (scoring rings and segments, the 501 digits, the choreography's
pose maths, quality tiers and software renderers, a seeded 3000-dart simulation of the throw, the
translator, the input readers and the GLB reader against hostile files, the build plugins, and the
shipped model files: within their limits, with the nodes the scene uses and only extensions the
page decodes). For the six languages it checks that every messages file has exactly the English
keys, the same placeholders and the plural forms `Intl.PluralRules` asks for; that no key is
orphaned; each language's typography (French no-break spaces, Russian dashes, Spanish opening
marks); that every character a page shows is in the faces that set it, read from the WOFF2 files;
and that every page has its `lang`, its canonical address and its `hreflang` links.

`npm run test:e2e` builds nothing: run `npm run build` first. Playwright then serves the build and
checks it on Chromium, Firefox, WebKit, a Pixel 7 and an iPhone 14: no console error, CSP violation
or outside request, in every language; the finish played with the keyboard alone; the cursors;
axe (WCAG 2.2 AA) in both themes in English, French and Russian, the open language menu included;
no sideways scroll from 320 to 2,560 px and a masthead on one line from 320 px, in every language;
each journey chapter's last line above the counter by the end of its hold, in every language; the
language menu by pointer, by keyboard, without JavaScript, and keeping the chapter; a stable page
length; a phone that never zooms out. It serves the build on port 4186, or on the port
`E2E_PORT` names (`E2E_PORT=4271 npm run test:e2e`). Headless browsers draw WebGL with the processor, which the page refuses: the tests
stand for a device with a GPU (`e2e/fixtures.ts`), where the scene must go live from its two model
files, and name a software renderer to check the page without 3D, which must request none.

Lighthouse runs in CI on every pull request (`lighthouserc.json`): three warm-up runs that are
not counted, then three mobile runs of the English, French and Russian pages that must all score
100 in the four categories, with the CPU
slowdown fitted to the runner's speed so that every run simulates the same phone
(`lighthouse/calibrate.mjs`). On 2026-11-09 the production build scored 100 × 4 on mobile (blocking
time 10 to 20 ms at that slowdown) and on desktop. The lab machine has no GPU, so Lighthouse scores
the page without 3D; the 3D boot was measured on a GPU instead (longest frame 65 ms, 14 ms of it
blocking, on a fast laptop).

## Branches and deployment

- `dev`: work in progress, pushed freely. Pull requests target `dev`.
- `main`: what is published. GitHub Pages deploys `main` only after its CI ends green
  (`.github/workflows/pages.yml`). `dev` is merged into `main` only to publish.

## Credits

- Type: [Big Shoulders Display](https://github.com/xotypeco/big_shoulders),
  [Geist Mono](https://github.com/vercel/geist-font) and, for Russian,
  [Oswald](https://github.com/googlefonts/OswaldFont), SIL Open Font License (texts in
  `public/fonts/`).
- 3D: [Three.js](https://threejs.org). Scroll effects: [GSAP](https://gsap.com).
- Models: made with [Blender](https://www.blender.org) by the author's own generators, packed with
  [glTF Transform](https://gltf-transform.dev) and [meshoptimizer](https://github.com/zeux/meshoptimizer).
- Design and code: [AdamRodWebDev](https://github.com/adamrodwebdev).

## Licence

Code under the [MIT licence](LICENSE). Fonts under their own SIL Open Font License.
