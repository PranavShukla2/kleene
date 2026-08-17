import { describe, expect, it } from 'vitest';

import { GEOM, type Layout } from '@/canvas/geometry';
import {
  dragged,
  onRim,
  rectBetween,
  selectionAfterClick,
  selectionAfterMarquee,
  stateAt,
  statesInRect,
} from '@/canvas/selection';
import { snapPoint } from '@/canvas/viewport';

const ids = [0, 1, 2];
const layout: Layout = {
  0: { x: 100, y: 100 },
  1: { x: 200, y: 100 },
  2: { x: 300, y: 200 },
};

describe('rectBetween', () => {
  it('normalises a rectangle dragged up and to the left', () => {
    // Every downstream test would otherwise need to cope with negative extents.
    expect(rectBetween({ x: 100, y: 100 }, { x: 40, y: 20 })).toEqual({
      x: 40,
      y: 20,
      width: 60,
      height: 80,
    });
  });

  it('gives the same rectangle whichever corner came first', () => {
    const a = { x: 10, y: 90 };
    const b = { x: 70, y: 20 };
    expect(rectBetween(a, b)).toEqual(rectBetween(b, a));
  });

  it('is degenerate, not negative, for a click that never moved', () => {
    expect(rectBetween({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({
      x: 5,
      y: 5,
      width: 0,
      height: 0,
    });
  });
});

describe('stateAt', () => {
  it('finds a state under its centre', () => {
    expect(stateAt({ x: 100, y: 100 }, ids, layout)).toBe(0);
  });

  it('finds a state anywhere inside its circle', () => {
    expect(stateAt({ x: 100 + GEOM.radius - 1, y: 100 }, ids, layout)).toBe(0);
  });

  it('misses just outside the rim', () => {
    expect(stateAt({ x: 100 + GEOM.radius + 1, y: 100 }, ids, layout)).toBeUndefined();
  });

  it('returns nothing on empty canvas', () => {
    expect(stateAt({ x: 700, y: 700 }, ids, layout)).toBeUndefined();
  });

  it('picks the state drawn on top when two overlap', () => {
    // States are drawn in array order, so the last one is topmost and must win the hit.
    // Picking the first would make the state you can see unclickable.
    const stacked: Layout = { 0: { x: 100, y: 100 }, 1: { x: 105, y: 100 } };
    expect(stateAt({ x: 102, y: 100 }, [0, 1], stacked)).toBe(1);
  });

  it('ignores ids that have no position', () => {
    expect(stateAt({ x: 100, y: 100 }, [9], layout)).toBeUndefined();
  });
});

describe('onRim', () => {
  const at = { x: 0, y: 0 };

  it('is true in the band just inside the edge', () => {
    expect(onRim({ x: GEOM.radius - 2, y: 0 }, at)).toBe(true);
  });

  it('is false at the centre, where a drag should move the state', () => {
    expect(onRim(at, at)).toBe(false);
  });

  it('is false outside the circle', () => {
    // The band sits inside the shape on purpose: a target hanging outside would swallow
    // drags aimed at the empty canvas beside it.
    expect(onRim({ x: GEOM.radius + 2, y: 0 }, at)).toBe(false);
  });
});

describe('statesInRect', () => {
  it('covers states whose centres are inside', () => {
    expect(statesInRect({ x: 50, y: 50, width: 200, height: 100 }, ids, layout)).toEqual([
      0, 1,
    ]);
  });

  it('covers a state the box only touches', () => {
    // Touching counts. Requiring containment makes people miss states they visibly dragged
    // over, with nothing on screen to explain the omission.
    const grazing = { x: 100 - GEOM.radius + 2, y: 40, width: 5, height: 200 };
    expect(statesInRect(grazing, ids, layout)).toEqual([0]);
  });

  it('covers nothing when the box is clear of every state', () => {
    expect(statesInRect({ x: 400, y: 400, width: 50, height: 50 }, ids, layout)).toEqual([]);
  });

  it('returns ids in document order, not in the order the box reached them', () => {
    // Stable order keeps the properties panel from reordering as a marquee is dragged.
    expect(statesInRect({ x: 0, y: 0, width: 500, height: 500 }, ids, layout)).toEqual([
      0, 1, 2,
    ]);
  });
});

describe('selectionAfterClick', () => {
  it('replaces the selection on a plain click', () => {
    expect(selectionAfterClick([0, 1], 2, false)).toEqual([2]);
  });

  it('keeps a group when clicking a state already in it', () => {
    // So click-and-drag on one member moves the group rather than collapsing it to one.
    expect(selectionAfterClick([0, 1], 1, false)).toEqual([0, 1]);
  });

  it('adds on an additive click', () => {
    expect(selectionAfterClick([0], 1, true)).toEqual([0, 1]);
  });

  it('removes on an additive click, so a mis-shift-click undoes itself', () => {
    expect(selectionAfterClick([0, 1], 1, true)).toEqual([0]);
  });
});

describe('selectionAfterMarquee', () => {
  it('replaces the selection when not additive', () => {
    expect(selectionAfterMarquee([5], [0, 1], false)).toEqual([0, 1]);
  });

  it('unions with the selection as it was when the drag began', () => {
    expect(selectionAfterMarquee([5], [0, 1], true)).toEqual([5, 0, 1]);
  });

  it('lets go of a state the box sweeps back off', () => {
    // The reason `before` is passed rather than the live selection. Unioning with the live
    // one makes states latch on permanently as the box passes over them, and a marquee has
    // to be as reversible as the drag drawing it.
    const before = [5];
    const swept = selectionAfterMarquee(before, [0, 1], true);
    const sweptBack = selectionAfterMarquee(before, [0], true);

    expect(swept).toContain(1);
    expect(sweptBack).not.toContain(1);
  });

  it('does not duplicate a state that was already selected', () => {
    expect(selectionAfterMarquee([0], [0, 1], true)).toEqual([0, 1]);
  });
});

describe('dragged', () => {
  it('snaps the anchor to the grid rather than snapping the delta', () => {
    // Snapping the delta would preserve whatever off-grid offset a state already had, so
    // "snap to grid" would do nothing for exactly the layouts that need it.
    const offGrid: Layout = { 0: { x: 101, y: 99 } };
    expect(dragged(offGrid, [0], 3, 3, snapPoint)).toEqual([{ id: 0, to: { x: 104, y: 104 } }]);
  });

  it('keeps a dragged group rigid', () => {
    // The bug this guards is subtle and permanent. Snapping each state independently sends
    // two states 100px apart to grid points 96px apart, so the group shears a little on
    // every drag until a layout somebody arranged deliberately has rearranged itself.
    const spaced: Layout = { 0: { x: 100, y: 100 }, 1: { x: 200, y: 100 } };
    const moved = dragged(spaced, [0, 1], 16, 0, snapPoint);

    expect(moved[1]!.to.x - moved[0]!.to.x).toBe(100);
    expect(moved[1]!.to.y - moved[0]!.to.y).toBe(0);
  });

  it('snaps the state the pointer grabbed, not merely the first one', () => {
    // The state under the cursor is the one whose alignment the user can see.
    const spaced: Layout = { 0: { x: 100, y: 100 }, 1: { x: 201, y: 100 } };
    const moved = dragged(spaced, [0, 1], 3, 0, snapPoint, 1);

    expect(moved[1]!.to.x % 8).toBe(0);
  });

  it('falls back to the first selected state when the anchor is not in the selection', () => {
    const spaced: Layout = { 0: { x: 101, y: 100 }, 1: { x: 200, y: 100 } };
    expect(dragged(spaced, [0, 1], 3, 0, snapPoint, 99)[0]!.to.x % 8).toBe(0);
  });

  it('skips ids with no position instead of emitting NaN', () => {
    expect(dragged(layout, [0, 99], 8, 8, snapPoint)).toHaveLength(1);
  });

  it('leaves an on-grid state exactly where it is for a zero delta', () => {
    expect(dragged({ 0: { x: 96, y: 96 } }, [0], 0, 0, snapPoint)).toEqual([
      { id: 0, to: { x: 96, y: 96 } },
    ]);
  });
});
