import { describe, expect, it } from 'vitest';

import { GEOM, type Layout } from '@/canvas/geometry';
import {
  DRAG_THRESHOLD,
  isDragging,
  marqueeRect,
  pointerCancel,
  pointerDown,
  pointerMove,
  pointerUp,
  type Interaction,
  type Intent,
  type Scene,
} from '@/canvas/interaction';
import { snapPoint } from '@/canvas/viewport';

const layout: Layout = {
  0: { x: 96, y: 96 },
  1: { x: 240, y: 96 },
  2: { x: 96, y: 240 },
};

function scene(selection: number[] = []): Scene {
  return { ids: [0, 1, 2], layout, selection, snap: snapPoint };
}

/** The selection an intent list asks for, if any. */
function selected(intents: Intent[]): number[] | undefined {
  const intent = intents.find((i) => i.kind === 'select');
  return intent?.kind === 'select' ? intent.ids : undefined;
}

/** The moves an intent list asks for. */
function moves(intents: Intent[]) {
  const intent = intents.find((i) => i.kind === 'move');
  return intent?.kind === 'move' ? intent.moves : [];
}

/** Press, then drag to a point, in one call. */
function drag(from: { x: number; y: number }, to: { x: number; y: number }, s: Scene) {
  const down = pointerDown(from, false, s);
  return pointerMove(down.next, to, s);
}

describe('pressing a state', () => {
  it('selects an unselected state immediately, not on release', () => {
    // A selection that waits for mouseup makes dragging feel unresponsive: the highlight
    // arrives after the state has already moved.
    const { next, intents } = pointerDown({ x: 96, y: 96 }, false, scene());

    expect(next.kind).toBe('pressing');
    expect(selected(intents)).toEqual([0]);
  });

  it('leaves a group alone while the press might become a group drag', () => {
    // Collapsing the selection here would make dragging a multi-selection impossible.
    const { intents } = pointerDown({ x: 96, y: 96 }, false, scene([0, 1]));
    expect(selected(intents)).toBeUndefined();
  });

  it('toggles on an additive press', () => {
    expect(selected(pointerDown({ x: 96, y: 96 }, true, scene([0, 1])).intents)).toEqual([1]);
  });

  it('notices a press on the rim, where a drag will draw an edge', () => {
    const onRim = { x: 96 + GEOM.radius - 2, y: 96 };
    const { next } = pointerDown(onRim, false, scene());
    expect(next.kind === 'pressing' && next.rim).toBe(true);
  });

  it('does not treat a press at the centre as a rim press', () => {
    const { next } = pointerDown({ x: 96, y: 96 }, false, scene());
    expect(next.kind === 'pressing' && next.rim).toBe(false);
  });
});

describe('the drag threshold', () => {
  it('does not move anything before the threshold', () => {
    // Otherwise clicking a state costs an undo press to reverse a move nobody made.
    const down = pointerDown({ x: 96, y: 96 }, false, scene());
    const { next, intents } = pointerMove(down.next, { x: 97, y: 96 }, scene([0]));

    expect(next.kind).toBe('pressing');
    expect(intents).toHaveLength(0);
  });

  it('becomes a drag once past it', () => {
    const down = pointerDown({ x: 96, y: 96 }, false, scene());
    const { next } = pointerMove(down.next, { x: 96 + DRAG_THRESHOLD + 1, y: 96 }, scene([0]));

    expect(next.kind).toBe('dragging');
  });

  it('honours a threshold scaled for the zoom', () => {
    // The caller divides by the zoom, so a drag takes the same physical movement at any
    // zoom. At 4x the diagram-space threshold is a quarter of the screen-space one.
    const down = pointerDown({ x: 96, y: 96 }, false, scene());
    const nudge = { x: 97, y: 96 };

    expect(pointerMove(down.next, nudge, scene([0]), 0.75).next.kind).toBe('dragging');
    expect(pointerMove(down.next, nudge, scene([0]), 3).next.kind).toBe('pressing');
  });
});

describe('dragging states', () => {
  it('moves the state under the pointer', () => {
    const { intents } = drag({ x: 96, y: 96 }, { x: 160, y: 96 }, scene([0]));
    expect(moves(intents)).toEqual([{ id: 0, to: { x: 160, y: 96 } }]);
  });

  it('moves the whole selection when one of its members is dragged', () => {
    const { intents } = drag({ x: 96, y: 96 }, { x: 160, y: 96 }, scene([0, 1]));
    expect(moves(intents).map((m) => m.id)).toEqual([0, 1]);
  });

  it('drags only the pressed state when it was not part of the selection', () => {
    // `pointerDown` replaced the selection, so the old one must not come along.
    const before = scene([1, 2]);
    const down = pointerDown({ x: 96, y: 96 }, false, before);
    const { intents } = pointerMove(down.next, { x: 160, y: 96 }, scene([0]));

    expect(moves(intents).map((m) => m.id)).toEqual([0]);
  });

  it('computes every frame from the origin, not from the frame before', () => {
    // Incremental frames let rounding accumulate over a long drag until states sit a few
    // pixels from where the pointer says they are.
    const s = scene([0]);
    const down = pointerDown({ x: 96, y: 96 }, false, s);
    let state = pointerMove(down.next, { x: 100, y: 96 }, s).next;

    for (const x of [120, 140, 160, 200]) state = pointerMove(state, { x, y: 96 }, s).next;
    const final = pointerMove(state, { x: 200, y: 96 }, s);

    expect(moves(final.intents)).toEqual([{ id: 0, to: { x: 200, y: 96 } }]);
  });

  it('keeps a dragged group rigid', () => {
    const { intents } = drag({ x: 96, y: 96 }, { x: 163, y: 99 }, scene([0, 1]));
    const [first, second] = moves(intents);

    expect(second!.to.x - first!.to.x).toBe(144);
    expect(second!.to.y - first!.to.y).toBe(0);
  });
});

describe('drawing a transition', () => {
  const rim = { x: 96 + GEOM.radius - 2, y: 96 };

  it('starts from the rim rather than moving the state', () => {
    const { next } = drag(rim, { x: 180, y: 96 }, scene([0]));
    expect(next.kind).toBe('connecting');
  });

  it('follows the pointer and reports what it is over', () => {
    const { next } = drag(rim, { x: 240, y: 96 }, scene([0]));
    expect(next.kind === 'connecting' && next.over).toBe(1);
  });

  it('reports nothing over empty canvas', () => {
    const { next } = drag(rim, { x: 600, y: 600 }, scene([0]));
    expect(next.kind === 'connecting' && next.over).toBeUndefined();
  });

  it('connects on release over a state', () => {
    const { next } = drag(rim, { x: 240, y: 96 }, scene([0]));
    const { intents } = pointerUp(next, scene([0]));

    expect(intents).toEqual([{ kind: 'connect', from: 0, to: 1 }]);
  });

  it('allows a self-loop by dropping back on the source', () => {
    // Dragging out and back is the natural way to ask for a self-loop, and rejecting it
    // would mean the only way to make one is a menu.
    const { next } = drag(rim, { x: 96, y: 96 }, scene([0]));
    expect(pointerUp(next, scene([0])).intents).toEqual([{ kind: 'connect', from: 0, to: 0 }]);
  });

  it('cancels when dropped on empty canvas', () => {
    // Creating a state here would make a slipped drag add something to hunt down and delete.
    const { next } = drag(rim, { x: 600, y: 600 }, scene([0]));
    expect(pointerUp(next, scene([0])).intents).toEqual([]);
  });
});

describe('marquee', () => {
  it('starts on empty canvas', () => {
    expect(pointerDown({ x: 600, y: 600 }, false, scene()).next.kind).toBe('marquee');
  });

  it('selects what the box covers as it is dragged', () => {
    const down = pointerDown({ x: 60, y: 60 }, false, scene());
    const { intents } = pointerMove(down.next, { x: 300, y: 130 }, scene());

    expect(selected(intents)).toEqual([0, 1]);
  });

  it('releases a state the box sweeps back off', () => {
    const down = pointerDown({ x: 60, y: 60 }, false, scene());
    const wide = pointerMove(down.next, { x: 300, y: 130 }, scene());
    const narrow = pointerMove(wide.next, { x: 130, y: 130 }, scene());

    expect(selected(narrow.intents)).toEqual([0]);
  });

  it('adds to the previous selection when additive', () => {
    const down = pointerDown({ x: 60, y: 200 }, true, scene([1]));
    const { intents } = pointerMove(down.next, { x: 130, y: 300 }, scene([1]));

    expect(selected(intents)).toEqual([1, 2]);
  });

  it('normalises its rectangle however it was dragged', () => {
    const down = pointerDown({ x: 300, y: 300 }, false, scene());
    const up = pointerMove(down.next, { x: 100, y: 100 }, scene());

    expect(marqueeRect(up.next)).toEqual({ x: 100, y: 100, width: 200, height: 200 });
  });

  it('clears the selection when it turns out to be a click', () => {
    const down = pointerDown({ x: 600, y: 600 }, false, scene([0, 1]));
    expect(selected(pointerUp(down.next, scene([0, 1])).intents)).toEqual([]);
  });

  it('does not clear on an additive click, which was aimed at nothing in particular', () => {
    const down = pointerDown({ x: 600, y: 600 }, true, scene([0, 1]));
    expect(pointerUp(down.next, scene([0, 1])).intents).toEqual([]);
  });
});

describe('releasing a press that never moved', () => {
  it('collapses a group to the state that was clicked', () => {
    // The decision deferred at pointerDown, now that no drag followed.
    const down = pointerDown({ x: 96, y: 96 }, false, scene([0, 1]));
    expect(selected(pointerUp(down.next, scene([0, 1])).intents)).toEqual([0]);
  });

  it('leaves a single selection alone', () => {
    const down = pointerDown({ x: 96, y: 96 }, false, scene([0]));
    expect(pointerUp(down.next, scene([0])).intents).toEqual([]);
  });

  it('leaves an additive click alone, since it already toggled on the way down', () => {
    const down = pointerDown({ x: 96, y: 96 }, true, scene([0, 1]));
    expect(pointerUp(down.next, scene([1])).intents).toEqual([]);
  });
});

describe('finishing', () => {
  it('returns to idle from every state', () => {
    const states: Interaction[] = [
      { kind: 'idle' },
      { kind: 'pressing', on: 0, at: { x: 0, y: 0 }, additive: false, rim: false },
      { kind: 'dragging', ids: [0], anchor: 0, from: { x: 0, y: 0 }, origin: layout },
      {
        kind: 'marquee',
        from: { x: 0, y: 0 },
        to: { x: 9, y: 9 },
        before: [],
        additive: false,
      },
      { kind: 'connecting', from: 0, to: { x: 0, y: 0 } },
    ];

    for (const state of states) expect(pointerUp(state, scene()).next.kind).toBe('idle');
  });

  it('cancels to idle, emitting nothing', () => {
    // A cancelled gesture is not a completed one: a system gesture stealing the pointer
    // mid-connect must not create the transition.
    expect(pointerCancel()).toEqual({ next: { kind: 'idle' }, intents: [] });
  });

  it('knows which states are a drag in progress', () => {
    expect(isDragging({ kind: 'idle' })).toBe(false);
    expect(isDragging({ kind: 'connecting', from: 0, to: { x: 0, y: 0 } })).toBe(true);
  });
});
