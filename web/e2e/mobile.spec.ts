/**
 * The editor on a phone.
 *
 * Added after someone tried it on a 360px Android and could not use it. Three separate
 * failures, none of which is visible at laptop width and all of which were shipped:
 *
 * 1. The command bar is 850px of controls in a 360px window, with no way to scroll. Open,
 *    Save, Undo, Redo, the theme and the help key were off the right edge and unreachable by
 *    any gesture — not degraded, *absent*.
 * 2. A side panel is 22rem, which is wider than the content area beside the rail, so it hung
 *    off the left edge with its first column of text cut in half.
 * 3. Creating a state needs either a double-click or an HTML5 drag. Neither exists on a
 *    touchscreen, so there was no way to put anything on the canvas at all.
 *
 * The desktop layout is unchanged, which the rest of the suite already checks at 1280px. This
 * file only asserts the things that were broken below `sm`.
 */

import { expect, test, type Page } from '@playwright/test';

import { canvas } from './canvas';

// A common small Android. Narrower than an iPhone, and the width the report came from.
test.use({ viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kleene.tour.seen', 'yes');
  });
  await page.goto('/editor');
  await expect(canvas(page)).toBeVisible();
});

/** Does this element overflow its own box horizontally with no way to scroll? */
async function trapped(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((css) => {
    const element = document.querySelector(css);
    if (!element) throw new Error(`no ${css}`);
    const overflows = element.scrollWidth > element.clientWidth;
    const scrollable = getComputedStyle(element).overflowX !== 'visible';
    return overflows && !scrollable;
  }, selector);
}

test('every command in the bar can be reached', async ({ page }) => {
  // The bar is wider than the phone and always will be. What matters is that the overflow is
  // reachable rather than clipped away.
  expect(await trapped(page, 'header')).toBe(false);

  for (const name of ['Arrange', 'Open', 'Save', 'Install']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeVisible();
  }
});

test('the status bar stays on one line', async ({ page }) => {
  // It wrapped to two lines inside a 28px strip, so the second line was clipped and the first
  // was half a line of text. The two least useful facts are hidden at this width instead.
  const bar = page.locator('footer');
  const height = (await bar.boundingBox())?.height ?? 0;
  expect(height).toBeLessThan(40);
  expect(await trapped(page, 'footer')).toBe(false);
});

test('a panel fits beside the rail instead of hanging off the screen', async ({ page }) => {
  await page
    .getByRole('navigation', { name: 'Panels' })
    .getByRole('button', { name: 'Define' })
    .tap();

  const panel = page.getByRole('complementary', { name: 'Define' });
  const box = await panel.boundingBox();
  const view = page.viewportSize();
  if (!box || !view) throw new Error('no layout');

  // Nothing off the left edge, which is where the text was being cut.
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(view.width);
});

test('the rail stays reachable while a panel is open', async ({ page }) => {
  // A touchscreen has no escape key. If the panel covered the rail there would be no visible
  // way back to the diagram.
  const rail = page.getByRole('navigation', { name: 'Panels' });
  await rail.getByRole('button', { name: 'Table' }).tap();
  await expect(page.getByRole('complementary', { name: 'Table' })).toBeVisible();
  await expect(rail.getByRole('button', { name: 'Export' })).toBeVisible();

  await rail.getByRole('button', { name: 'Table' }).tap();
  await expect(page.getByRole('complementary')).toHaveCount(0);
});

test('tapping the chip adds a state, because nothing else can', async ({ page }) => {
  // `dragstart` never fires from a touch and double-click is not a gesture a phone has, so
  // without this there is no way to create a state on a touchscreen.
  await expect(page.getByText('3 states')).toBeVisible();
  await page.getByRole('button', { name: /Add a state/ }).tap();
  await expect(page.getByText('4 states')).toBeVisible();
});
