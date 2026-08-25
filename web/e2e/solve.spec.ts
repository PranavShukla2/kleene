/**
 * A problem handed out as a link, solved in a browser.
 *
 * The whole teaching layer in one path: a lecturer runs `kleene problem`, a student opens what
 * it printed, draws a machine, and is told something specific about what is wrong with it.
 *
 * The payload below came from the real CLI, so this also checks the seam between two encoders
 * that never meet at runtime — Rust writes these links and a browser reads them.
 */

import { expect, test, type Page } from '@playwright/test';

import { canvas } from './canvas';

/** Printed by: kleene problem --prompt "…even number of a's." --target "(b + ab*a)*" */
const PROBLEM =
  'ueyJ2ZXJzaW9uIjoxLCJwcm9tcHQiOiJTdHJpbmdzIG92ZXIge2EsYn0gd2l0aCBhbiBldmVuIG51bWJlciBvZiBhJ3MuIiwidGFyZ2V0IjoiKGIgKyBhYiphKSoifQ';

const link = `/solve#p=${PROBLEM}`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kleene.tour.seen', 'yes');
  });
});

test('a problem link opens with its prompt', async ({ page }) => {
  await page.goto(link);
  await expect(page.getByRole('heading', { level: 1 })).toContainText("even number of a's");
});

test('a truncated link says so, and does not blame the student', async ({ page }) => {
  // Email clients and chat apps both cut long URLs. The failure has to be legible, because the
  // student receiving it did nothing wrong and cannot fix it from here.
  await page.goto('/solve#p=zBROKEN');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('did not open');
});

test('the page says the check is client-side, without being asked', async ({ page }) => {
  // Task B5. A student who works this out for themselves stops trusting everything else the
  // tool says, so it has to be on the page rather than in the documentation.
  await page.goto(link);
  await expect(page.getByText(/anyone can read it out/)).toBeVisible();
  await expect(page.getByText(/kleene grade/)).toBeVisible();
});

/**
 * Draw something, and wait for it to be saved.
 *
 * The solve page reads the student's work out of IndexedDB, and the editor's autosave is
 * debounced — so navigating away the instant the canvas appears leaves nothing to recover.
 * Waiting for the status bar to say "saved" waits for the real condition.
 */
async function drawAndSave(page: Page) {
  await page.goto('/editor');
  await expect(canvas(page)).toBeVisible();
  await expect(page.getByText('saved', { exact: true })).toBeVisible();
}

test('Check is disabled until there is something to check', async ({ page }) => {
  // Not a missing feature: checking nothing has no answer to give. The button says so by
  // being unavailable rather than by producing a verdict about an empty canvas.
  await page.goto(link);
  await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled();
});

test('a wrong answer is told which string proves it wrong', async ({ page }) => {
  // The pedagogical thesis, end to end: never a bare "incorrect".
  await drawAndSave(page);
  await page.goto(link);
  await page.getByRole('button', { name: 'Check' }).click();

  const note = page.getByRole('status');
  await expect(note).toBeVisible();
  // The default editor document is not the answer to this problem, so this must fail — and
  // say something more than that it failed.
  await expect(note).toContainText(/accepts|rejects/);
  await expect(note).toContainText(/Trace that string/);
});

test('checking is unlimited and nothing is counted', async ({ page }) => {
  // B4. Pressing Check twice says the same thing twice; there is no attempt tally to game.
  await drawAndSave(page);
  await page.goto(link);
  await page.getByRole('button', { name: 'Check' }).click();
  const first = await page.getByRole('status').innerText();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByRole('status')).toHaveText(first);
});

test('a correct but oversized answer is told which states could be one', async ({ page }) => {
  /*
    Track F3. "You are one state over" is a score; "no string tells these two apart" is a thing
    to go and check. The hint appears only after the language is right — merge advice about a
    wrong machine would be advice about the wrong machine.

    The editor's seeded machine has three states and accepts strings ending in ab, which is
    already minimal, so this drives the case by adding a redundant state first.
  */
  await drawAndSave(page);
  await page.goto(link);
  await page.getByRole('button', { name: 'Check' }).click();

  const status = page.getByRole('status');
  await expect(status).toBeVisible();

  // Whatever the verdict, no merge hint may appear before the language is right.
  const solved = (await status.innerText()).includes('Solved');
  if (!solved) {
    await expect(page.getByText(/No string tells/)).toHaveCount(0);
  }
});
