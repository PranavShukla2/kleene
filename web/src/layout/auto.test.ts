import { describe, expect, it } from 'vitest';

import { GEOM, type Layout } from '@/canvas/geometry';
import { hasOverlap, shake } from '@/layout/auto';

/** Two states are far enough apart when this much space separates their centres. */
const CLEAR = GEOM.radius * 2 + GEOM.clearance;

/** Distance between two laid-out states. */
function gap(layout: Layout, a: number, b: number): number {
  return Math.hypot(layout[b]!.x - layout[a]!.x, layout[b]!.y - layout[a]!.y);
}

describe('hasOverlap', () => {
  it('is false when states are comfortably apart', () => {
    expect(hasOverlap({ 0: { x: 0, y: 0 }, 1: { x: 200, y: 0 } }, [0, 1])).toBe(false);
  });

  it('is true when two states are inside the clearance band', () => {
    expect(hasOverlap({ 0: { x: 0, y: 0 }, 1: { x: CLEAR - 1, y: 0 } }, [0, 1])).toBe(true);
  });

  it('is false for a single state, and for none', () => {
    expect(hasOverlap({ 0: { x: 0, y: 0 } }, [0])).toBe(false);
    expect(hasOverlap({}, [])).toBe(false);
  });

  it('ignores ids with no position', () => {
    expect(hasOverlap({ 0: { x: 0, y: 0 } }, [0, 9])).toBe(false);
  });
});

describe('shake', () => {
  it('separates two overlapping states', () => {
    const shaken = shake({ 0: { x: 0, y: 0 }, 1: { x: 10, y: 0 } }, [0, 1]);
    expect(gap(shaken, 0, 1)).toBeGreaterThanOrEqual(CLEAR - 0.001);
  });

  it('leaves states that already have room exactly where they are', () => {
    // The reason this is repulsion-only. A general force simulation would also pull connected
    // states together, undoing an arrangement someone made on purpose.
    const spread: Layout = { 0: { x: 0, y: 0 }, 1: { x: 300, y: 0 }, 2: { x: 0, y: 300 } };
    expect(shake(spread, [0, 1, 2])).toEqual(spread);
  });

  it('separates states stacked at exactly the same point', () => {
    // No direction to push along, so the fallback has to produce one.
    const shaken = shake({ 0: { x: 50, y: 50 }, 1: { x: 50, y: 50 } }, [0, 1]);
    expect(gap(shaken, 0, 1)).toBeGreaterThan(0);
    expect(Number.isFinite(shaken[0]!.x)).toBe(true);
  });

  it('is deterministic', () => {
    // A layout button that produces a different arrangement on every press is the one thing
    // it must not be — so the degenerate case uses a fixed direction, not a random one.
    const crowded: Layout = { 0: { x: 0, y: 0 }, 1: { x: 0, y: 0 }, 2: { x: 4, y: 2 } };
    expect(shake(crowded, [0, 1, 2])).toEqual(shake(crowded, [0, 1, 2]));
  });

  it('resolves a pile of several states', () => {
    const pile: Layout = Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [i, { x: i * 3, y: i * 2 }]),
    );
    const ids = [0, 1, 2, 3, 4, 5];
    expect(hasOverlap(shake(pile, ids), ids)).toBe(false);
  });

  it('keeps states it was not given', () => {
    const shaken = shake({ 0: { x: 0, y: 0 }, 1: { x: 5, y: 0 }, 9: { x: 999, y: 9 } }, [0, 1]);
    expect(shaken[9]).toEqual({ x: 999, y: 9 });
  });
});
