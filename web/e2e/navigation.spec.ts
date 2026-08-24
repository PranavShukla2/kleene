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

import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { drawn } from './canvas';

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

  /*
    Assert each page has rendered before acting on it.

    This test went red once in three CI runs while passing locally on every one, and the
    difference between it and the sibling above — which has never flaked — is that the sibling
    waits for each page before touching it and this one did not. So the waits are here now.

    That is a precondition fix, not a diagnosis: the mechanism is not confirmed. What is known
    is that after `goBack` the URL was right and the heading was absent for five seconds, which
    means the app was rendering something other than the tool page — most likely the loading
    state, since a tool route is gated behind the WebAssembly module. Locally that state clears
    in 12ms after a back-navigation and 177ms from cold, so a plain timeout does not explain
    it. If this flakes again, that gap is where to look.
  */
  await expect(page.getByRole('heading', { name: 'NFA to DFA converter' })).toBeVisible();

  await page.getByRole('link', { name: 'DFA minimizer The smallest' }).click();
  await expect(page).toHaveURL(/minimize-dfa$/);
  await expect(page.getByRole('heading', { name: 'DFA minimizer' })).toBeVisible();

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
  '/jflap-alternative',
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

test('the editor exports a picture, cropped and free of interface state', async ({ page }) => {
  // Phase 4 Track C. The failures worth catching here are all invisible in the panel: an
  // export that carries the whole canvas viewport, or the simulator's highlight, or no labels
  // because the font had not loaded when the raster was taken.
  await page.goto('/editor');
  await page.getByRole('button', { name: 'SVG', exact: true }).click();

  const started = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download \.svg/ }).click();
  const file = await started;
  expect(file.suggestedFilename()).toBe('automaton.svg');

  const svg = await file.path().then((at) => readFile(at, 'utf8'));

  // Cropped: the canvas is ~1150px wide and the machine is a fraction of that.
  const width = Number(/width="(\d+)"/.exec(svg)?.[1] ?? 0);
  expect(width).toBeGreaterThan(100);
  expect(width).toBeLessThan(700);

  // Standalone: styles resolved to literals, no Tailwind classes, the font carried along.
  expect(svg).toContain('@font-face');
  expect(svg).not.toContain('class=');
  expect(svg).toMatch(/fill="rgb\(/);

  // Every label present — the bug where a raster was taken before the font arrived.
  for (const label of ['q0', 'q1', 'q2']) expect(svg).toContain(`>${label}<`);

  // And none of the interface: no selection ring, no simulator highlight, no dot grid.
  //
  // The grid check is on the *paint*, not on the word: the pattern stays in `<defs>` unused,
  // and asserting on its name would fail for a definition nothing references.
  expect(svg).not.toContain('data-ui');
  expect(svg).not.toMatch(/fill="url\(#k-grid/);
});

test('the editor exports Graphviz DOT', async ({ page }) => {
  // Phase 4 Track G. The exporter was written in Phase 1; this is the wiring, and the thing
  // worth asserting is that the tab reaches the *same* engine rather than a second one.
  await page.goto('/editor');
  await page.getByRole('button', { name: 'DOT', exact: true }).click();

  const dot = await page.getByLabel('DOT source').inputValue();

  expect(dot).toContain('digraph automaton');
  // Automata read left to right; the default top-down layout looks wrong for one.
  expect(dot).toContain('rankdir=LR');
  // Accepting states are drawn the way the subject draws them.
  expect(dot).toContain('doublecircle');
  // DOT has no notion of a start state, so one is faked from an invisible point.
  expect(dot).toContain('__start');
});

test('the first-run tour appears once and stays dismissed', async ({ page }) => {
  // Phase 5 E6. The gesture it exists for is unguessable — a transition is drawn from a
  // state's *rim*, and dragging the centre moves the state — so someone who never sees this
  // concludes the tool cannot draw transitions, which is most of what it is for.
  await page.goto('/editor');

  const tour = page.getByRole('dialog', { name: 'Getting started' });
  await expect(tour).toBeVisible();
  await expect(tour).toContainText('Double-click');

  // The card that carries the unguessable part. It is the second one, so reaching it is part
  // of what this test checks: a tour whose middle card never renders teaches nothing.
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toContainText('rim');

  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start drawing' }).click();
  await expect(tour).toHaveCount(0);

  // Being shown it twice is being told you did not learn.
  await page.reload();
  await expect(drawn(page).first()).toBeVisible();
  await expect(tour).toHaveCount(0);
});

test('the JFLAP comparison names what JFLAP does better', async ({ page }) => {
  // Phase 5 D6. The page is worth having only if it is honest — a comparison table where one
  // column sweeps every row is an advertisement, and a reader spots that immediately. This
  // asserts the concessions are actually on the page, so a later edit cannot quietly turn it
  // into marketing copy.
  await page.goto('/jflap-alternative');

  await expect(page.getByRole('heading', { name: 'Kleene and JFLAP', level: 1 })).toBeVisible();

  const main = page.getByRole('main');
  await expect(main).toContainText('Turing machines');
  await expect(main).toContainText('Pushdown automata');
  await expect(main).toContainText('Use JFLAP if');

  // The rows Kleene loses are labelled as such.
  await expect(main.getByText('JFLAP', { exact: true })).not.toHaveCount(0);
});
