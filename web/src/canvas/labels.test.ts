import { describe, expect, it } from 'vitest';

import { GEOM, type Point } from '@/canvas/geometry';
import {
  labelRect,
  labelSize,
  overlapArea,
  placeLabels,
  startArrowRect,
  stateRect,
  type LabelRequest,
} from '@/canvas/labels';

/** A request whose only option is `at`, for pinning down what the pass does under pressure. */
function fixed(key: string, text: string, at: Point): LabelRequest {
  return { key, text, candidates: [at] };
}

describe('label sizing', () => {
  it('grows with the text', () => {
    expect(labelSize('a').width).toBeLessThan(labelSize('a, b, c').width);
  });

  it('is one line tall however long the text', () => {
    expect(labelSize('a').height).toBe(labelSize('a, b, c, d, e, f').height);
  });

  it('includes the plate, so labels that just clear each other really do', () => {
    // The halo is drawn, so it occupies space. Sizing to the glyphs alone lets two labels
    // pass the collision test while visibly touching on screen.
    expect(labelSize('a').width).toBeGreaterThan(7.2);
  });

  it('centres its rectangle on the anchor', () => {
    const rect = labelRect({ x: 100, y: 50 }, 'ab');
    expect(rect.x + rect.width / 2).toBeCloseTo(100, 9);
    expect(rect.y + rect.height / 2).toBeCloseTo(50, 9);
  });
});

describe('overlapArea', () => {
  const unitSquare = { x: 0, y: 0, width: 10, height: 10 };

  it('is zero for disjoint rectangles', () => {
    expect(overlapArea(unitSquare, { x: 20, y: 0, width: 10, height: 10 })).toBe(0);
  });

  it('is zero for rectangles that merely touch', () => {
    // Touching is fine; a label may sit flush against a state without being unreadable.
    expect(overlapArea(unitSquare, { x: 10, y: 0, width: 10, height: 10 })).toBe(0);
  });

  it('is the shared area when they cross', () => {
    expect(overlapArea(unitSquare, { x: 5, y: 5, width: 10, height: 10 })).toBe(25);
  });

  it('is the smaller area when one contains the other', () => {
    expect(overlapArea(unitSquare, { x: -5, y: -5, width: 20, height: 20 })).toBe(100);
  });
});

describe('stateRect', () => {
  it('covers the whole circle', () => {
    const rect = stateRect({ x: 0, y: 0 });
    expect(rect.width).toBe(GEOM.radius * 2);
    expect(rect.height).toBe(GEOM.radius * 2);
  });
});

describe('startArrowRect', () => {
  it('sits to the left of the state, clear of it', () => {
    const rect = startArrowRect({ x: 100, y: 100 });
    expect(rect.x + rect.width).toBeLessThanOrEqual(100 - GEOM.radius);
  });
});

describe('placeLabels', () => {
  it('takes the preferred candidate when nothing is in the way', () => {
    const at = { x: 500, y: 500 };
    const [placed] = placeLabels([{ key: 'e', text: 'a', candidates: [at, { x: 0, y: 0 }] }], []);

    expect(placed?.at).toEqual(at);
    expect(placed?.displaced).toBe(false);
    expect(placed?.colliding).toBe(false);
  });

  it('moves to the next candidate rather than sit on a state', () => {
    // The whole point of C6. A label over a state is unreadable *and* hides the state's
    // name, so it is two failures rather than one.
    const state = { x: 100, y: 100 };
    const [placed] = placeLabels(
      [{ key: 'e', text: 'a', candidates: [state, { x: 100, y: 200 }] }],
      [stateRect(state)],
    );

    expect(placed?.at).toEqual({ x: 100, y: 200 });
    expect(placed?.displaced).toBe(true);
    expect(placed?.colliding).toBe(false);
  });

  it('keeps two labels off each other', () => {
    const contested = { x: 100, y: 100 };
    const [first, second] = placeLabels(
      [
        { key: 'a', text: 'a', candidates: [contested] },
        { key: 'b', text: 'b', candidates: [contested, { x: 100, y: 300 }] },
      ],
      [],
    );

    expect(first?.at).toEqual(contested);
    expect(second?.at).toEqual({ x: 100, y: 300 });
  });

  it('gives ground to whichever label is considered first', () => {
    // Fixed order is the guarantee: it is what stops an edit at the end of a machine
    // reshuffling the labels at the start.
    const contested = { x: 100, y: 100 };
    const elsewhere = { x: 100, y: 300 };
    const requests: LabelRequest[] = [
      { key: 'a', text: 'a', candidates: [contested, elsewhere] },
      { key: 'b', text: 'b', candidates: [contested, elsewhere] },
    ];

    const forward = placeLabels(requests, []);
    const backward = placeLabels([...requests].reverse(), []);

    expect(forward[0]?.at).toEqual(contested);
    expect(backward[0]?.key).toBe('b');
    expect(backward[0]?.at).toEqual(contested);
  });

  it('is stable when a label is appended', () => {
    // The property greedy placement buys, stated directly: earlier labels must not move
    // because a later one arrived.
    const requests: LabelRequest[] = [
      { key: 'a', text: 'a', candidates: [{ x: 0, y: 0 }] },
      { key: 'b', text: 'b', candidates: [{ x: 200, y: 0 }] },
    ];

    const before = placeLabels(requests, []);
    const after = placeLabels([...requests, fixed('c', 'c', { x: 0, y: 0 })], []);

    expect(after.slice(0, 2)).toEqual(before);
  });

  it('never drops a label, however crowded', () => {
    // Rather than hide a label it cannot place, the pass keeps it and flags the collision.
    // A diagram missing a transition symbol is wrong; a cramped one is only ugly.
    const crowded = { x: 100, y: 100 };
    const placed = placeLabels(
      [fixed('a', 'a', crowded), fixed('b', 'b', crowded), fixed('c', 'c', crowded)],
      [stateRect(crowded)],
    );

    expect(placed).toHaveLength(3);
    expect(placed.every((label) => label.colliding)).toBe(true);
    expect(placed.map((label) => label.text)).toEqual(['a', 'b', 'c']);
  });

  it('prefers a lesser collision when every candidate collides', () => {
    const state = { x: 100, y: 100 };
    // Dead centre, then grazing the state's edge. Neither is clear; the second is better.
    const grazing = { x: 100, y: 100 + GEOM.radius + 4 };
    const [placed] = placeLabels(
      [{ key: 'e', text: 'aaaaaa', candidates: [state, grazing] }],
      [stateRect(state)],
    );

    expect(placed?.at).toEqual(grazing);
    expect(placed?.colliding).toBe(true);
  });

  it('weighs a state collision above a label collision', () => {
    // Overlapping another label costs legibility. Overlapping a state costs legibility and
    // obscures the state's name, so given the choice the label yields to the state.
    const state = { x: 100, y: 100 };
    const onState = { x: 100, y: 100 };
    const onLabel = { x: 400, y: 400 };

    const placed = placeLabels(
      [
        fixed('sitting', 'x', onLabel),
        { key: 'choosing', text: 'x', candidates: [onState, onLabel] },
      ],
      [stateRect(state)],
    );

    expect(placed[1]?.at).toEqual(onLabel);
  });

  it('survives a request with no candidates at all', () => {
    const [placed] = placeLabels([{ key: 'e', text: 'a', candidates: [] }], []);
    expect(placed?.at).toEqual({ x: 0, y: 0 });
  });
});
