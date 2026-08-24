/**
 * Capture the README's screenshots from the real, built app.
 *
 * Same reasoning as `og.mjs`: a picture drawn by hand, or taken once and never again, stops
 * being a picture of this product the first time the layout moves. This drives the actual
 * site in a real browser, so re-running it is the whole maintenance story.
 *
 * Run against a preview server:
 *
 *     npm run build && npx vite preview --port 4173 &
 *     node scripts/screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../docs/media');
const base = process.env.BASE ?? 'http://localhost:4173';

/** Two-up, wide enough that the panes are legible at GitHub's rendered width. */
const SIZE = { width: 1440, height: 900 };

const browser = await chromium.launch();
const page = await browser.newPage({ viewportSize: SIZE, deviceScaleFactor: 2 });

await mkdir(out, { recursive: true });

// The tour is for first-time users, and every run here is a first visit.
await page.addInitScript(() => {
  localStorage.setItem('kleene.tour.seen', 'yes');
});

/** The subset construction, stopped partway — the one screenshot that has to earn the project. */
await page.goto(`${base}/convert`);
await page.getByRole('textbox').first().fill('(a|b)*abb');

const dfa = page.locator('section').filter({ has: page.getByRole('heading', { name: 'DFA' }) });
await dfa.waitFor();

// Six rounds in: enough of the machine exists to see it being built, and enough is missing
// that it is visibly *not* the answer. The finished diagram would say nothing the site
// doesn't already say on its own.
const scrubber = dfa.getByRole('slider');
await scrubber.press('Home');
for (let i = 0; i < 6; i += 1) await scrubber.press('ArrowRight');

// Animations settle; the fonts are already loaded by the time the text has laid out.
await page.waitForTimeout(900);

// The two panes, not the viewport. A viewport shot puts the fixed nav across the top of the
// diagrams and crops whichever pane the scroll position happened to cut — framing the thing
// itself is both tidier and stable against the page growing above it.
// The DFA pane alone. The two-pane shot leaves half a page of white under the shorter
// ε-NFA column, and this pane is the whole argument by itself: the diagram, the transition
// table filling in, the worklist draining, and the sentence saying what the round just did.
await dfa.screenshot({ path: resolve(out, 'subset-construction.png') });

/** The editor, with a machine in it. */
await page.goto(`${base}/examples`);
// Not the first card: a two-state machine leaves the canvas looking empty, and the point of
// this shot is a workbench in use. "Odd a's and even b's" is four states and a full grid of
// transitions — busy enough to read as real work, small enough to still be legible.
await page.getByRole('button', { name: /Odd a.s and even b.s/ }).click();
await page.locator('svg[aria-label="The automaton being edited"] text').first().waitFor();
await page.waitForTimeout(600);
await page.screenshot({ path: resolve(out, 'editor.png') });

await browser.close();
console.log(`wrote ${out}/subset-construction.png and ${out}/editor.png`);
