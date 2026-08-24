/**
 * `.kln` documents (Phase 4 Track D).
 *
 * The property worth the most here is the one that is invisible when it works: **a file that
 * fails to open must leave the open document alone.** Someone who drags the wrong file onto
 * their work has made a small mistake, and losing an hour of drawing to it would be a much
 * larger one — so the load path is tested by trying to break it, not only by using it.
 */

import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

/** The editor's outermost element, which is the drop target. */
const EDITOR = 'div.relative.flex.h-dvh';

/** State labels currently on the canvas, which is how "did the document change" is answered. */
async function labels(page: Page): Promise<string[]> {
  return page.locator('svg[role="img"] text').allTextContents();
}

/** Drop a file on the editor, as a browser would. */
async function drop(page: Page, name: string, contents: string): Promise<void> {
  await page.evaluate(
    ({ selector, name: filename, text }) => {
      const data = new DataTransfer();
      data.items.add(new File([text], filename, { type: 'application/json' }));
      const target = document.querySelector(selector);
      for (const type of ['dragover', 'drop']) {
        target?.dispatchEvent(
          new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }),
        );
      }
    },
    { selector: EDITOR, name, text: contents },
  );
}

test('a saved file carries the machine, the layout, and no claim it cannot support', async ({
  page,
}) => {
  await page.goto('/editor');

  const started = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const file = await started;
  expect(file.suggestedFilename()).toBe('automaton.kln');

  const text = await file.path().then((at) => readFile(at, 'utf8'));
  const saved = JSON.parse(text) as Record<string, unknown>;

  expect(saved.version).toBe(1);
  expect(saved.layout).toBeDefined();
  // Decision D8: `origin` points at a machine the file does not contain.
  expect(text).not.toContain('origin');
});

test('dropping a file opens it', async ({ page }) => {
  await page.goto('/editor');

  const started = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save' }).click();
  const text = await (await started).path().then((at) => readFile(at, 'utf8'));

  await drop(page, 'renamed.kln', text.replace('"q0"', '"START"'));

  await expect(page.locator('svg[role="img"] text').first()).toHaveText('START');
});

test('a file from a newer version is refused, and the open document survives', async ({
  page,
}) => {
  await page.goto('/editor');
  const before = await labels(page);

  await drop(
    page,
    'future.kln',
    JSON.stringify({
      version: 99,
      automaton: {
        alphabet: ['a'],
        states: [{ id: 0, label: 'x' }],
        start: 0,
        transitions: [],
      },
    }),
  );

  // Actionable, rather than a parser complaint about an unexpected field several levels down.
  await expect(page.getByRole('alert')).toContainText('newer version of Kleene');
  expect(await labels(page)).toEqual(before);
});

test('a malformed machine is refused, and the open document survives', async ({ page }) => {
  await page.goto('/editor');
  const before = await labels(page);

  await drop(
    page,
    'broken.kln',
    JSON.stringify({
      version: 1,
      // A transition to a state that does not exist.
      automaton: {
        alphabet: ['a'],
        states: [{ id: 0, label: 'q0' }],
        start: 0,
        transitions: [{ from: 0, to: 7, on: 'a' }],
      },
    }),
  );

  await expect(page.getByRole('alert')).toBeVisible();
  expect(await labels(page)).toEqual(before);
});

test('the error can be dismissed', async ({ page }) => {
  await page.goto('/editor');
  await drop(page, 'nonsense.kln', 'this is not JSON');

  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();

  await page.getByRole('button', { name: 'dismiss' }).click();
  await expect(alert).toHaveCount(0);
});
