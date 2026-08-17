/**
 * Visual regression for edge routing and label placement.
 *
 * Renders every fixture to an `.svg` file and compares it to the committed one. The snapshots
 * are real SVGs, openable in a browser, and carry a small inline stylesheet so they look the
 * way the app draws them rather than like invisible black shapes — because a snapshot nobody
 * can look at only tells you *that* something changed, and the whole point of these is to show
 * *what*.
 *
 * A failing snapshot is not automatically a bug. Routing changes are supposed to move these
 * files. What the test guarantees is that they cannot move without someone seeing it, which is
 * the thing that was missing when a curve was found passing straight through a state.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AutomatonView } from '@/canvas/AutomatonView';
import { FIXTURES } from '@/canvas/fixtures';
import { groupEdges } from '@/canvas/geometry';

/**
 * The design tokens the renderer's classes stand for, inlined.
 *
 * Deliberately the light palette only. These files exist to be *looked at*, and pinning one
 * scheme keeps the diff about geometry; theming is design-system.md's business and has its own
 * checks. Kept in sync by eye, which is acceptable precisely because a wrong colour here is
 * obvious the moment a snapshot is opened.
 */
const STYLE = `<style>
  svg { --color-k-canvas: #fbfbfd; background: var(--color-k-canvas); }
  .fill-k-surface-raised { fill: #ffffff; }
  .stroke-k-text-muted { stroke: #4c5570; }
  .stroke-k-accepting { stroke: #14b8c4; }
  .fill-k-text { fill: #1a1d2b; }
  .fill-k-grid-dot { fill: #dcdde6; }
  text { font-family: ui-monospace, monospace; }
</style>`;

/** Newline between elements, so a diff points at one shape rather than one enormous line. */
function readable(markup: string): string {
  return markup.replace(/></g, '>\n<');
}

describe('routing fixtures', () => {
  it.each(FIXTURES)('$name', async (fixture) => {
    const markup = renderToStaticMarkup(
      <AutomatonView
        automaton={fixture.automaton}
        layout={fixture.layout}
        title={fixture.why}
        className="w-full"
      />,
    );

    await expect(readable(`${STYLE}\n${markup}`)).toMatchFileSnapshot(
      `./__fixtures__/${fixture.name}.svg`,
    );
  });

  it('draws exactly one label per grouped edge, in every fixture', () => {
    // The invariant the snapshots cannot state for themselves. A snapshot proves the output
    // did not change; it cannot prove the output was ever right. Losing a label to placement,
    // or drawing one twice, would sail past twelve happy snapshots.
    for (const fixture of FIXTURES) {
      const markup = renderToStaticMarkup(
        <AutomatonView
          automaton={fixture.automaton}
          layout={fixture.layout}
          title={fixture.name}
        />,
      );
      const expected = groupEdges(fixture.automaton.transitions).length;
      // One <text> per state label, plus one per edge label.
      const texts = markup.match(/<text/g)?.length ?? 0;

      expect(texts, fixture.name).toBe(fixture.automaton.states.length + expected);
    }
  });

  it('emits no NaN coordinates, even in the degenerate layouts', () => {
    // Overlapping states divide by a distance that is nearly zero. A NaN in a path attribute
    // makes the whole path vanish silently — no error, no warning, just a missing transition.
    for (const fixture of FIXTURES) {
      const markup = renderToStaticMarkup(
        <AutomatonView
          automaton={fixture.automaton}
          layout={fixture.layout}
          title={fixture.name}
        />,
      );
      expect(markup, fixture.name).not.toMatch(/NaN|Infinity/);
    }
  });

  it('gives every fixture a distinct name and a stated reason', () => {
    // A fixture whose purpose is not written down gets deleted by whoever cannot tell it from
    // the one above it. The names are also snapshot filenames, so collisions would silently
    // have two fixtures overwrite one file.
    expect(new Set(FIXTURES.map((f) => f.name)).size).toBe(FIXTURES.length);
    for (const fixture of FIXTURES) {
      expect(fixture.why.length, fixture.name).toBeGreaterThan(40);
    }
  });
});
