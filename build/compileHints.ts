import type { Plugin } from 'vite'

/** V8 explicit compile hint (Chrome 136+): every function of the file runs at load */
export const COMPILE_HINT = '//# allFunctionsCalledOnLoad\n'

/**
 * Each script is compiled whole while it downloads, off the main thread, instead of one function
 * at a time inside the start-up tasks. Other engines ignore the comment. Added last: after
 * minification, which would strip it.
 */
export function compileHints(): Plugin {
  return {
    name: 'compile-hints',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        for (const file of Object.values(bundle)) {
          if (file.type === 'chunk') file.code = COMPILE_HINT + file.code
        }
      },
    },
  }
}
