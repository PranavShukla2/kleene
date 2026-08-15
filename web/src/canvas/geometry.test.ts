import { describe, expect, it } from 'vitest';

import {
  GEOM,
  bendSideBelow,
  curvedEdge,
  groupEdges,
  hasReverse,
  isObstructed,
  pointOnRim,
  rowLayout,
} from '@/canvas/geometry';

describe('groupEdges', () => {
  it('collapses several symbols between the same pair into one edge', () => {
    // Three overlapping lines is the classic way a generated diagram looks broken.
    const edges = groupEdges([
      { from: 0, to: 1, on: 'b' },
      { from: 0, to: 1, on: 'a' },
      { from: 0, to: 1, on: 'c' },
    ]);

    expect(edges).toHaveLength(1);
    expect(edges[0]?.symbols).toEqual(['a', 'b', 'c']);
  });

  it('sorts symbols so a label does not change with transition insertion order', () => {
    const forward = groupEdges([
      { from: 0, to: 1, on: 'b' },
      { from: 0, to: 1, on: 'a' },
    ]);
    const reversed = groupEdges([
      { from: 0, to: 1, on: 'a' },
      { from: 0, to: 1, on: 'b' },
    ]);

    expect(forward[0]?.symbols).toEqual(reversed[0]?.symbols);
  });

  it('renders a missing symbol as epsilon', () => {
    expect(groupEdges([{ from: 0, to: 1 }])[0]?.symbols).toEqual(['ε']);
  });

  it('keeps opposite directions as separate edges', () => {
    // q0->q1 and q1->q0 are two edges that must curve apart, not one line.
    const edges = groupEdges([
      { from: 0, to: 1, on: 'a' },
      { from: 1, to: 0, on: 'b' },
    ]);
    expect(edges).toHaveLength(2);
  });
});

describe('hasReverse', () => {
  const edges = [
    { from: 0, to: 1 },
    { from: 1, to: 0 },
    { from: 1, to: 2 },
    { from: 2, to: 2 },
  ];

  it('detects a bidirectional pair from both sides', () => {
    expect(hasReverse(edges, 0, 1)).toBe(true);
    expect(hasReverse(edges, 1, 0)).toBe(true);
  });

  it('is false for a one-way edge', () => {
    expect(hasReverse(edges, 1, 2)).toBe(false);
  });

  it('is false for a self-loop, which is drawn as a loop rather than a curve', () => {
    expect(hasReverse(edges, 2, 2)).toBe(false);
  });
});

describe('pointOnRim', () => {
  it('lands exactly on the circle boundary', () => {
    // Edges are clipped to the rim so the arrowhead is not swallowed by the circle.
    const centre = { x: 100, y: 100 };
    const on = pointOnRim(centre, { x: 300, y: 100 });
    expect(Math.hypot(on.x - centre.x, on.y - centre.y)).toBeCloseTo(GEOM.radius, 6);
  });

  it('points toward the target regardless of direction', () => {
    const centre = { x: 0, y: 0 };
    expect(pointOnRim(centre, { x: -50, y: 0 }).x).toBeCloseTo(-GEOM.radius, 6);
    expect(pointOnRim(centre, { x: 0, y: 50 }).y).toBeCloseTo(GEOM.radius, 6);
  });
});

describe('curvedEdge', () => {
  it('separates the two halves of a pair given the same side', () => {
    // Regression: negating `side` for the reverse direction cancels out the flip the
    // normal vector already performs, putting both curves on top of each other. Both
    // directions must pass the same side and rely on that flip.
    const a = { x: 0, y: 0 };
    const b = { x: 200, y: 0 };
    const forward = curvedEdge(a, b);
    const back = curvedEdge(b, a);

    expect(forward.label.y).toBeCloseTo(-back.label.y, 6);
    expect(forward.label.y).not.toBeCloseTo(0, 3);
  });

  it('does put both curves on one side if side is negated — the bug this guards', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 200, y: 0 };
    expect(curvedEdge(a, b, 1).label.y).toBeCloseTo(curvedEdge(b, a, -1).label.y, 6);
  });
});

describe('isObstructed', () => {
  // The exact situation the first render got wrong: q0, q1, q2 in a row, and the
  // q2 -> q0 edge running straight over q1. It read as a double-headed arrow between
  // q0 and q1 — a wrong diagram, not just an ugly one.
  const q0 = { x: 90, y: 130 };
  const q1 = { x: 186, y: 130 };
  const q2 = { x: 282, y: 130 };

  it('detects an edge passing straight through an intervening state', () => {
    expect(isObstructed(q2, q0, [q1])).toBe(true);
  });

  it('leaves adjacent states alone', () => {
    expect(isObstructed(q0, q1, [q2])).toBe(false);
  });

  it('ignores states that are merely near the endpoints, not between them', () => {
    // Clamping the projection to the segment is what makes this true; without it, a
    // state behind q0 would count as blocking an edge that travels away from it.
    expect(isObstructed(q1, q2, [{ x: -200, y: 130 }])).toBe(false);
  });

  it('treats a near miss inside the clearance band as obstructed', () => {
    const grazing = { x: 186, y: 130 + GEOM.radius + GEOM.clearance - 1 };
    expect(isObstructed(q0, q2, [grazing])).toBe(true);
  });
});

describe('bendClearance', () => {
  it('is large enough for the curve to actually clear a state', () => {
    // A quadratic reaches only half its control offset at the midpoint, so the naive
    // choice of bendOffset would deviate 14px and pass through a 24px-radius state.
    const deviation = GEOM.bendClearance / 2;
    expect(deviation).toBeGreaterThan(GEOM.radius + GEOM.clearance);
  });

  it('routes the curve clear of the state it is avoiding', () => {
    const q0 = { x: 90, y: 130 };
    const q1 = { x: 186, y: 130 };
    const q2 = { x: 282, y: 130 };
    const routed = curvedEdge(q2, q0, bendSideBelow(q2, q0), GEOM.bendClearance);

    // The label rides the curve's midpoint, so its distance from q1 is the clearance.
    expect(Math.hypot(routed.label.x - q1.x, routed.label.y - q1.y)).toBeGreaterThan(
      GEOM.radius,
    );
  });
});

describe('bendSideBelow', () => {
  it('bows downward in both travel directions, away from self-loops', () => {
    const left = { x: 0, y: 100 };
    const right = { x: 200, y: 100 };

    // Self-loops sit above their state, so an edge routed over the top collides.
    expect(curvedEdge(left, right, bendSideBelow(left, right), GEOM.bendClearance).label.y)
      .toBeGreaterThan(100);
    expect(curvedEdge(right, left, bendSideBelow(right, left), GEOM.bendClearance).label.y)
      .toBeGreaterThan(100);
  });
});

describe('rowLayout', () => {
  it('spaces states at the distance that maps to TikZ node distance=2.4cm', () => {
    const layout = rowLayout([0, 1, 2]);
    expect((layout[1]?.x ?? 0) - (layout[0]?.x ?? 0)).toBe(GEOM.nodeDistance);
    expect(layout[0]?.y).toBe(layout[2]?.y);
  });
});
