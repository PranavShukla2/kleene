/**
 * End-to-end configuration.
 *
 * Deliberately one browser. Kleene's risk is not cross-browser rendering — it is that a
 * sequence of gestures stops producing the right automaton, and that fails identically
 * everywhere. Three browsers would triple the CI minutes to re-answer a question the first
 * one already answered.
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  // The suite is small and each spec drives a real editor, so serial is both fast enough and
  // easier to read when something fails.
  fullyParallel: false,
  workers: 1,

  // A test that only passes on a retry is a flaky test, and a flaky end-to-end suite is one
  // that gets ignored. Failing loudly the first time is the point.
  retries: 0,
  forbidOnly: !!process.env.CI,

  reporter: process.env.CI ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    // Kept only for failures: the trace is the difference between "the verdict was wrong" and
    // knowing which of eleven gestures went astray.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // The built app, not the dev server. This suite exists to check the thing that ships, and
  // a dev server differs from it in exactly the ways that break a build.
  webServer: {
    command: `npm run build && npx vite preview --port ${String(PORT)} --strictPort`,
    url: `http://localhost:${String(PORT)}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
