# Security

Plumb is a static page: no server code, no forms that send data, no accounts, no third-party
requests. Each page carries a Content Security Policy in a meta tag (GitHub Pages cannot send
headers) that allows only the site's own files and its inline blocks by hash.

Data that reaches the page from outside (the stored theme, the target list, the page's own
attributes, the renderer's name) goes through the readers of `src/rules/input.ts`: numbers must be
finite numbers in their range, text must be a string, cleaned of invisible characters and within
its length, and choices come from a closed list. Nothing is coerced; what does not fit is refused.

The 3D model files are read the same way (`src/rules/glb.ts`, `src/design/scene/SceneModels.ts`):
each is refused above its size limit while it streams (the declared length is read strictly
first), its GLB container is checked before the parser sees it (magic, version, lengths, chunks),
and once parsed it must hold the nodes the scene uses, their maps, a bounded number of vertices
and textures, and the dimensions the scoring rules and the throw rely on. A refused file leaves
the page without 3D.

The policy allows two things a static page would not need without its 3D models:
`'wasm-unsafe-eval'` in `script-src` (three's meshopt decoder compiles WebAssembly; `eval()` and
`new Function()` stay refused, and no script runs that `'self'` and the hashes do not name), and
`blob:` in `connect-src` (GLTFLoader reads the models' embedded images back from blob URLs it
creates). No page starts a worker: `worker-src 'none'`.

To report a problem, open an issue or write through the contact on
https://github.com/adamrodwebdev.

## Dependency advisories

`npm audit` (dev dependencies included) is read before every publication.

| Advisory | Severity | Where | Status |
|---|---|---|---|
| minimatch, GHSA-g3hv-75wg-m249 (denial of service through glob patterns) | moderate | dev tooling only (ESLint and typescript-eslint); nothing shipped | **fixed on 2026-11-09**: `overrides` pins minimatch 11.0.5; ESLint checked to still match its file patterns; `npm audit` finds 0 |
