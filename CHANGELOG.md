# Changelog

All notable changes to this project are written here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- "Trusted on the oche": six sample press clippings orbiting their headline in CSS 3D, turned by
  the scroll, with Previous and Next buttons. It prototypes the Halloween press ring planned for
  Skull Darts 71. Flat grid without script or with reduced motion; a cover flow on phones.

### Changed

- Each chapter has its own composition instead of one left column: diagonal hero, centred
  press, grip on the right, a centred band for the weight, a split title for the anatomy, the
  finish on the right, a centred checkout.
- The 3D dart follows each composition, and leaves the stage during the press orbit.
- The page no longer stretches (labels clipped to their chapter); thrown darts land tail up; the
  counter is compact on phones.

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
