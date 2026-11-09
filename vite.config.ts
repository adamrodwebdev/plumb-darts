import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { compileHints } from './build/compileHints.ts'
import { contentSecurityPolicy } from './build/csp.ts'
import { deferredBoot } from './build/deferredBoot.ts'
import { htmlI18n } from './build/htmlI18n.ts'
import { inlineStyles } from './build/inlineStyles.ts'

const path = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url))

/** The theme script runs inline in <head>, before the first paint (allowed by its CSP hash). */
function themeScript(): Plugin {
  const source = readFileSync(path('./build/inline/theme.js'), 'utf8').trim()
  return {
    name: 'theme-script',
    transformIndexHtml: (html) =>
      html.replace('<!-- theme-script -->', `<script>${source}</script>`),
  }
}

// GitHub Pages serves the project under /plumb-darts/. `vite preview` runs as command "serve":
// it needs the same base as the build it serves, or every page falls back to the home page
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview === true ? '/plumb-darts/' : '/',
  plugins: [
    htmlI18n({ messagesFile: path('./src/i18n/en.json') }),
    themeScript(),
    inlineStyles({
      entry: path('./src/styles/index.css'),
      heroFont: {
        file: path(
          './node_modules/@fontsource-variable/big-shoulders-display/files/big-shoulders-display-latin-wght-normal.woff2',
        ),
        family: 'Plumb Hero',
        weight: 800,
        // Headline, wordmark and score digits: everything above the fold set in the display face
        keys: ['hero.title1', 'hero.title2', 'hero.title3', 'footer.wordmark'],
        extraGlyphs: '0123456789!',
        messagesFile: path('./src/i18n/en.json'),
      },
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
      input: {
        main: path('./index.html'),
        notFound: path('./404.html'),
      },
    },
  },
}))
