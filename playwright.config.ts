import { defineConfig, devices } from '@playwright/test'
import { e2ePort } from './build/e2ePort.ts'

/** 4186 unless E2E_PORT names another (the developer's own preview may hold 4186) */
const PORT = e2ePort(process.env['E2E_PORT'])
/** The production build, served under the GitHub Pages path */
const BASE = `http://localhost:${PORT}/plumb-darts/`
const DESKTOP = { width: 1280, height: 800 }

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  // One retry in CI only to tell a flaky test from a broken one; a flaky test is still a bug
  retries: process.env.CI ? 1 : 0,
  // The user's laptop overheats: two workers locally as in CI
  workers: 2,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: { baseURL: BASE, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: DESKTOP } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: DESKTOP } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: DESKTOP } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] }, testIgnore: 'widths.spec.ts' },
    { name: 'Mobile Safari', use: { ...devices['iPhone 14'] }, testIgnore: 'widths.spec.ts' },
  ],
  webServer: {
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
