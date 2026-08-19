/**
 * Track D's claim, automated: the DFA pane shows the construction, not the answer.
 *
 * Everything here is checked through the page, because the thing that could break is not the
 * arithmetic — `construction.test.ts` covers that against a hand-built run — but the wiring
 * between three panes, a wasm call and a scrubber. The bug this exists to catch is the one
 * where the frames are perfect and the diagram draws the finished machine anyway.
 */

import { expect, test, type Page } from '@playwright/test';

/** The regular expression used throughout: five DFA states, twelve rounds, one repeat. */
const SOURCE = '(a|b)*abb';

/** The DFA pane. Named by its heading so a layout change does not silently retarget this. */
function dfaPane(page: Page) {
  return page.locator('section').filter({ has: page.getByRole('heading', { name: 'DFA' }) });
}

async function type(page: Page): Promise<void> {
  await page.goto('/convert');
  await page.getByRole('textbox').first().fill(SOURCE);
  await expect(dfaPane(page)).toBeVisible();
}

/** Run the construction to its end. `End` on the range input, which is what a reader would do. */
async function toTheEnd(page: Page): Promise<void> {
  await dfaPane(page).getByRole('slider').press('End');
}

test('the DFA pane starts with one state and discovers the rest', async ({ page }) => {
  await type(page);
  const pane = dfaPane(page);

  // Step one is the ε-closure of the start state, and nothing else exists yet.
  await expect(pane.getByText('1 of 5 states')).toBeVisible();
  await expect(pane.locator('svg text', { hasText: /^A$/ })).toBeVisible();
  await expect(pane.locator('svg text', { hasText: /^E$/ })).toHaveCount(0);

  // Walk to the end. The last step must land on the whole machine — an animation that
  // finished somewhere other than the result would be a lie about the algorithm.
  await toTheEnd(page);
  await expect(pane.getByText('5 states', { exact: true })).toBeVisible();
  await expect(pane.locator('svg text', { hasText: /^E$/ })).toBeVisible();
});

test('the worklist drains as the construction runs', async ({ page }) => {
  await type(page);
  const pane = dfaPane(page);
  const worklist = pane.getByText('worklist');

  await expect(worklist).toBeVisible();
  // A discovered subset waits its turn before it is expanded.
  await expect(pane.getByTitle('discovered, waiting its turn').first()).toBeVisible();

  await toTheEnd(page);
  await expect(pane.getByText(/every subset has been expanded/)).toBeVisible();
  await expect(pane.getByTitle('discovered, waiting its turn')).toHaveCount(0);
});

test('δ fills in cell by cell, and says which cells are not worked out yet', async ({ page }) => {
  await type(page);
  const pane = dfaPane(page);

  // At the first step exactly one row exists, and neither of its cells is known.
  await expect(pane.getByTitle('not worked out yet')).toHaveCount(2);

  await toTheEnd(page);
  // A finished DFA over {a, b} is total: five rows, two columns, nothing left unknown.
  await expect(pane.getByTitle('not worked out yet')).toHaveCount(0);
});

test('a round says whether the subset it reached was new', async ({ page }) => {
  await type(page);
  const pane = dfaPane(page);
  const slider = pane.getByRole('slider');

  // The distinction D5 exists for. Somewhere in twelve rounds is at least one of each, and
  // both have to be visible as a *word*, not only as a difference in the diagram.
  const seen = new Set<string>();
  for (let step = 0; step < 12; step++) {
    if (await pane.getByText('new subset →').isVisible()) seen.add('new');
    if (await pane.getByText('already seen —').isVisible()) seen.add('repeat');
    await slider.press('ArrowRight');
  }

  expect([...seen].sort()).toEqual(['new', 'repeat']);
});

test('any round can be unfolded into the ε-closure behind it', async ({ page }) => {
  await type(page);
  const pane = dfaPane(page);

  const open = pane.getByRole('button', { name: /ε-closure of .* one state at a time/ });
  await open.click();

  // The drill-down is a trace of its own, and its first line is the rule the whole thing
  // rests on: every state is in its own closure.
  await expect(pane.getByText(/Every state is in its own ε-closure/)).toBeVisible();

  await pane.getByRole('button', { name: 'Next state added' }).click();
  await expect(pane.getByText(/joins the closure/)).toBeVisible();
});
