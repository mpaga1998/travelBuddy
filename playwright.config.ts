import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — Phase 6.4 smoke tests.
 *
 * Default target is the local Vite dev server (frontend only — most smoke
 * tests don't hit /api routes, so we skip `vercel dev`'s heavier startup).
 * Override the target with PLAYWRIGHT_BASE_URL to run against a deployed
 * preview/production URL — when that env is set, Playwright skips the
 * webServer hook and assumes the URL is already reachable.
 *
 * Auth-required tests gate on NOOK_E2E_EMAIL and NOOK_E2E_PASSWORD.
 * Without those, the auth-gated tests skip cleanly so first-time setup
 * still produces a green run.
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const useExternalServer = !!process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: './tests/e2e',
  // Per-test default. Auth flows that hit Supabase networks need headroom.
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  // Refuse `.only` in CI so a stray focus marker can't silently shrink the
  // test set on main.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    // Capture a trace on the FIRST retry — gives us a debugging artifact
    // for flakes without paying the trace cost on every run.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: useExternalServer
    ? undefined
    : {
        // dev:frontend is `vite` only — much faster startup than `vercel dev`.
        // Smoke tests don't hit /api routes; if a future test needs them,
        // either flip this to `npm run dev` or run that separately.
        command: 'npm run dev:frontend',
        url: 'http://localhost:5173',
        timeout: 60_000,
        reuseExistingServer: !process.env.CI,
      },
});
