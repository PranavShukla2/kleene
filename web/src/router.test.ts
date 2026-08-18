import { describe, expect, it } from 'vitest';

import { pathOf, routeOf } from '@/router';

describe('routeOf', () => {
  it('maps every real path', () => {
    expect(routeOf('/')).toBe('overview');
    expect(routeOf('/editor')).toBe('editor');
    expect(routeOf('/convert')).toBe('convert');
    expect(routeOf('/examples')).toBe('examples');
    expect(routeOf('/roadmap')).toBe('roadmap');
  });

  it('ignores a trailing slash', () => {
    // `/editor/` is the same page as `/editor`. A link that gained a slash somewhere between a
    // lecture slide and a browser must not land on a different page.
    expect(routeOf('/editor/')).toBe('editor');
    expect(routeOf('/editor//')).toBe('editor');
  });

  it('falls back to the overview rather than a not-found', () => {
    // Shared links are the distribution mechanism. A mistyped or stale URL should land
    // somewhere that explains what this is, not on an apology.
    expect(routeOf('/nonsense')).toBe('overview');
    expect(routeOf('/tools/nfa-to-dfa')).toBe('overview');
  });

  it('round-trips every route through its path', () => {
    // The two directions come from one table, and this is what keeps that true as routes are
    // added — a route whose path does not parse back to it is unreachable by link.
    for (const route of ['overview', 'editor', 'convert', 'examples', 'roadmap'] as const) {
      expect(routeOf(pathOf(route))).toBe(route);
    }
  });
});
