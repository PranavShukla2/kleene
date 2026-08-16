/**
 * Diagram geometry.
 *
 * Every number here comes from design-system.md §4 rather than from taste. They are
 * collected in one module because the renderer and the TikZ exporter must agree on them —
 * the moment those two drift, what a student arranges on screen stops being what comes out
 * in their assignment.
 */

import type { StateId } from '@/model/automaton';

/** A point in diagram space. */
export interface Point {
  x: number;
  y: number;
}

/** Where each state sits. Layout lives outside the semantic model, never inside it. */
export type Layout = Record<StateId, Point>;

/** Fixed dimensions, all at zoom 1.0. See design-system §4. */
export const GEOM = {
  /** State circle radius. */
  radius: 24,
  /** State outline width. */
  stateStroke: 1.75,
  /**
   * Inset of the accepting double-ring.
   *
   * 4.5, not 4 or 5. At 4 the two rings read as a rendering artifact; at 6 they look
   * unrelated. This is the detail that separates a hand-made diagram from a generated one.
   */
  acceptingInset: 4.5,
  /** Length of the start arrow, entering from the left. */
  startArrow: 22,
  /** Gap between the start arrowhead and the state — never 0; touching looks like a bug. */
  startGap: 2,
  /** Transition line width. */
  edgeStroke: 1.5,
  /** Distance a label sits off its edge, along the normal. */
  labelOffset: 12,
  /** Perpendicular control-point offset for a bidirectional pair. */
  bendOffset: 28,
  /**
   * Control-point offset for an edge routed around an intervening state.
   *
   * A quadratic Bézier only reaches *half* its control offset at the midpoint, so this
   * needs to be more than twice the state radius to clear one: 96 gives 48px of deviation
   * against a 24px radius, leaving 24px of daylight. Using `bendOffset` here would deviate
   * by 14px and pass straight through the state it is meant to avoid.
   */
  bendClearance: 96,
  /** How close an edge may pass to an unrelated state before it must route around it. */
  clearance: 10,
  /** Radius of a self-loop circle. */
  loopRadius: 16,
  /** Visible dot grid pitch. */
  grid: 24,
  /** Default distance between states — maps to TikZ `node distance=2.4cm`. */
  nodeDistance: 96,
} as const;

/** Vector from `a` to `b`, with its length. */
function delta(a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { dx, dy, len };
}

/**
 * Move a point from a state's centre out to its rim, in the direction of `toward`.
 *
 * Edges are drawn between rims, not centres, so an arrowhead lands on the circle's edge
 * rather than being swallowed by it.
 */
export function pointOnRim(centre: Point, toward: Point, inset = 0): Point {
  const { dx, dy, len } = delta(centre, toward);
  const r = GEOM.radius + inset;
  return { x: centre.x + (dx / len) * r, y: centre.y + (dy / len) * r };
}

/** A straight edge between two states, clipped to both rims. */
export function straightEdge(from: Point, to: Point) {
  const start = pointOnRim(from, to);
  const end = pointOnRim(to, from);
  return { path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, label: labelFor(start, end) };
}

/**
 * A curved edge, for when the reverse edge also exists.
 *
 * Two states with transitions both ways must not be drawn as one line with two arrowheads,
 * and must not be drawn as two overlapping lines. Symmetric opposing curves are the fix.
 *
 * **Both directions pass the same `side`.** The curve bends along the normal to `from → to`,
 * and that vector already reverses when the endpoints swap, so the two halves of a pair
 * separate on their own. Passing +1 and -1 to "make them opposite" cancels that flip out and
 * puts both curves on the same side — which is the overlap this function exists to avoid.
 * `side` is for deliberately flipping a curve, not for distinguishing the pair.
 */
export function curvedEdge(
  from: Point,
  to: Point,
  side: 1 | -1 = 1,
  offset: number = GEOM.bendOffset,
) {
  const { dx, dy, len } = delta(from, to);
  // Unit normal to the line joining the two centres.
  const nx = (-dy / len) * offset * side;
  const ny = (dx / len) * offset * side;
  const control = { x: (from.x + to.x) / 2 + nx, y: (from.y + to.y) / 2 + ny };

  const start = pointOnRim(from, control);
  const end = pointOnRim(to, control);

  return {
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    // The label follows the curve's actual midpoint, which is the quadratic evaluated at
    // t = 0.5 — not the midpoint of the chord, which would sit off the line.
    label: {
      x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x,
      y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y,
    },
  };
}

/**
 * The four directions a self-loop can sit in.
 *
 * Exactly the set TikZ's automata library can name — `loop above`, `loop below`, `loop left`,
 * `loop right`. Rule 0 of docs/notes/edge-routing.md: the router may only produce shapes the
 * exporter can express, so screen and assignment cannot drift.
 */
export type LoopDirection = 'above' | 'right' | 'below' | 'left';

/**
 * Preference order for placing a self-loop.
 *
 * `above` first because automata lay out left-to-right, making the vertical axis the emptier
 * one, and because it is what almost every textbook draws. `left` last because it collides
 * with the start arrow on the start state.
 */
export const LOOP_ORDER: readonly LoopDirection[] = ['above', 'right', 'below', 'left'];

/** How far from a loop's anchor another feature must be for that direction to count as free. */
const LOOP_CLEARANCE = 40;

/** Where a loop in a given direction sits, relative to the state's centre. */
function loopAnchor(at: Point, direction: LoopDirection): Point {
  const reach = GEOM.radius + GEOM.loopRadius;
  switch (direction) {
    case 'above':
      return { x: at.x, y: at.y - reach };
    case 'below':
      return { x: at.x, y: at.y + reach };
    case 'left':
      return { x: at.x - reach, y: at.y };
    case 'right':
      return { x: at.x + reach, y: at.y };
  }
}

/**
 * Choose which side of a state its self-loop should sit on.
 *
 * Takes the first direction in {@link LOOP_ORDER} whose anchor is clear of every other state
 * and of every point an incident edge passes through. Falls back to `above` when a state is
 * hemmed in on all four sides — a crowded loop is worse than one overlapping something, but
 * an invisible loop is worse than both.
 *
 * `neighbours` are the other states' centres; `incident` are points along edges touching this
 * state, which the caller samples. Passing empty arrays gives `above`, which is what a
 * renderer with no layout knowledge should produce.
 */
export function chooseLoopDirection(
  at: Point,
  neighbours: readonly Point[],
  incident: readonly Point[] = [],
): LoopDirection {
  const obstacles = [...neighbours, ...incident];

  for (const direction of LOOP_ORDER) {
    const anchor = loopAnchor(at, direction);
    const blocked = obstacles.some(
      (o) => Math.hypot(o.x - anchor.x, o.y - anchor.y) < LOOP_CLEARANCE,
    );
    if (!blocked) return direction;
  }

  return 'above';
}

/**
 * A self-loop on one side of a state.
 *
 * Drawn as a single arc leaving and re-entering the rim. The `1 1` flags make it the major
 * arc, which is what gives a loop its recognisable circular shape rather than a shallow bump.
 */
export function selfLoop(at: Point, direction: LoopDirection = 'above'): SelfLoop {
  const r = GEOM.loopRadius;
  const spread = r * 0.7;
  // 2px clear of the rim: an arc touching the circle reads as a rendering artifact.
  const gap = GEOM.radius + 2;
  const labelReach = GEOM.radius + r * 1.9;

  // `sweep` flips per direction so every loop bulges away from the state rather than into it.
  const [start, end, sweep, label]: [Point, Point, 0 | 1, Point] = (() => {
    switch (direction) {
      case 'above':
        return [
          { x: at.x - spread, y: at.y - gap },
          { x: at.x + spread, y: at.y - gap },
          1,
          { x: at.x, y: at.y - labelReach },
        ];
      case 'below':
        return [
          { x: at.x + spread, y: at.y + gap },
          { x: at.x - spread, y: at.y + gap },
          1,
          { x: at.x, y: at.y + labelReach },
        ];
      case 'left':
        return [
          { x: at.x - gap, y: at.y + spread },
          { x: at.x - gap, y: at.y - spread },
          1,
          { x: at.x - labelReach, y: at.y },
        ];
      case 'right':
        return [
          { x: at.x + gap, y: at.y - spread },
          { x: at.x + gap, y: at.y + spread },
          1,
          { x: at.x + labelReach, y: at.y },
        ];
    }
  })();

  return {
    path: `M ${start.x} ${start.y} A ${r} ${r} 0 1 ${sweep} ${end.x} ${end.y}`,
    label,
    direction,
  };
}

/** A rendered self-loop, with the direction it was placed in. */
export interface SelfLoop {
  path: string;
  label: Point;
  direction: LoopDirection;
}

/** Where a label goes for a straight segment: off the midpoint, along the normal. */
function labelFor(start: Point, end: Point): Point {
  const { dx, dy, len } = delta(start, end);
  return {
    x: (start.x + end.x) / 2 + (-dy / len) * GEOM.labelOffset,
    y: (start.y + end.y) / 2 + (dx / len) * GEOM.labelOffset,
  };
}

/**
 * Group transitions into one drawn edge per ordered state pair.
 *
 * Three transitions from q0 to q1 on `a`, `b` and `c` are one edge labelled "a, b, c" — never
 * three overlapping lines. Symbols are sorted so the label is stable between renders rather
 * than depending on transition insertion order.
 */
export function groupEdges(
  transitions: readonly { from: StateId; to: StateId; on?: string }[],
): { from: StateId; to: StateId; symbols: string[] }[] {
  const groups = new Map<string, { from: StateId; to: StateId; symbols: string[] }>();

  for (const t of transitions) {
    const key = `${t.from}->${t.to}`;
    let group = groups.get(key);
    if (!group) {
      group = { from: t.from, to: t.to, symbols: [] };
      groups.set(key, group);
    }
    group.symbols.push(t.on ?? 'ε');
  }

  for (const group of groups.values()) group.symbols.sort();
  return [...groups.values()];
}

/** Perpendicular distance from `p` to the segment `a`–`b`. */
function distanceToSegment(p: Point, a: Point, b: Point): number {
  const { dx, dy, len } = delta(a, b);
  // Projection of ap onto ab, clamped to the segment so endpoints are handled.
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len)));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Whether a straight edge would pass through, or too near, an unrelated state.
 *
 * This is the fourth of the four routing cases that make generated automaton diagrams look
 * broken, and the least obvious: a straight `q2 → q0` in a left-to-right row runs directly
 * over `q1`, and the result reads as a double-headed arrow between `q0` and `q1` rather than
 * as the edge it is. It is a wrong diagram, not merely an ugly one.
 */
export function isObstructed(from: Point, to: Point, others: readonly Point[]): boolean {
  return others.some((o) => distanceToSegment(o, from, to) < GEOM.radius + GEOM.clearance);
}

/**
 * Which way an obstructed edge should bow: downward, away from self-loops.
 *
 * Self-loops sit above their state (Phase 0 places every loop there, and `above` stays first
 * in Phase 2's preference order), so an edge routed over the top of a state tends to collide
 * with one. Routing underneath keeps the two apart without needing to know which states
 * actually have loops.
 */
export function bendSideBelow(from: Point, to: Point): 1 | -1 {
  return to.x >= from.x ? 1 : -1;
}

/** Whether the reverse edge also exists, meaning both must curve apart. */
export function hasReverse(
  edges: readonly { from: StateId; to: StateId }[],
  from: StateId,
  to: StateId,
): boolean {
  return from !== to && edges.some((e) => e.from === to && e.to === from);
}

/** A tidy left-to-right layout, used until elkjs arrives in Phase 2. */
export function rowLayout(ids: readonly StateId[], origin: Point = { x: 90, y: 130 }): Layout {
  const layout: Layout = {};
  ids.forEach((id, i) => {
    layout[id] = { x: origin.x + i * GEOM.nodeDistance, y: origin.y };
  });
  return layout;
}
