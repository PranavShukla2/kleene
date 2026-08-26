/**
 * The problem set, worked through.
 *
 * The loop this exists to protect: pick a problem, answer it, and have that remembered. Each
 * of those three is somewhere different — a list in the Rust core, a checker across the wasm
 * boundary, and a record in localStorage — so nothing but an end-to-end test sees all of it.
 */

import { expect, test } from '@playwright/test';

import { canvas } from './canvas';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kleene.tour.seen', 'yes');
  });
});

test('the set is listed in difficulty order, with nothing solved yet', async ({ page }) => {
  await page.goto('/practice');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await expect(page.locator('button.k-card')).toHaveCount(20);
  await expect(page.getByText('0 of 20 solved')).toBeVisible();

  // The tiers are headings rather than filters, because the order *is* the teaching — being
  // able to start at "pathological" is being able to conclude the subject is beyond you.
  await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /intuition runs out/ })).toBeVisible();
});

test('a problem from the set opens the same way a lecturer’s link does', async ({ page }) => {
  // One door into solving. A problem chosen from the list and one sent by email arrive
  // identically, which also means the URL is shareable from either.
  await page.goto('/practice');
  await page.locator('button.k-card').first().click();

  await expect(page).toHaveURL(/\/solve#p=.+&k=/);
  await expect(page.getByRole('button', { name: 'Check' })).toBeVisible();
});

test('solving a problem is remembered', async ({ page }) => {
  // The editor's seeded machine accepts strings ending in ab, which is the first problem.
  await page.goto('/editor');
  await expect(canvas(page)).toBeVisible();
  await expect(page.getByText('saved', { exact: true })).toBeVisible();

  await page.goto('/practice');
  await page.locator('button.k-card').first().click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByRole('status')).toContainText('Solved');

  await page.goto('/practice');
  await expect(page.getByText('1 of 20 solved')).toBeVisible();
  await expect(page.locator('button.k-card').first()).toContainText('solved');
});

test('progress survives a reload, because there is no server to hold it', async ({ page }) => {
  await page.goto('/editor');
  await expect(canvas(page)).toBeVisible();
  await expect(page.getByText('saved', { exact: true })).toBeVisible();

  await page.goto('/practice');
  await page.locator('button.k-card').first().click();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByRole('status')).toContainText('Solved');

  await page.goto('/practice');
  await page.reload();
  await expect(page.getByText('1 of 20 solved')).toBeVisible();
});

test('the page says where progress lives, and that clearing site data clears it', async ({
  page,
}) => {
  // There is no account to restore from, so the export is the entire backup story and the
  // page has to say so rather than letting someone find out.
  await page.goto('/practice');
  await expect(page.getByText(/no account/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export progress' })).toBeVisible();
});

test('the teaching layer is reachable without knowing a URL', async ({ page }) => {
  /*
    It was in the nav and the footer and nowhere else, which is close to not existing — a
    visitor scrolling the landing page had no way to learn any of it was there. One word in a
    nav cannot say "there is a problem set, a game that plays the pumping lemma against you,
    and a way to set an assignment without an account".
  */
  await page.goto('/');

  const band = page.getByRole('heading', { name: /Somewhere to use it/ });
  await band.scrollIntoViewIfNeeded();
  await expect(band).toBeVisible();

  await page.getByRole('button', { name: /Open the problem set/ }).click();
  await expect(page).toHaveURL(/\/practice$/);
});

test('practice is in the top nav, not only the footer', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Sections' });
  await expect(nav.getByRole('button', { name: 'Practice' })).toBeVisible();
});

test('the header does not clip its own call to action', async ({ page }) => {
  // It did: nine nav items made the header's content 89px wider than the header, with no
  // overflow, so "Open the editor" was cut off at the right edge.
  await page.goto('/');
  const clipped = await page.evaluate(() => {
    const header = document.querySelector('header');
    return header ? header.scrollWidth > header.clientWidth : true;
  });
  expect(clipped).toBe(false);

  const cta = page.getByRole('button', { name: /Open the editor/ }).first();
  const box = await cta.boundingBox();
  const view = page.viewportSize();
  if (!box || !view) throw new Error('no layout');
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
});
