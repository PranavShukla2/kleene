/**
 * The rail, and the panels it opens.
 *
 * The editor used to show seven panels at once in a permanent column. What replaced it has a
 * property worth pinning down: **the canvas is the only thing always on screen.** Every panel
 * is reachable, exactly one is open at a time, and closing gets you back to a diagram.
 *
 * Also here because the change is easy to regress in a way that looks fine. A second panel
 * quietly staying open, or a panel that cannot be closed, costs the canvas its width again —
 * which is the entire reason any of this moved.
 */

import { expect, test } from '@playwright/test';

import { canvas, openPanel } from './canvas';

const PANELS = ['Selection', 'Table', 'Run', 'Define', 'Export'] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // The tour is a first-run thing and would otherwise open over the canvas in every test.
    localStorage.setItem('kleene.tour.seen', 'yes');
  });
  await page.goto('/editor');
  await expect(canvas(page)).toBeVisible();
});

test('the rail names every panel without opening a menu', async ({ page }) => {
  // The one thing the always-open column was really buying: you can see what exists. A rail
  // that hides its contents behind a menu would have given that up to save the width.
  const rail = page.getByRole('navigation', { name: 'Panels' });
  for (const name of PANELS) {
    await expect(rail.getByRole('button', { name })).toBeVisible();
  }
});

test('nothing is open on a first visit', async ({ page }) => {
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('every panel opens, and only one at a time', async ({ page }) => {
  for (const name of PANELS) {
    await openPanel(page, name);
    await expect(page.getByRole('complementary', { name })).toBeVisible();
    // The property that keeps the canvas: opening one panel closes the last.
    await expect(page.getByRole('complementary')).toHaveCount(1);
  }
});

test('the rail button that opened a panel also closes it', async ({ page }) => {
  const button = page.getByRole('navigation', { name: 'Panels' }).getByRole('button', {
    name: 'Table',
  });

  await button.click();
  await expect(page.getByRole('complementary', { name: 'Table' })).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'true');

  await button.click();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('escape closes an open panel', async ({ page }) => {
  // Expected of anything covering what you were looking at. Without it the only way out is to
  // find the same rail button again, which is a worse answer than every dialog already gives.
  await openPanel(page, 'Define');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('the open panel survives a reload', async ({ page }) => {
  await openPanel(page, 'Export');
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Export' })).toBeVisible();
});

test('the transition table opens along the bottom, at full width', async ({ page }) => {
  // The reason `edge` is a property of a panel rather than a layout preference. A table is
  // wide, and the old 288px column made it stop looking like one.
  await openPanel(page, 'Table');

  const panel = page.getByRole('complementary', { name: 'Table' });
  const table = await panel.boundingBox();
  const view = page.viewportSize();
  if (!table || !view) throw new Error('no layout');

  // Most of the window's width, and along the bottom of it.
  expect(table.width).toBeGreaterThan(view.width * 0.8);
  expect(table.y + table.height).toBeGreaterThan(view.height * 0.7);
});

test('a state can be dragged onto the canvas', async ({ page }) => {
  // The affordance an empty canvas otherwise lacks: double-click works and is faster, but
  // nothing on screen says so.
  await expect(page.getByText('3 states')).toBeVisible();

  const chip = page.getByRole('button', { name: 'Drag onto the canvas to add a state' });
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('no canvas');

  await chip.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + 600, box.y + 300, { steps: 12 });
  await page.mouse.move(box.x + 620, box.y + 320, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByText('4 states')).toBeVisible();
});
