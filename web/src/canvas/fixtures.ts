/**
 * Automata chosen to break the renderer.
 *
 * Not examples — *specimens*. Each one isolates a way a machine can be laid out that makes
 * naive drawing produce something wrong or unreadable, and together they are the input to the
 * visual regression snapshots in `fixtures.test.tsx`.
 *
 * The reason this file exists is written down in docs/notes/edge-routing.md: every routing bug
 * found so far was found by *looking at output*, not by reading code. An edge passing through
 * a state and an edge passing beside it differ by a few numbers in a path string, and no
 * amount of reading catches that. Rendering all twelve on every run makes the looking
 * automatic, and makes a change that improves one case while quietly ruining another
 * impossible to miss.
 *
 * Every fixture carries a `why`. A fixture whose purpose is not written down gets deleted by
 * someone six months from now who cannot tell it from the one above it.
 */

import { GEOM, type Layout, type Point } from '@/canvas/geometry';
import type { Automaton, StateId } from '@/model/automaton';

/** One pathological case, with the reason it is here. */
export interface Fixture {
  /** Also the snapshot filename, so it must stay filename-safe and stable. */
  name: string;
  /** What breaks if the renderer gets this wrong. */
  why: string;
  automaton: Automaton;
  layout: Layout;
}

/** Shorthand: `0 -a-> 1`. `undefined` means an ε-transition. */
function on(from: StateId, to: StateId, symbol?: string) {
  return { from, to, on: symbol };
}

/** Build a machine from a count of states, marking the last accepting by default. */
function machine(
  count: number,
  transitions: { from: StateId; to: StateId; on?: string }[],
  options: { alphabet?: string[]; accepting?: StateId[]; start?: StateId } = {},
): Automaton {
  const accepting = new Set(options.accepting ?? [count - 1]);
  return {
    alphabet: options.alphabet ?? ['a', 'b'],
    start: options.start ?? 0,
    states: Array.from({ length: count }, (_, id) => ({
      id,
      label: `q${id}`,
      ...(accepting.has(id) ? { accepting: true } : {}),
    })),
    transitions,
  };
}

/** States evenly spaced left to right. */
function row(
  count: number,
  gap: number = GEOM.nodeDistance,
  at: Point = { x: 100, y: 140 },
): Layout {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [i, { x: at.x + i * gap, y: at.y }]),
  );
}

/** States evenly spaced top to bottom. */
function column(
  count: number,
  gap: number = GEOM.nodeDistance,
  at: Point = { x: 140, y: 90 },
): Layout {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => [i, { x: at.x, y: at.y + i * gap }]),
  );
}

/** `count` states evenly around a circle, starting due east. */
function ring(count: number, radius: number, centre: Point, from = 0): Layout {
  return Object.fromEntries(
    Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return [
        from + i,
        { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius },
      ];
    }),
  );
}

export const FIXTURES: readonly Fixture[] = [
  {
    name: '01-row',
    why: 'The baseline. Three states, straight edges, nothing clever. If this snapshot moves, something fundamental changed and every other diff is noise.',
    automaton: machine(3, [on(0, 1, 'a'), on(1, 2, 'b')]),
    layout: row(3),
  },
  {
    name: '02-bidirectional-pair',
    why: 'Transitions both ways between two states. Drawn naively this is one line with two arrowheads, which says something the machine does not: that both symbols go both ways.',
    automaton: machine(2, [on(0, 1, 'a'), on(1, 0, 'b')]),
    layout: row(2, 200),
  },
  {
    name: '03-bidirectional-chain',
    why: 'Every adjacent pair in a row goes both ways. Ten curves and ten labels contending inside one narrow band — the case where each pair is individually fine and the diagram is still unreadable.',
    automaton: machine(
      5,
      [0, 1, 2, 3].flatMap((i) => [on(i, i + 1, 'a'), on(i + 1, i, 'b')]),
    ),
    layout: row(5),
  },
  {
    name: '04-skip-edge',
    why: 'q2 back to q0 with q1 sitting between them. Drawn straight it runs over q1 and reads as a double arrow between q0 and q1 — a wrong diagram, not merely an ugly one. This is the bug that produced GEOM.bendClearance.',
    automaton: machine(3, [on(0, 1, 'a'), on(1, 2, 'a'), on(2, 0, 'b')]),
    layout: row(3),
  },
  {
    name: '05-skip-both-ways',
    why: 'Both routing rules firing on one pair of states: q0 and q2 go both ways *and* q1 is in between. The two rules disagree about how far to bend, and whichever wins must still clear q1.',
    automaton: machine(3, [on(0, 2, 'a'), on(2, 0, 'b'), on(0, 1, 'b'), on(1, 2, 'a')]),
    layout: row(3),
  },
  {
    name: '06-loops-all-round',
    why: 'Four states packed close, each with a self-loop. No two can use the same side without colliding, so this exercises the whole preference order rather than just its first entry.',
    automaton: machine(
      4,
      [0, 1, 2, 3]
        .map((i) => on(i, i, 'a'))
        .concat([on(0, 1, 'b'), on(1, 2, 'b'), on(2, 3, 'b')]),
      { accepting: [3] },
    ),
    layout: ring(4, 72, { x: 200, y: 180 }),
  },
  {
    name: '07-loop-boxed-in',
    why: 'A state with a self-loop and a neighbour on all four sides. Every direction is blocked, so this pins down the fallback — a crowded loop is worse than one overlapping something, and an invisible loop is worse than both.',
    automaton: machine(
      5,
      [on(0, 0, 'a'), on(1, 0, 'b'), on(2, 0, 'b'), on(3, 0, 'b'), on(4, 0, 'b')],
      {
        accepting: [0],
        start: 1,
      },
    ),
    layout: { 0: { x: 220, y: 180 }, ...ring(4, 76, { x: 220, y: 180 }, 1) },
  },
  {
    name: '08-wide-label',
    why: 'One edge carrying eight symbols, so its label is wider than the gap between the states it joins. Tests that placement moves a label that cannot fit rather than letting it run under both states.',
    automaton: machine(
      3,
      [
        on(0, 1, 'a'),
        on(1, 2, 'a'),
        // Grouped into a single edge labelled "a, b, c, d, e, f, g, h" — which must also
        // clear q1, so the widest label in the set sits on the most constrained edge.
        ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((symbol) => on(0, 2, symbol)),
      ],
      { alphabet: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] },
    ),
    layout: row(3, 96),
  },
  {
    name: '09-overlapping-states',
    why: 'Two states closer together than their own diameter. Degenerate, and reachable in one drag, so it must degrade rather than produce NaN in a path.',
    automaton: machine(3, [on(0, 1, 'a'), on(1, 2, 'b'), on(2, 1, 'a')]),
    layout: { 0: { x: 100, y: 150 }, 1: { x: 240, y: 150 }, 2: { x: 258, y: 162 } },
  },
  {
    name: '10-column',
    why: 'States stacked vertically. Every normal points horizontally instead of vertically, which is the orientation the left-to-right assumptions in routing are least tested against.',
    automaton: machine(4, [on(0, 1, 'a'), on(1, 2, 'b'), on(2, 3, 'a'), on(3, 0, 'b')]),
    layout: column(4),
  },
  {
    name: '11-hub',
    why: 'One state joined to six around it, out and back. Edges leave at every angle and all twelve labels crowd the same annulus, so a placement rule that only works horizontally fails visibly here.',
    automaton: machine(
      7,
      [1, 2, 3, 4, 5, 6].flatMap((i) => [on(0, i, 'a'), on(i, 0, 'b')]),
      { accepting: [4] },
    ),
    layout: { 0: { x: 230, y: 200 }, ...ring(6, 130, { x: 230, y: 200 }, 1) },
  },
  {
    name: '12-epsilon-nfa',
    why: 'The shape Thompson construction actually emits: ε-transitions, chains of degree-two states, and a label that is a single narrow glyph. What the app renders most often once conversions are wired up.',
    automaton: machine(
      6,
      [on(0, 1), on(1, 2, 'a'), on(2, 5), on(0, 3), on(3, 4, 'b'), on(4, 5), on(5, 0)],
      { accepting: [5] },
    ),
    layout: {
      0: { x: 90, y: 180 },
      1: { x: 200, y: 120 },
      2: { x: 310, y: 120 },
      3: { x: 200, y: 250 },
      4: { x: 310, y: 250 },
      5: { x: 420, y: 180 },
    },
  },
];
