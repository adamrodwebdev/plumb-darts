import js from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import prettier from 'eslint-config-prettier/flat'
import oxlint from 'eslint-plugin-oxlint'
import playwright from 'eslint-plugin-playwright'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

const browser = {
  document: 'readonly',
  window: 'readonly',
  localStorage: 'readonly',
  location: 'readonly',
  history: 'readonly',
  matchMedia: 'readonly',
  PerformanceObserver: 'readonly',
  requestAnimationFrame: 'readonly',
  setTimeout: 'readonly',
} as const

export default defineConfig(
  globalIgnores(['dist/**', 'coverage/**', 'playwright-report/**', 'test-results/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    name: 'app/inline-scripts',
    files: ['build/inline/*.js'],
    languageOptions: { globals: browser, sourceType: 'script' },
  },
  {
    name: 'app/lighthouse-scripts',
    files: ['lighthouse/*.mjs'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly' } },
  },
  {
    ...vitest.configs.recommended,
    name: 'app/unit-tests',
    files: ['src/**/*.test.ts', 'build/**/*.test.ts'],
  },
  {
    ...playwright.configs['flat/recommended'],
    name: 'app/e2e',
    files: ['e2e/**/*.ts'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      // Helpers named expect… assert for the test that calls them
      'playwright/expect-expect': ['warn', { assertFunctionPatterns: ['^expect[A-Z]'] }],
    },
  },
  oxlint.configs['flat/recommended'],
  prettier,
)
