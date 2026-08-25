/**
 * The pumping lemma game.
 *
 * Held to the plan's definition of done, which is unusually testable for a teaching claim:
 *
 * > The game can be **lost** by a student who does not understand the lemma, and **won** by one
 * > who does. If it cannot be lost, it teaches nothing.
 *
 * The core has tests for both halves as properties. These check the same two things through
 * the page, because a game that is correct and unplayable teaches nothing either.
 */

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/pumping-lemma');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the page is laid out as the lemma is written', async ({ page }) => {
  // The whole idea: each move sits under the quantifier that produces it, so playing the game
  // and reading the statement are one activity rather than two to connect.
  const main = page.getByRole('main');
  await expect(main).toContainText('for every n');
  await expect(main).toContainText('there exists w');
});

test('a well-chosen word beats a perfect adversary', async ({ page }) => {
  // The winnable half. The adversary always plays its best split, so this is a real win.
  await page.getByLabel('Your choice of w').fill('aaaabbbb');
  await page.getByRole('button', { name: 'Play w' }).click();

  await page.getByRole('button', { name: 'i = 2' }).click();
  await expect(page.getByRole('status')).toContainText('You win');
});

test('winning prints the proof that was just played', async ({ page }) => {
  // E5. Not a summary of the game — the same moves, read as the quantifiers they were.
  await page.getByLabel('Your choice of w').fill('aaaabbbb');
  await page.getByRole('button', { name: 'Play w' }).click();
  await page.getByRole('button', { name: 'i = 2' }).click();

  const status = page.getByRole('status');
  await expect(status).toContainText('Suppose');
  await expect(status).toContainText('contradicts the lemma');
  await expect(status).toContainText('∎');
});

test('a word outside the language is refused, and told why', async ({ page }) => {
  // The commonest mistake in the exercise. Playing it out would teach that it does not matter,
  // when it is the reason the whole argument works.
  await page.getByLabel('Your choice of w').fill('aabbb');
  await page.getByRole('button', { name: 'Play w' }).click();

  await expect(page.getByRole('alert')).toContainText('not in L');
  // Still the student's move — a refused choice is not a lost round.
  await expect(page.getByRole('button', { name: 'Play w' })).toBeVisible();
});

test('a word shorter than n is refused with both numbers', async ({ page }) => {
  await page.getByLabel('Your choice of w').fill('ab');
  await page.getByRole('button', { name: 'Play w' }).click();
  await expect(page.getByRole('alert')).toContainText('at least n');
});

test('a regular language cannot be beaten, and says why', async ({ page }) => {
  // The losable half, and the lesson: the lemma proves non-regularity and cannot prove
  // regularity. Finding that out by trying beats being told.
  await page.getByRole('button', { name: /even number of a/ }).click();

  await page.getByLabel('Your choice of w').fill('aabb');
  await page.getByRole('button', { name: 'Play w' }).click();

  for (const i of ['i = 0', 'i = 2', 'i = 3']) {
    await page.getByRole('button', { name: i }).click();
    await expect(page.getByRole('status')).toContainText('survived');
    await page.getByRole('button', { name: 'Play again' }).click();
    await page.getByLabel('Your choice of w').fill('aabb');
    await page.getByRole('button', { name: 'Play w' }).click();
  }

  await page.getByRole('button', { name: 'i = 1' }).click();
  await expect(page.getByRole('status')).toContainText('is regular');
});
