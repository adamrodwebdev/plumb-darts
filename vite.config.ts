import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { compileHints } from './build/compileHints.ts'
import { contentSecurityPolicy } from './build/csp.ts'
import { deferredBoot } from './build/deferredBoot.ts'
import { EMBEDDED_FACES } from './build/faces.ts'
import { htmlI18n, pageInputs } from './build/htmlI18n.ts'
import { inlineStyles } from './build/inlineStyles.ts'

const path = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

const LOCALES = path('./src/i18n/locales')

/**
 * The head scripts run inline before the first paint (each allowed by its CSP hash): the theme,
 * then the arrival on a journey chapter.
 */
function themeScript(): Plugin {
  const sources = ['./build/inline/theme.js', './build/inline/arrival.js'].map((file) =>
    readFileSync(path(file), 'utf8').trim(),
  )
  const scripts = sources.map((source) => `<script>${source}</script>`).join('\n    ')
  return {
    name: 'theme-script',
    transformIndexHtml: (html) => html.replace('<!-- theme-script -->', scripts),
  }
}

// GitHub Pages serves the project under /plumb-darts/. `vite preview` runs as command "serve":
// it needs the same base as the build it serves, or every page falls back to the home page
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview === true ? '/plumb-darts/' : '/',
  plugins: [
    // One page per language from index.html (fr/index.html…), each with its own head and menu
    htmlI18n({ localesDir: LOCALES, template: path('./index.html') }),
    themeScript(),
    inlineStyles({
      entry: path('./src/styles/index.css'),
      faces: EMBEDDED_FACES,
      localesDir: LOCALES,
    }),
    deferredBoot({ bootScript: path('./build/inline/boot.js') }),
    contentSecurityPolicy(),
    compileHints(),
  ],
  build: {
    target: 'es2023',
    // The 3D chunk (Three.js, about 150 kB gzip) is large by nature; it loads after the first
    // paint, only on devices that get 3D, so the default 500 kB warning is raised for it alone
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      // The home of each language and the 404 page
      input: pageInputs(path('.')),
    },
  },
}))
