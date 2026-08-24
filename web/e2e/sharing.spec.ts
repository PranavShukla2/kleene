/**
 * Sharing a machine in a link (Phase 4 Track F).
 *
 * The encode/decode arithmetic is covered in `share.test.ts`. What is not coverable there is
 * the part that actually broke: a link differing from the current page only by its *fragment*
 * does not reload the page, so the app has to notice by other means. That failure is invisible
 * to any unit test and looks, in the browser, exactly like a link doing nothing.
 */

import { expect, test, type Page } from '@playwright/test';

import { canvas, drawn } from './canvas';

/** Copy a share link for whatever is currently open. */
async function shareLink(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'copy link' }).click();
  return page.evaluate(() => navigator.clipboard.readText());
}

/** Put a state on the canvas, so the session has work worth not losing. */
async function drawSomething(page: Page): Promise<void> {
  const box = await canvas(page).first().boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.dblclick(box.x + 760, box.y + 470);
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('a machine fits in a link, and the link is a fragment', async ({ page }) => {
  await page.goto('/editor');
  const link = await shareLink(page);

  // Task F2. A fragment never reaches a server, which is the entire privacy story.
  expect(link).toContain('#kln=');
  expect(link).not.toContain('?kln=');

  // Compressed, not merely encoded. `z` is the marker; `u` would mean the fallback ran.
  expect(link).toContain('#kln=z');
  expect(link.length).toBeLessThan(2000);
});

test('opening a link in a fresh session loads the machine', async ({ page, browser }) => {
  await page.goto('/editor');
  const link = await shareLink(page);

  /*
    A genuinely separate context, not another page in this one.

    This used to be `page.context().newPage()` after `clearCookies()`, which is not a fresh
    session and does not become one: the app keeps recovered work in IndexedDB, which every
    page of a context shares, and it has never used a cookie. So the second page could see the
    first page's autosave — and when it does, the link is correctly *offered* rather than
    loaded, because that is task F7's entire point. The canvas then stays as it was and no
    label ever appears.

    Whether it saw it was a race between one page's 400ms autosave and another page's read.
    Locally the read won and the test passed; in CI the write won and the machine was never
    meant to load. The test name said "fresh session" while the setup did not build one, and
    the fix is to build one — a new context has its own IndexedDB, so there is no work to
    weigh the link against and no offer to make.
  */
  const fresh = await browser.newContext();
  const visitor = await fresh.newPage();
  await visitor.goto(link);

  await expect(drawn(visitor).first()).toHaveText('q0');

  await fresh.close();
});

test('a link never discards work without asking', async ({ page }) => {
  // Task F7, and the reason the whole offer exists. The common case is someone with a
  // half-drawn machine clicking a classmate's link — opening it on top would be
  // indistinguishable from losing their work, with no way back.
  await page.goto('/editor');
  const link = await shareLink(page);

  await page.goto('/editor');
  await drawSomething(page);
  // Past the autosave debounce, so the session counts as busy. Waiting for the status bar to
  // say so beats sleeping for a number chosen to be comfortably longer than a 400ms timer:
  // it is quicker when the save is quick, and it is still correct when the machine is not.
  await expect(page.getByText('saved', { exact: true })).toBeVisible();
  const before = await drawn(page).allTextContents();

  await page.goto(link);

  await expect(page.getByRole('button', { name: 'Keep mine' })).toBeVisible();
  expect(await drawn(page).allTextContents()).toEqual(before);
});

test('the offered machine opens when it is accepted', async ({ page }) => {
  await page.goto('/editor');
  const link = await shareLink(page);

  await page.goto('/editor');
  await drawSomething(page);
  await expect(page.getByText('saved', { exact: true })).toBeVisible();
  const before = await drawn(page).allTextContents();

  await page.goto(link);
  await page.getByRole('button', { name: 'Open it' }).click();

  const after = await drawn(page).allTextContents();
  expect(after).not.toEqual(before);
  await expect(page.getByRole('button', { name: 'Keep mine' })).toHaveCount(0);
});

test('a truncated link says so rather than failing silently', async ({ page }) => {
  await page.goto('/editor');
  const link = await shareLink(page);

  // A mail client wrapping the URL is the commonest real failure.
  await page.goto(link.slice(0, link.length - 12));

  await expect(page.getByRole('alert')).toContainText('cut short');
});
