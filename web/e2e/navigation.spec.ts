/**
 * Navigation that stays *within* one route.
 *
 * Every one of these passed by inspection and failed in a browser, because the router held a
 * `Route` and nothing else. Moving from `/tools/nfa-to-dfa` to `/tools/minimize-dfa` is one
 * route to the same route, so React was handed the value it already had, saw no change, and
 * left the previous page on screen under the new URL.
 *
 * That is not a class of bug a unit test on the router can catch — `routeOf` was right the
 * whole time. It needs a real history stack and a real render, which is what this file is.
 */

import { expect, test } from '@playwright/test';

test('moving between two tool pages actually changes the page', async ({ page }) => {
  await page.goto('/tools/nfa-to-dfa');
  await expect(page.getByRole('heading', { name: 'NFA to DFA converter' })).toBeVisible();

  // Scoped to the page body: the footer links to the same tool, and the pair is a genuine
  // ambiguity rather than a selector to work around.
  await page.getByRole('link', { name: 'DFA minimizer The smallest' }).click();

  await expect(page).toHaveURL(/\/tools\/minimize-dfa$/);
  await expect(page.getByRole('heading', { name: 'DFA minimizer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'NFA to DFA converter' })).toHaveCount(0);
});

test('the back button returns to the previous tool page', async ({ page }) => {
  await page.goto('/tools/nfa-to-dfa');
  await page.getByRole('link', { name: 'DFA minimizer The smallest' }).click();
  await expect(page).toHaveURL(/minimize-dfa$/);

  await page.goBack();

  await expect(page).toHaveURL(/nfa-to-dfa$/);
  await expect(page.getByRole('heading', { name: 'NFA to DFA converter' })).toBeVisible();
});

test('a new expression from the palette reaches the converter already open', async ({
  page,
}) => {
  await page.goto('/convert?q=a*b*');
  const bar = page.getByRole('textbox').first();
  await expect(bar).toHaveValue('a*b*');

  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').fill('(ab)*+b');
  await page.keyboard.press('Enter');

  // The URL used to change here while the bar kept the old expression, which reads as the
  // command palette having silently failed.
  await expect(bar).toHaveValue('(ab)*+b');
});

test('the palette can open a concept by name, and lands on it', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox').fill('closure');

  await page.getByRole('option', { name: /ε-closure/ }).click();

  await expect(page).toHaveURL(/\/learn#epsilon-closure$/);
  // Scrolled to, not merely present: the whole point of the deep link.
  await expect(page.locator('#epsilon-closure')).toBeInViewport();
});

test('a footer link to a tool keeps the running app', async ({ page }) => {
  await page.goto('/about');
  // Marked before the click and read after: a client-side navigation preserves it, and a full
  // document load does not. That is the whole difference being tested, and it is invisible to
  // any assertion about the URL.
  await page.evaluate(() => {
    (window as unknown as { kept?: boolean }).kept = true;
  });

  await page.getByRole('link', { name: 'NFA to DFA', exact: true }).click();

  await expect(page).toHaveURL(/\/tools\/nfa-to-dfa$/);
  expect(await page.evaluate(() => (window as unknown as { kept?: boolean }).kept)).toBe(true);
});

test('an unknown tool slug is a 404 rather than a different tool', async ({ page }) => {
  await page.goto('/tools/does-not-exist');
  await expect(page.getByRole('heading', { name: /no page at that address/ })).toBeVisible();
  await expect(page.getByText('/tools/does-not-exist')).toBeVisible();
});

/**
 * Landmarks and headings, on every page.
 *
 * Both of these regressed silently while the pages looked perfect. Making `Convert`
 * embeddable turned its `<main>` into a `<div>`, so `/convert` had nothing for a screen
 * reader to skip to; and the editor never had an `h1` at all, so jumping by heading found
 * nothing. Neither is visible, which is exactly why it is worth a test rather than a look.
 */
const PAGES = [
  '/',
  '/editor',
  '/convert',
  '/examples',
  '/learn',
  '/docs',
  '/pricing',
  '/roadmap',
  '/changelog',
  '/about',
  '/tools/nfa-to-dfa',
];

for (const path of PAGES) {
  test(`${path} has one main landmark and one h1`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);
  });
}

test('the editor exports the machine it is showing, as TikZ', async ({ page }) => {
  // Phase 4 A/B. The promise is that what is on screen is what comes out, so this asserts on
  // the *content* rather than on the panel existing — a snippet that renders a different
  // machine is the failure worth catching, and it looks perfectly fine on screen.
  await page.goto('/editor');

  const source = page.getByLabel('TikZ source');
  await expect(source).toBeVisible();
  const tex = await source.inputValue();

  expect(tex).toContain('\\begin{tikzpicture}');
  // The preamble it needs, because the commonest failure is a correct picture that will not
  // compile in the document it was pasted into.
  expect(tex).toContain('\\usetikzlibrary{automata,positioning}');
  // `ends_with_ab` is the default document: three states, one accepting, one initial.
  expect(tex.match(/\\node/g)).toHaveLength(3);
  expect(tex).toContain('state,initial');
  expect(tex).toContain('state,accepting');
  // Shifted to the origin rather than carrying the canvas's layout offset.
  expect(tex).toContain('(0.00,0.00)');
});
