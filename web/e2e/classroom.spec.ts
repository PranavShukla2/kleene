/**
 * The classroom, while it is being built.
 *
 * Two audiences on one route, and the tests are mostly about the first: someone handed this
 * link — a professor, say — must meet a "coming soon" page and not a half-built classroom. The
 * latch is what makes shipping the work-in-progress to production safe *enough*, and "enough"
 * is doing real work in that sentence: it is not security, and nothing behind it is anything
 * it would matter to leak.
 */

import { expect, test, type Page } from '@playwright/test';

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

/** Get past the latch and sign in. Every teacher test starts here. */
async function asTeacher(page: Page) {
  await page.getByText('Working on this?').click();
  await page.getByLabel('Development PIN').fill('9696');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('button', { name: /Sign in/ }).click();
  await page.getByRole('button', { name: 'Create a class' }).click();
  await page.getByRole('button', { name: 'Set an assignment' }).click();
}

test('a target that does not parse is refused before anyone is given the link', async ({
  page,
}) => {
  // The expensive failure this form exists to prevent: thirty students opening a broken
  // problem. The engine is already in the tab, so there is no reason to find out later.
  await asTeacher(page);
  await page.getByPlaceholder('(b + ab*a)*').fill('a+');

  await expect(page.getByText(/not a regular expression/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set the assignment' })).toBeDisabled();
});

test('a valid target reports how many states the answer needs', async ({ page }) => {
  await asTeacher(page);
  await page.getByPlaceholder('(b + ab*a)*').fill('(b + ab*a)*');
  await expect(page.getByText(/needs 2 states at minimum/)).toBeVisible();
});

test('an unachievable budget is refused, with the number that would work', async ({ page }) => {
  /*
    The worst of the three, because it is invisible: a problem with a budget below its minimum
    is unsolvable, and unsolvable in a way that looks exactly like being bad at minimization. A
    student would never suspect the problem.
  */
  await asTeacher(page);
  await page.getByPlaceholder('(b + ab*a)*').fill('(b + ab*a)*');
  await page.getByPlaceholder('optional').fill('1');

  await expect(page.getByText(/smallest machine for this language has 2 states/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Set the assignment' })).toBeDisabled();
});

test('a complete assignment can be set', async ({ page }) => {
  await asTeacher(page);
  await page.getByPlaceholder('Week 3 — parity').fill('Week 3 — parity');
  await page.getByPlaceholder(/Strings over/).fill('An even number of a’s.');
  await page.getByPlaceholder('(b + ab*a)*').fill('(b + ab*a)*');
  await page.getByPlaceholder('optional').fill('2');

  await page.getByRole('button', { name: 'Set the assignment' }).click();

  /*
    Twice, and that is correct rather than a duplicate: one browser is both people here, so a
    new assignment shows in the teacher's list *and* in the student's. Asserting the count
    documents that, where a `.first()` would have hidden it.
  */
  await expect(page.getByText('Week 3 — parity')).toHaveCount(2);
  await expect(page.getByText(/at most 2 states/).first()).toBeVisible();
});

/** A class with one assignment set, and a machine saved in the editor to submit. */
async function withAssignment(page: Page) {
  await page.goto('/editor');
  await expect(page.getByText('saved', { exact: true })).toBeVisible();

  await page.goto('/classroom');
  await asTeacher(page);
  await page.getByPlaceholder('Week 3 — parity').fill('Parity');
  await page.getByPlaceholder(/Strings over/).fill('An even number of a’s.');
  await page.getByPlaceholder('(b + ab*a)*').fill('(b + ab*a)*');
  await page.getByRole('button', { name: 'Set the assignment' }).click();
}

test('a newly set assignment appears without a reload', async ({ page }) => {
  // Teacher and student are two views of one state here, and the student's list is fetched
  // when it mounts — so setting an assignment left it stale. Invisible in a two-person system
  // where those are different browsers, and immediate in this one.
  await withAssignment(page);
  await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
});

test('a wrong submission comes back with the string that proves it wrong', async ({ page }) => {
  // The whole project, in the place a mark would normally go.
  await withAssignment(page);
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText(/accepts|rejects/)).toBeVisible();
  await expect(page.getByText(/Trace that string/)).toBeVisible();
});

test('every attempt is kept, not just the latest', async ({ page }) => {
  // A student asking "what did I submit at four o'clock" deserves an answer, and an appeal
  // needs the history. Keeping only the last throws both away to save a row.
  await withAssignment(page);
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/accepts|rejects/).first()).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/accepts|rejects/)).toHaveCount(2);
});

test('joining with a code that matches nothing says so', async ({ page }) => {
  await page.goto('/classroom');
  await page.getByText('Working on this?').click();
  await page.getByLabel('Development PIN').fill('9696');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.getByRole('button', { name: /Sign in/ }).click();

  await page.getByLabel('Class join code').fill('ZZZZZZ');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page.getByRole('alert')).toContainText(/No class has that code/);
});

test('results appear as soon as something is submitted', async ({ page }) => {
  await withAssignment(page);
  await expect(page.getByText('Nobody has submitted yet')).toBeVisible();

  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText(/0 of 1 solved/)).toBeVisible();
  // The column that turns a grade into feedback, and the reason to hand this back at all.
  await expect(page.getByText('Last failure')).toBeVisible();
});

test('the CSV is the one `kleene grade` writes', async ({ page }) => {
  /*
    A lecturer may mark through the browser or the command line, and the two must not produce
    different spreadsheets — whichever gets automated against becomes the real format, and the
    other quietly becomes wrong. So the header is copied verbatim rather than chosen.
  */
  await withAssignment(page);
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText(/0 of 1 solved/)).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'export csv' }).click();
  const file = await download;

  expect(file.suggestedFilename()).toBe('parity.csv');

  const path = await file.path();
  const text = await import('node:fs/promises').then((fs) => fs.readFile(path, 'utf8'));

  expect(text.split('\n')[0]).toBe('file,verdict,counterexample,direction,states');
  // ε rather than an empty cell: the empty string is a real counterexample, and a blank there
  // reads as a tool that failed to find one.
  expect(text).toContain('ε');
});
