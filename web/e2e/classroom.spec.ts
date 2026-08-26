/**
 * The classroom, while it is being built.
 *
 * Two audiences on one route, and the tests are mostly about the first: someone handed this
 * link — a professor, say — must meet a "coming soon" page and not a half-built classroom. The
 * latch is what makes shipping the work-in-progress to production safe *enough*, and "enough"
 * is doing real work in that sentence: it is not security, and nothing behind it is anything
 * it would matter to leak.
 */

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/classroom');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('a visitor is told it is not finished, not shown a broken classroom', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Not finished yet');
  await expect(page.getByText('Coming soon')).toBeVisible();

  // Nothing to sign into, and nothing that looks like it should work.
  await expect(page.getByRole('button', { name: /Sign in/ })).toHaveCount(0);
});

test('it offers something that does work instead', async ({ page }) => {
  // A "coming soon" page that is only an apology wastes the visit.
  await page.getByRole('button', { name: /problem set instead/ }).click();
  await expect(page).toHaveURL(/\/practice$/);
});

test('the wrong PIN does not open it', async ({ page }) => {
  await page.getByText('Working on this?').click();
  await page.getByLabel('Development PIN').fill('0000');
  await page.getByRole('button', { name: 'Open', exact: true }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Not finished yet');
});

test('the right PIN opens it, and it stays open', async ({ page }) => {
  await page.getByText('Working on this?').click();
  await page.getByLabel('Development PIN').fill('9696');
  await page.getByRole('button', { name: 'Open', exact: true }).click();

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sign in to begin');

  // A latch that had to be reopened on every navigation would be worse than none.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Not finished yet');
});

test('the classroom works with no server at all', async ({ page }) => {
  // The constraint the plan says must survive: signed out and serverless, everything still
  // runs. Here that means the whole classroom is usable locally before a backend exists.
  await page.getByText('Working on this?').click();
  await page.getByLabel('Development PIN').fill('9696');
  await page.getByRole('button', { name: 'Open', exact: true }).click();

  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.getByRole('button', { name: 'Create a class' }).click();

  await expect(page.getByText('Formal Languages')).toBeVisible();
  // A six-character code, readable aloud: no O/0 or I/1.
  await expect(page.getByText(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)).toBeVisible();
});

test('locking again restores what a visitor sees', async ({ page }) => {
  await page.getByText('Working on this?').click();
  await page.getByLabel('Development PIN').fill('9696');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Sign in to begin');

  await page.getByRole('button', { name: 'Lock again' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Not finished yet');
});

test('the nav marks it as unfinished', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Sections' });
  const classroom = nav.getByRole('button', { name: /Classroom/ });
  await expect(classroom).toBeVisible();
  // The dot carries the meaning for anyone hovering or using a screen reader; the page says it
  // in full the moment they arrive.
  await expect(classroom.getByLabel('coming soon')).toBeVisible();
});
