import { test, expect } from '@playwright/test';

/**
 * 6.4 — smoke test suite.
 *
 * Three tiers, deliberately layered so first-time runs succeed without
 * any setup beyond `npm run test:e2e`:
 *
 *   1. PUBLIC — unauthenticated paths. Always run. Cover the auth UI
 *      shell, the legal pages, and route-not-found. Catches "Vercel
 *      build broke the SPA fallback" or "App.tsx routing regressed."
 *
 *   2. AUTHENTICATED — gated on NOOK_E2E_EMAIL + NOOK_E2E_PASSWORD env
 *      vars. Skip cleanly when not set. Use a pre-created Supabase test
 *      user to avoid the email-confirmation trap during signup. Cover
 *      sign-in landing, navigation to /feed and /notifications, etc.
 *
 *   3. EXPENSIVE — `test.skip()`-d by default. Itinerary generation
 *      hits OpenAI and costs real cents per run. Enable manually when
 *      you want to validate the full pipeline.
 *
 * Selectors prefer accessible roles + visible text, since this codebase
 * doesn't have data-testid sprinkled in. That's also a forcing function
 * for accessibility — anything Playwright struggles to find is also
 * something a screen reader struggles with.
 */

const E2E_EMAIL = process.env.NOOK_E2E_EMAIL;
const E2E_PASSWORD = process.env.NOOK_E2E_PASSWORD;

// ─── 1. Public smoke ──────────────────────────────────────────────────────

test.describe('public app shell', () => {
  test('home loads and renders the auth page when signed out', async ({ page }) => {
    await page.goto('/');
    // LoadingPage may briefly flash before AuthPage. Wait for the auth
    // form, not the wordmark, since the wordmark also appears on
    // LoadingPage and InitialPage.
    await expect(page.getByPlaceholder('Email')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder('Password')).toBeVisible();
  });

  test('switching to signup mode reveals the additional fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByPlaceholder('Email')).toBeVisible({ timeout: 10_000 });

    // The mode-toggle button under the submit button is "Create an account"
    // when in signin mode.
    await page.getByRole('button', { name: /create an account/i }).click();

    await expect(page.getByPlaceholder('First name')).toBeVisible();
    await expect(page.getByPlaceholder('Last name')).toBeVisible();
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    // The signup submit button stays disabled until ToS is checked.
    await expect(page.getByRole('button', { name: /^sign up$/i })).toBeDisabled();
  });

  test('terms of service page is reachable while signed out', async ({ page }) => {
    await page.goto('/terms');
    // Both the sticky header and the body show "Terms of Service" — the
    // body's <h1> is the canonical one.
    await expect(
      page.getByRole('heading', { name: /^terms of service$/i, level: 1 }).last(),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/draft pending legal review/i)).toBeVisible();
  });

  test('community guidelines page is reachable while signed out', async ({ page }) => {
    await page.goto('/guidelines');
    await expect(
      page.getByRole('heading', { name: /^community guidelines$/i, level: 1 }).last(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('unknown /u/<handle> shows the not-found state', async ({ page }) => {
    // Use a deliberately invalid handle (uppercase, would fail format CHECK)
    // so we don't depend on the absence of a real test user.
    await page.goto('/u/__definitely_not_a_real_handle__');
    await expect(page.getByText(/profile not found/i)).toBeVisible({ timeout: 10_000 });
  });
});

// ─── 2. Authenticated smoke ───────────────────────────────────────────────

test.describe('authenticated flows', () => {
  test.skip(
    !E2E_EMAIL || !E2E_PASSWORD,
    'Set NOOK_E2E_EMAIL and NOOK_E2E_PASSWORD to a Supabase test user to run.',
  );

  // Helper: sign in via the form. Kept in-file (not a fixture) since it's
  // only used here. Playwright fixtures would be the right choice if we
  // had >5 auth-gated tests.
  async function signIn(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.getByPlaceholder('Email').fill(E2E_EMAIL!);
    await page.getByPlaceholder('Password').fill(E2E_PASSWORD!);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    // Post-signin lands on InitialPage which renders the "nook" wordmark
    // as an h1 and the "Where next?" CTA — wait for the CTA so we know
    // the page is interactive, not just rendered.
    await expect(page.getByRole('button', { name: /where next/i })).toBeVisible({
      timeout: 15_000,
    });
  }

  test('sign in lands on the home page with CTA visible', async ({ page }) => {
    await signIn(page);
  });

  test('feed link from home navigates to /feed', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /feed/i }).first().click();
    await expect(page).toHaveURL(/\/feed$/);
    // The feed page header reads "Feed" (case-sensitive in the UI).
    await expect(page.getByRole('heading', { name: 'Feed' })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('notifications bell from home navigates to /notifications', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /notifications/i }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('"Where next?" expands a search bar', async ({ page }) => {
    await signIn(page);
    await page.getByRole('button', { name: /where next/i }).click();
    await expect(page.getByPlaceholder(/search location/i)).toBeVisible();
  });
});

// ─── 3. Expensive flows ───────────────────────────────────────────────────

// These are skipped at the describe level. Flip the .skip to .only or
// remove it when you want to validate generation against real OpenAI.
test.describe.skip('expensive flows (OpenAI tokens)', () => {
  test('generate itinerary streams content', async () => {
    // TODO: open ItineraryModal, fill form, hit Generate, assert that
    // streamed text appears progressively. Estimated cost: ~$0.05 per run
    // with gpt-4o-mini. Gate behind a deliberate opt-in env var before
    // re-enabling.
  });
});
