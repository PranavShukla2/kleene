import type { Page } from '@playwright/test';

/**
 * The editor's canvas, addressed by its accessible name.
 *
 * `svg[role="img"]` used to be specific enough. It stopped being so when the export panel
 * started rendering a second, off-screen copy of the diagram to rasterise from — a strict
 * locator then matched two elements and every editor spec failed at its first assertion.
 *
 * The name is the right discriminator anyway: two diagrams legitimately exist on that page,
 * and a test that says which one it means is a test that keeps working when a third arrives.
 */
export const canvas = (page: Page) =>
  page.locator('svg[aria-label="The automaton being edited"]');

/** The canvas's text nodes — state names and transition labels. Present only once wasm has run. */
export const drawn = (page: Page) => canvas(page).locator('text');

/**
 * Open one of the editor's panels from the rail.
 *
 * The panels used to be a permanent column, so a test could assert against any of them
 * straight after `goto`. They now open one at a time, which is the point of the change — and
 * it means a test that wants the transition table has to ask for it, the same way a person
 * does. Naming the rail button rather than a CSS handle keeps that honest: if the rail stops
 * offering a panel, these fail rather than silently testing something else.
 */
export async function openPanel(
  page: Page,
  name: 'Selection' | 'Table' | 'Run' | 'Define' | 'Export',
): Promise<void> {
  const rail = page.getByRole('navigation', { name: 'Panels' });
  const button = rail.getByRole('button', { name });
  // `aria-pressed` is the panel's own report of whether it is open, so this is idempotent —
  // a helper that toggled would close the panel for the second test that called it.
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
  await page.getByRole('complementary', { name }).waitFor();
}
