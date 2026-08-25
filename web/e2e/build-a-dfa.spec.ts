/**
 * Phase 2's exit criterion, automated.
 *
 * *"You can build and test the 'even number of a's' DFA end to end without touching a config
 * file."* This builds it with nothing but pointer and keyboard gestures — no store access, no
 * seeded document, no test-only hooks — and then runs strings through it.
 *
 * That constraint is the whole value. A test that reached into the store would prove the store
 * works, which is already known from 240 unit tests. What is *not* known without this is
 * whether eleven gestures in sequence still produce the right automaton, and that is the thing
 * that breaks when a hit target moves by four pixels.
 */

import { expect, test, type Page } from '@playwright/test';

import { canvas, openPanel } from './canvas';

/** State radius, from `GEOM.radius`. Duplicated because e2e sees pixels, not modules. */
const RADIUS = 24;

/** Where the canvas sits, so gestures can be given in diagram coordinates. */
async function canvasOrigin(page: Page): Promise<{ x: number; y: number }> {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('canvas not on screen');
  return { x: box.x, y: box.y };
}

/** Start from nothing, using the UI: select everything, delete it. */
async function emptyTheCanvas(page: Page): Promise<void> {
  const origin = await canvasOrigin(page);
  await page.mouse.click(origin.x + 900, origin.y + 500);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await expect(page.getByText('0 states')).toBeVisible();
}

/** Double-click empty canvas to place a state at a diagram point. */
async function addState(page: Page, x: number, y: number): Promise<void> {
  const origin = await canvasOrigin(page);
  await page.mouse.dblclick(origin.x + x, origin.y + y);
}

/**
 * Drag from a state's rim to another state, then type the symbol.
 *
 * The rim, not the centre — a drag from the middle moves the state instead. That distinction
 * is the single most breakable thing in the editor, which is why this is a gesture rather than
 * a store call.
 */
async function connect(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  symbol: string,
): Promise<void> {
  const origin = await canvasOrigin(page);
  await page.mouse.move(origin.x + from.x + RADIUS - 4, origin.y + from.y);
  await page.mouse.down();
  // An intermediate move, so the drag passes the threshold before arriving. A single jump can
  // land as a click, which is a real way for a person to fail to draw an edge too.
  await page.mouse.move(origin.x + (from.x + to.x) / 2 + 8, origin.y + (from.y + to.y) / 2 - 8);
  await page.mouse.move(origin.x + to.x, origin.y + to.y);
  await page.mouse.up();

  // Drawing an edge opens the symbol editor on it, so the symbol is the next keystroke.
  const editor = page.locator('input').first();
  await expect(editor).toBeFocused();
  await page.keyboard.type(symbol);
  await page.keyboard.press('Enter');
}

/** Run a string and read the verdict chip. */
async function verdictFor(page: Page, input: string): Promise<string> {
  // The input tester lives behind the rail's Run button now. Asked for the way a person asks
  // for it, rather than assumed to be on screen.
  await openPanel(page, 'Run');
  const field = page.getByLabel('Input string to test');
  await field.fill(input);
  await expect(field).toHaveValue(input);
  return (await page.getByTestId('verdict').innerText()).trim().toLowerCase();
}

test.describe('the even-number-of-a’s DFA, built by hand', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/editor');
    await expect(canvas(page)).toBeVisible();
    // The engine has to have loaded, or the panels are not there to assert against.
    await expect(page.getByText('kleene-core')).toBeVisible();
  });

  test('accepts strings with an even number of a’s and rejects the rest', async ({ page }) => {
    await emptyTheCanvas(page);

    // Two states: even (accepting, and the start by virtue of being first) and odd.
    const even = { x: 220, y: 220 };
    const odd = { x: 460, y: 220 };
    await addState(page, even.x, even.y);
    await addState(page, odd.x, odd.y);
    await expect(page.getByText('2 states')).toBeVisible();

    // The empty string has zero a’s, which is even — so the start state accepts.
    const origin = await canvasOrigin(page);
    await page.mouse.dblclick(origin.x + even.x, origin.y + even.y);

    // Reading `a` flips the parity; reading `b` does not.
    await connect(page, even, odd, 'a');
    await connect(page, odd, even, 'a');
    await connect(page, even, even, 'b');
    await connect(page, odd, odd, 'b');

    // Built correctly, this is a DFA — every state has exactly one move per symbol.
    await expect(page.getByText('DFA', { exact: true })).toBeVisible();
    await expect(page.getByText('No problems.')).toBeVisible();

    // Zero a’s, and zero is even — so the empty string is in the language.
    expect(await verdictFor(page, '')).toContain('accepted');
    expect(await verdictFor(page, 'bbb')).toContain('accepted');
    expect(await verdictFor(page, 'aa')).toContain('accepted');
    expect(await verdictFor(page, 'aab')).toContain('accepted');
    expect(await verdictFor(page, 'abba')).toContain('accepted');

    expect(await verdictFor(page, 'a')).toContain('rejected');
    expect(await verdictFor(page, 'ab')).toContain('rejected');
    expect(await verdictFor(page, 'bab')).toContain('rejected');
    expect(await verdictFor(page, 'aaa')).toContain('rejected');
  });

  test('undo walks the whole build back', async ({ page }) => {
    // Undo is claimed to cover every command. The cheapest honest check is to build
    // something and press it until there is nothing left, then confirm the document is the
    // one the session started from rather than merely a smaller one.
    await emptyTheCanvas(page);
    await addState(page, 220, 220);
    await addState(page, 460, 220);
    await connect(page, { x: 220, y: 220 }, { x: 460, y: 220 }, 'a');

    await expect(page.getByText('2 states')).toBeVisible();
    await expect(page.getByText('1 transitions')).toBeVisible();

    for (let i = 0; i < 12; i += 1) await page.keyboard.press('ControlOrMeta+z');

    // Back past the deletion that emptied the canvas, so the example is here again.
    await expect(page.getByText('3 states')).toBeVisible();
  });
});
