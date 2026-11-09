# Roadmap

Agreed with the user on 2026-11-09: a fictional dart brand, a public repository on GitHub Pages,
and the first working prototype standing in for the static mockup.

## Goal

Prove that an award-level immersive page (live 3D, scroll story, interaction, sound) can keep
**Lighthouse 100** in the four categories (mobile, worst of three runs) and meet **WCAG 2.2 AA**,
on a real phone. Patterns come from the playbook in
`Desktop/Code/claude/.helpers/immersive-web-design/immersive-3d-web.md`.

## v0.1 — Prototype (done)

- ✅ Six chapters: hero, grip (pinned camera move), weight (gauge, centre-of-gravity label),
  anatomy (exploded view with labels), the finish (three darts at double 20), checkout
- ✅ 501 counter as progress and chapter menu; tonal arc night → steel → studio → dusk
- ✅ Procedural 3D (no model files): turned dart parts, worker-drawn board, thrown-dart flights
- ✅ Deferred boot, inline CSS, embedded hero font subset, CSP by hash, compile hints
- ✅ Reduced motion, no-3D fallback, watchdog, light and dark themes, optional sound
- ✅ Unit tests (70): scoring, chapters, choreography, quality, throw simulation, plugins
- ✅ Visual review by the user: phone and desktop, light and dark (changes taken into v0.2)

**Done when** the user has reviewed the screenshots and listed the changes for v0.2.

## v0.2 — Polish and proof (published on 2026-11-09)

- ✅ Changes from the review
- ⬜ Choreography tuned on real phones
- ✅ End-to-end tests (Playwright, Chromium + Firefox + WebKit, phone and desktop): no console
  errors, keyboard game, no-3D fallback (software WebGL), no zoom-out on phones, 404
- ⬜ End-to-end journeys still to write: chapter menu, theme memory, reduced motion
- ✅ Accessibility scans (axe) in both themes; overflow sweep 320 → 2560 px; reflow at 320 × 256
- ✅ Lighthouse in CI (worst of three, calibrated CPU, three warm-up runs): 100 × 4 locally and
  in CI
- ⬜ Static posters of the 3D poses for the no-3D fallback (for now, one drawn dart in the hero)

**Done when** the full gate is green and Lighthouse shows 100 × 4 on the worst run.

## v1.0 — Published

- ✅ Merge `dev` into `main` with the user's go: GitHub Pages deploys after a green CI (v0.2.0)
- ⬜ Test on the user's iPhone and Android phone
- ⬜ Open Graph image
- ✅ Link from the portfolio (adamrodwebdev.com, v1.13.0)

## Test plan (v0.1 → v0.2)

| Behaviour or risk | Layer | Notes |
|---|---|---|
| Scoring (rings, wires, segments, targets) | unit | boundaries on the wire, all 20 segments |
| 501 digits and visits | unit | leading zeros blanked |
| Pose maths (inside, between, outside ranges) | unit | both layouts |
| Quality tier per device | unit | table of devices |
| Throw spread and win rate | unit | seeded, 3000 darts |
| Build plugins (escaping, CSP hashes, manifest, font URLs) | unit | |
| Page works without 3D, with reduced motion, by keyboard | e2e | v0.2 |
| No overflow 320 → 2560, reflow 320 × 256, axe both themes | e2e | v0.2 |
| Lighthouse 100 × 4, worst of three | CI | v0.2 |
| Feel, legibility over the 3D, phone ergonomics | human | user review, then a phone test |

Not tested automatically: the look of the 3D (judged by eye on screenshots), sound (manual).
