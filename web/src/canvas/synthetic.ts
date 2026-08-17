/**
 * Synthetic machines, for measuring rather than for teaching.
 *
 * Phase 2 B6 sets a floor of 60fps while manipulating a 60-state automaton, and requires it
 * *measured* rather than assumed — the plan is pointed that if SVG cannot hold it, week 5 is
 * when that should be discovered, not week 9. Measuring needs a machine of that size, and no
 * real example is one.
 *
 * Reachable in a browser with `?perf=60`, which is also how the Playwright benchmark drives
 * it. Not linked from anywhere: it is an instrument, not a feature.
 */

import type { Layout } from '@/canvas/geometry';
import { GEOM } from '@/canvas/geometry';
import type { Automaton } from '@/model/automaton';

/**
 * A machine of `n` states, laid out in a grid, with roughly two transitions each.
 *
 * Shaped to be *hard to draw* rather than realistic: long-range edges that cross other
 * states force the clearance routing, and a self-loop every fifth state exercises loop
 * placement. A row of states in a line would measure almost nothing.
 */
export function syntheticMachine(n: number): { automaton: Automaton; layout: Layout } {
  const states = [];
  const transitions = [];
  const layout: Layout = {};
  const perRow = Math.ceil(Math.sqrt(n));

  for (let i = 0; i < n; i += 1) {
    states.push({ id: i, label: `q${i}`, ...(i % 7 === 0 ? { accepting: true } : {}) });
    layout[i] = {
      x: (i % perRow) * GEOM.nodeDistance * 1.4,
      y: Math.floor(i / perRow) * GEOM.nodeDistance * 1.4,
    };

    transitions.push({ from: i, to: (i + 1) % n, on: 'a' });
    // Skipping three states means this edge crosses the two between them, which is the
    // case that triggers clearance routing.
    transitions.push({ from: i, to: (i + 3) % n, on: 'b' });
    if (i % 5 === 0) transitions.push({ from: i, to: i, on: 'c' });
  }

  return { automaton: { alphabet: ['a', 'b', 'c'], states, start: 0, transitions }, layout };
}

/** The size requested by `?perf=`, if any. */
export function requestedPerfSize(search: string): number | undefined {
  const value = new URLSearchParams(search).get('perf');
  if (value === null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 && n <= 500 ? n : undefined;
}
