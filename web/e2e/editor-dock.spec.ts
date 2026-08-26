/**
 * The rail, and the panels it opens.
 *
 * The editor used to show seven panels at once in a permanent column. What replaced it has a
 * property worth pinning down: **the canvas is the only thing always on screen.** Every panel
 * is reachable, exactly one is open at a time, and closing gets you back to a diagram.
 *
 * Also here because the change is easy to regress in a way that looks fine. A second panel
 * quietly staying open, or a panel that cannot be closed, costs the canvas its width again —
 * which is the entire reason any of this moved.
 */

import { expect, test, type Page } from '@playwright/test';

import { canvas, openPanel } from './canvas';

const PANELS = ['Selection', 'Table', 'Run', 'Define', 'Export'] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // The tour is a first-run thing and would otherwise open over the canvas in every test.
    localStorage.setItem('kleene.tour.seen', 'yes');
  });
  await page.goto('/editor');
  await expect(canvas(page)).toBeVisible();
});

test('the rail names every panel without opening a menu', async ({ page }) => {
  // The one thing the always-open column was really buying: you can see what exists. A rail
  // that hides its contents behind a menu would have given that up to save the width.
  const rail = page.getByRole('navigation', { name: 'Panels' });
  for (const name of PANELS) {
    await expect(rail.getByRole('button', { name })).toBeVisible();
  }
});

test('nothing is open on a first visit', async ({ page }) => {
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('every panel opens, and only one at a time', async ({ page }) => {
  for (const name of PANELS) {
    await openPanel(page, name);
    await expect(page.getByRole('complementary', { name })).toBeVisible();
    // The property that keeps the canvas: opening one panel closes the last.
    await expect(page.getByRole('complementary')).toHaveCount(1);
  }
});

test('the rail button that opened a panel also closes it', async ({ page }) => {
  const button = page.getByRole('navigation', { name: 'Panels' }).getByRole('button', {
    name: 'Table',
  });

  await button.click();
  await expect(page.getByRole('complementary', { name: 'Table' })).toBeVisible();
  await expect(button).toHaveAttribute('aria-pressed', 'true');

  await button.click();
  await expect(page.getByRole('complementary')).toHaveCount(0);
  await expect(button).toHaveAttribute('aria-pressed', 'false');
});

test('escape closes an open panel', async ({ page }) => {
  // Expected of anything covering what you were looking at. Without it the only way out is to
  // find the same rail button again, which is a worse answer than every dialog already gives.
  await openPanel(page, 'Define');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('the open panel survives a reload', async ({ page }) => {
  await openPanel(page, 'Export');
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Export' })).toBeVisible();
});

test('the transition table opens along the bottom, at full width', async ({ page }) => {
  // The reason `edge` is a property of a panel rather than a layout preference. A table is
  // wide, and the old 288px column made it stop looking like one.
  await openPanel(page, 'Table');

  const panel = page.getByRole('complementary', { name: 'Table' });
  const table = await panel.boundingBox();
  const view = page.viewportSize();
  if (!table || !view) throw new Error('no layout');

  // Most of the window's width, and along the bottom of it.
  expect(table.width).toBeGreaterThan(view.width * 0.8);
  expect(table.y + table.height).toBeGreaterThan(view.height * 0.7);
});

test('a bottom panel does not cover the problem strip or the palette', async ({ page }) => {
  // What the strip says is most worth reading when someone has just opened the table to work
  // out why — so a sheet that covers it is at its most wrong exactly when it matters. Same for
  // the chip: an affordance that disappears when a panel opens is missing whenever someone is
  // midway through something.
  const problems = page.getByText('No problems.');
  const chip = page.getByRole('button', { name: /Add a state/ });

  await expect(problems).toBeVisible();
  await expect(chip).toBeVisible();

  await openPanel(page, 'Table');

  await expect(problems).toBeVisible();
  await expect(chip).toBeVisible();

  /*
    Visible is not enough — an element behind an opaque sheet still reports visible. The strip
    has to sit *below* the panel, not under it.

    Polled rather than measured once: the panel slides in, so a single measurement taken the
    moment it exists catches it a few pixels short of its resting place and fails by five.
    Waiting for a fixed number of milliseconds instead would be the same guess this suite has
    already been bitten by twice.
  */
  await expect
    .poll(async () => {
      const strip = await problems.boundingBox();
      const panel = await page.getByRole('complementary', { name: 'Table' }).boundingBox();
      if (!strip || !panel) return -1;
      return Math.round(strip.y - (panel.y + panel.height));
    })
    .toBe(0);
});

test('a state can be dragged onto the canvas', async ({ page }) => {
  // The affordance an empty canvas otherwise lacks: double-click works and is faster, but
  // nothing on screen says so.
  await expect(page.getByText('3 states')).toBeVisible();

  const chip = page.getByRole('button', { name: /Add a state/ });
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('no canvas');

  await chip.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + 600, box.y + 300, { steps: 12 });
  await page.mouse.move(box.x + 620, box.y + 320, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByText('4 states')).toBeVisible();
});

test('the canvas can be cleared, and undo brings it back', async ({ page }) => {
  // `Mod+A` then `Backspace` always did this. The point of the button is that nothing on
  // screen said so.
  await expect(page.getByText('3 states')).toBeVisible();

  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByText('0 states')).toBeVisible();

  // One press, not one per state — which is what makes offering it without a confirmation
  // dialog reasonable in the first place.
  await page.getByRole('button', { name: /^Undo/ }).click();
  await expect(page.getByText('3 states')).toBeVisible();
});

test('Clear is disabled when there is nothing to clear', async ({ page }) => {
  // `exact`, because undo names the command it will reverse — so after clearing there is also
  // an "Undo clear the canvas" button, and a substring match finds two.
  const clear = page.getByRole('button', { name: 'Clear', exact: true });
  await clear.click();
  await expect(page.getByText('0 states')).toBeVisible();
  await expect(clear).toBeDisabled();
});

test('Install answers the question even where the browser will not help', async ({ page }) => {
  /*
    Chromium in a test never fires `beforeinstallprompt`, so this exercises the branch that
    matters most anyway: the one Safari and Firefox users are permanently in. A button that
    quietly disappeared there would leave "where is the download" unanswered, which is the
    complaint that produced this.
  */
  await page.getByRole('button', { name: 'Install' }).click();

  const dialog = page.getByRole('dialog', { name: 'Installing Kleene' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('no separate application to download');
  await expect(dialog).toContainText('Safari');
  await expect(dialog).toContainText('Firefox');

  // Rendered through a portal, because the command bar's backdrop-blur would otherwise make
  // `position: fixed` resolve against a 44px header. Checking it is centred catches that
  // returning — it looked like a clipped dialog and the CSS on it was correct.
  const box = await dialog.boundingBox();
  const view = page.viewportSize();
  if (!box || !view) throw new Error('no layout');
  expect(box.y).toBeGreaterThan(40);
  expect(box.y + box.height).toBeLessThanOrEqual(view.height);

  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toHaveCount(0);
});

/** The centre of a state, found by its label. */
async function stateAt(page: Page, label: string) {
  const box = await page
    .locator('svg text')
    .filter({ hasText: new RegExp(`^${label}$`) })
    .first()
    .boundingBox();
  if (!box) throw new Error(`no state ${label}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test('two states can be connected without touching a rim', async ({ page }) => {
  /*
    Dragging from a state's *rim* is the existing way to draw a transition, and it is the least
    guessable thing in the editor — the tour spends a card on it. It is also close to unusable
    with a finger: the rim is a few pixels wide and those pixels are under the fingertip aiming
    at them.

    So the same job as a mode: press connect, tap the state the arrow leaves, tap the one it
    arrives at. Two targets the size of a state.
  */
  await expect(page.getByText('6 transitions')).toBeVisible();

  await page.locator('[data-connect]').click();
  await expect(page.locator('[data-connect]')).toHaveAttribute('aria-pressed', 'true');

  const from = await stateAt(page, 'q0');
  const to = await stateAt(page, 'q1');
  await page.mouse.click(from.x, from.y);
  await page.mouse.click(to.x, to.y);

  await expect(page.getByText('7 transitions')).toBeVisible();
});

test('connect mode stays armed, because transitions come in groups', async ({ page }) => {
  // Re-pressing the chip between every edge would make drawing five of them nine gestures.
  await page.locator('[data-connect]').click();

  const from = await stateAt(page, 'q0');
  const to = await stateAt(page, 'q1');
  await page.mouse.click(from.x, from.y);
  await page.mouse.click(to.x, to.y);
  await page.keyboard.press('Escape'); // dismiss the symbol editor

  await expect(page.locator('[data-connect]')).toHaveAttribute('aria-pressed', 'true');
});

test('escape leaves connect mode', async ({ page }) => {
  // A mode with no visible way out is a trap.
  await page.locator('[data-connect]').click();
  await expect(page.locator('[data-connect]')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-connect]')).toHaveAttribute('aria-pressed', 'false');
});

test('pressing empty canvas leaves connect mode too', async ({ page }) => {
  // The gesture everyone tries when they want out.
  await page.locator('[data-connect]').click();

  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('no canvas');
  await page.mouse.click(box.x + box.width - 80, box.y + box.height - 80);

  await expect(page.locator('[data-connect]')).toHaveAttribute('aria-pressed', 'false');
});
