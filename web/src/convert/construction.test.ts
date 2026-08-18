import { describe, expect, it } from 'vitest';

import { cellKey, construction, filledCells } from '@/convert/construction';
import type { Automaton, Frame, State, Step } from '@/model/automaton';

function state(id: number, label: string): State {
  return { id, label, accepting: false, position: null, origin: null };
}

/**
 * A four-state DFA over {a, b}, shaped the way subset construction leaves one: states in
 * discovery order, transitions in the order the rounds emitted them.
 */
const dfa: Automaton = {
  alphabet: ['a', 'b'],
  start: 0,
  states: [state(0, 'A'), state(1, 'B'), state(2, 'C'), state(3, 'D')],
  transitions: [
    { from: 0, to: 1, on: 'a' },
    { from: 0, to: 0, on: 'b' },
    { from: 1, to: 1, on: 'a' },
    { from: 1, to: 2, on: 'b' },
    { from: 2, to: 3, on: 'b' },
  ],
};

function round(frame: Frame, detail = 'round'): Step {
  return { kind: 'subset-round', detail, frame };
}

/** The run that builds `dfa`, framed the way the engine frames it. */
const steps: Step[] = [
  round({ states: 1, transitions: 0, pending: [0], target: 0, fresh: true }, 'start'),
  round({ states: 2, transitions: 1, pending: [1], current: 0, target: 1, fresh: true }),
  round({ states: 2, transitions: 2, pending: [1], current: 0, target: 0, fresh: false }),
  round({ states: 2, transitions: 3, pending: [], current: 1, target: 1, fresh: false }),
  round({ states: 3, transitions: 4, pending: [2], current: 1, target: 2, fresh: true }),
  round({ states: 4, transitions: 5, pending: [3], current: 2, target: 3, fresh: true }),
  // D is expanded and reaches nothing on either symbol — no transition, no new subset. The
  // queue drains here, which is what lets the closing step account for every state as done.
  round({ states: 4, transitions: 5, current: 3 }, 'dead end on a'),
  round({ states: 4, transitions: 5, current: 3 }, 'dead end on b'),
  round({ states: 4, transitions: 5 }, 'done'),
];

describe('construction', () => {
  it('shows everything when the algorithm framed nothing', () => {
    // Thompson's construction is the real case: it glues fragments, so it has no growing
    // prefix to report. A pane for it must show the machine, not an empty box.
    const unframed: Step[] = [{ kind: 'note', detail: 'built a fragment' }];
    const at = construction(dfa, unframed, 0);

    expect(at.framed).toBe(false);
    expect(at.present.size).toBe(4);
    expect(at.edges).toBe(dfa.transitions.length);
  });

  it('reveals states in the order the result lists them', () => {
    expect([...construction(dfa, steps, 0).present]).toEqual([0]);
    expect([...construction(dfa, steps, 1).present]).toEqual([0, 1]);
    expect([...construction(dfa, steps, 5).present]).toEqual([0, 1, 2, 3]);
  });

  it('never lets an edge exist before both its endpoints', () => {
    // The bug this whole module is for. An edge drawn into a state that has not appeared yet
    // renders as an arrow to nowhere, which reads as a routing fault rather than an
    // off-by-one.
    steps.forEach((_, index) => {
      const at = construction(dfa, steps, index);
      for (const edge of dfa.transitions.slice(0, at.edges)) {
        expect(at.present.has(edge.from)).toBe(true);
        expect(at.present.has(edge.to)).toBe(true);
      }
    });
  });

  it('splits every discovered state into done, current, or pending', () => {
    // What task D1 draws. If a state is present but in none of the three columns, the
    // worklist is lying about where the algorithm has got to.
    steps.forEach((_, index) => {
      const at = construction(dfa, steps, index);
      const accounted = new Set([
        ...at.done,
        ...at.pending,
        ...(at.current === undefined ? [] : [at.current]),
      ]);
      expect([...at.present].sort()).toEqual([...accounted].sort());
    });
  });

  it('does not count the state being expanded as already done', () => {
    const at = construction(dfa, steps, 2);
    expect(at.current).toBe(0);
    expect(at.done).toEqual([]);
  });

  it('remembers states expanded in earlier steps', () => {
    const at = construction(dfa, steps, 5);
    expect(at.current).toBe(2);
    expect(at.done).toEqual([0, 1]);
  });

  it('passes on where the step arrived and whether that was new', () => {
    expect(construction(dfa, steps, 1)).toMatchObject({ arrived: 1, fresh: true });
    expect(construction(dfa, steps, 2)).toMatchObject({ arrived: 0, fresh: false });
    expect(construction(dfa, steps, 8).arrived).toBeUndefined();
  });

  it('clamps past the end of the trace by showing the whole machine', () => {
    // Reached by a stale URL fragment pointing at a step the expression no longer has.
    const at = construction(dfa, steps, 99);
    expect(at.present.size).toBe(4);
    expect(at.framed).toBe(false);
  });
});

describe('filledCells', () => {
  it('fills a cell only once its transition has been emitted', () => {
    expect(filledCells(dfa, construction(dfa, steps, 0))).toEqual(new Set());

    expect(filledCells(dfa, construction(dfa, steps, 1))).toEqual(new Set([cellKey(0, 'a')]));

    expect(filledCells(dfa, construction(dfa, steps, 2))).toEqual(
      new Set([cellKey(0, 'a'), cellKey(0, 'b')]),
    );
  });

  it('fills every cell the finished machine has', () => {
    const at = construction(dfa, steps, steps.length - 1);
    expect(filledCells(dfa, at).size).toBe(dfa.transitions.length);
  });

  it('ignores an ε-transition, which a DFA under construction never has', () => {
    const withEpsilon: Automaton = {
      ...dfa,
      transitions: [{ from: 0, to: 1, on: null }],
    };
    const at = construction(withEpsilon, [], 0);
    expect(filledCells(withEpsilon, at)).toEqual(new Set());
  });
});
