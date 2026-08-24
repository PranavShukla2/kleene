/**
 * True offline (Phase 5 A3).
 *
 * The task says to *verify* — load, airplane mode, hard refresh, everything still works — and
 * this is that, automated, because it is exactly the property that regresses silently. Nothing
 * about the app looks different when the precache has quietly stopped covering the wasm; it
 * only stops working for someone on a train, who has no way to report it.
 *
 * Runs in its own context: a service worker is per-origin-per-context, and a test that shared
 * one with its neighbours would pass or fail on the order they happened to run in.
 */

import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('the app works with the network switched off, including pages never visited', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Online first, so the worker installs and precaches.
  await page.goto('/editor');
  await page.evaluate(() => navigator.serviceWorker.ready);
  // The precache is written after `ready` resolves; without this the first offline navigation
  // races a cache that is still filling.
  await page.waitForTimeout(2500);

  await context.setOffline(true);

  // A hard navigation, not a client-side one — this is the case that needs the worker.
  await page.goto('/editor');
  await expect(page.locator('svg[role="img"] text').first()).toBeVisible();

  // A route this session has never opened. Reaching it offline needs `navigateFallback`,
  // which is the setting most easily left out and least visibly missing.
  await page.goto('/tools/nfa-to-dfa');
  await expect(page.getByRole('heading', { name: 'NFA to DFA converter' })).toBeVisible();

  // And a page that cannot render at all without the WebAssembly module, which is the largest
  // thing in the precache and the one a default size cap would have dropped.
  await page.goto('/examples');
  await expect(page.locator('svg[role="img"]').first()).toBeVisible();

  await context.close();
});
