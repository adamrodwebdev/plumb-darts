# Changelog

All notable changes to this project are written here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

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
