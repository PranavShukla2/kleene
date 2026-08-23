/**
 * Tracks E and F through the page (tasks H1, H2).
 *
 * The arithmetic behind both is already covered in Rust and in `refinement.test.ts`. What is
 * not covered without a browser is the wiring: two views sharing one scrubber, a section that
 * fetches its own trace, and a refusal that has to read as a sentence rather than an error.
 */

import { expect, test, type Page } from '@playwright/test';

/** `(a|b)*abb` — five DFA states, four after minimization. The canonical worked example. */
const SOURCE = '(a|b)*abb';

function minimalPane(page: Page) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Minimal DFA' }) });
}

/**
 * Open the converter with the minimal pane showing.
 *
 * It is off by default (decision D9: subset construction is what the page is named for), so
 * every test here starts by turning it on — which is also the gesture a reader makes.
 */
async function open(page: Page, expression = SOURCE) {
  await page.goto(`/convert?q=${encodeURIComponent(expression)}`);
  await page.getByRole('button', { name: /^Minimal DFA/ }).click();
  await expect(minimalPane(page)).toBeVisible();
}

test('the minimal DFA is smaller than the DFA it came from', async ({ page }) => {
  await open(page);
  // Phase 3's own exit criterion (H2), asserted on the number that is the entire argument
  // for minimization.
  await expect(page.getByText('minimization: 5 → 4 states')).toBeVisible();
});

test('the refinement shows blocks and the table, and keeps its place between them', async ({
  page,
}) => {
  await open(page);
  const pane = minimalPane(page);

  const slider = pane.getByRole('slider');
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');
  const at = await slider.inputValue();

  await pane.getByRole('button', { name: 'table' }).click();
  // Named, because the pane also holds δ — two tables, and the ambiguity is real rather than
  // a selector to work around.
  await expect(pane.getByRole('table', { name: /Myhill/ })).toBeVisible();

  // Task E7. The position was never the view's to hold, and this is what says so.
  await expect(slider).toHaveValue(at);

  await pane.getByRole('button', { name: 'blocks' }).click();
  await expect(slider).toHaveValue(at);
});

test('a marked cell carries the string that separates its pair', async ({ page }) => {
  await open(page);
  const pane = minimalPane(page);
  await pane.getByRole('slider').press('End');
  await pane.getByRole('button', { name: 'table' }).click();

  // Task E3, and the thing other tools do not show. A cross would answer "are these
  // different"; the exam asks how you know.
  await expect(pane.getByTitle(/separated in round \d+ by/).first()).toBeVisible();
});

test('state elimination converts the DFA back to an expression', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Back to a regular expression/ }).click();

  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /^Regular expression/ }) });

  await expect(section.getByText('answer', { exact: true })).toBeVisible();
  // The answer is present from the first step, not only at the end (task F4).
  await expect(section.getByRole('slider')).toHaveValue('0');
  await expect(section.locator('code').first()).not.toBeEmpty();
});

test('choosing a different elimination order changes the working', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: /Back to a regular expression/ }).click();

  const section = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: /^Regular expression/ }) });
  const answer = section.locator('code').first();
  const first = await answer.innerText();

  await section.getByRole('button', { name: 'in order' }).click();

  // Both are correct; they are different expressions for one language, which is exactly what
  // makes offering the choice useful rather than confusing.
  await expect(answer).not.toHaveText(first);
});

test('a machine too large to convert says so, and says what to do', async ({ page }) => {
  // 65 states. Elimination would produce an expression nobody could read, so it declines.
  await open(page, '(a+b)*a(a+b)(a+b)(a+b)(a+b)(a+b)');
  await page.getByRole('button', { name: /Back to a regular expression/ }).click();

  await expect(page.getByText(/Minimize it first/)).toBeVisible();
});
