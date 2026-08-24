import { describe, expect, it } from 'vitest';

import { EXAMPLES } from '@/overview/examples';

/**
 * The landing page keeps its own tiny list so it can paint before WebAssembly arrives
 * (Phase 5 E4). That is a deliberate duplicate of two entries from the engine's catalogue,
 * and this is what stops it becoming a *divergent* one.
 *
 * The engine cannot be loaded here — it is wasm — so these assert the properties that can be
 * checked without it, and the e2e suite checks that the cards actually open.
 */
describe('the landing page’s example strip', () => {
  it('stays small enough to justify existing at all', () => {
    // If this list grows, the argument for having it disappears: at that point it is a second
    // corpus rather than a hint, and it should read the engine like everything else.
    expect(EXAMPLES.length).toBeLessThanOrEqual(3);
  });

  it('uses keys shaped the way the engine’s are', () => {
    for (const example of EXAMPLES) {
      expect(example.key).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it('says something about every entry', () => {
    for (const example of EXAMPLES) {
      expect(example.title).not.toBe('');
      expect(example.language).not.toBe('');
      expect(example.teaches.length).toBeGreaterThan(20);
    }
  });
});
