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
