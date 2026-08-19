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

  it('reports an unknown path as missing rather than pretending it was the overview', () => {
    // **Reversed.** This used to fall through to the overview, on the grounds that a stale
    // link should land somewhere explaining what this is rather than on an apology. The
    // reasoning was right and the mechanism was wrong: silently rendering the front page
    // tells the visitor their URL was fine, so an old link in someone's notes reads as "the
    // site changed" and they have no way to find out otherwise.
    //
    // The original goal is met by the *page* instead — `Missing` carries the pitch and every
    // route, so it explains what this is while still admitting the URL did not exist.
    expect(routeOf('/nonsense')).toBe('missing');
    expect(routeOf('/tools/nfa-to-dfa')).toBe('missing');
  });

  it('round-trips every route through its path', () => {
    // The two directions come from one table, and this is what keeps that true as routes are
    // added — a route whose path does not parse back to it is unreachable by link.
    for (const route of ['overview', 'editor', 'convert', 'examples', 'roadmap'] as const) {
      expect(routeOf(pathOf(route))).toBe(route);
    }
  });
});
