import { describe, expect, it } from 'vitest';

import { pathOf, routeOf, toolSlug } from '@/router';

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
    expect(routeOf('/editor/extra')).toBe('missing');
  });

  it('ignores a query string and a fragment', () => {
    // It takes whatever a caller has. A deep link built as `/learn#epsilon-closure` resolved
    // to `missing` until this existed — a 404 for a page that was right there.
    expect(routeOf('/learn#epsilon-closure')).toBe('learn');
    expect(routeOf('/convert?q=a*b*')).toBe('convert');
    expect(routeOf('/tools/nfa-to-dfa#faq')).toBe('tool');
  });

  it('reads a tool page and its slug', () => {
    // The one route with a parameter. A second would be the point to reach for a real matcher
    // rather than extending this file again.
    expect(routeOf('/tools/nfa-to-dfa')).toBe('tool');
    expect(routeOf('/tools/nfa-to-dfa/')).toBe('tool');
    expect(toolSlug('/tools/nfa-to-dfa')).toBe('nfa-to-dfa');
    expect(toolSlug('/tools/nfa-to-dfa/')).toBe('nfa-to-dfa');
  });

  it('does not read a slug out of a path that has none', () => {
    // `/tools` with nothing after it is not a tool page, and treating it as one would render
    // a page about a tool that does not exist.
    expect(toolSlug('/tools')).toBeUndefined();
    expect(toolSlug('/convert')).toBeUndefined();
    expect(toolSlug('/tools/a/b')).toBeUndefined();
  });

  it('round-trips every route through its path', () => {
    // The two directions come from one table, and this is what keeps that true as routes are
    // added — a route whose path does not parse back to it is unreachable by link.
    //
    // Listed rather than derived from `PATHS`, because two entries deliberately do not
    // round-trip: `missing` has no path of its own (it keeps the URL that failed), and `tool`
    // holds a prefix rather than a path, since its real URL depends on a slug.
    for (const route of [
      'overview',
      'editor',
      'convert',
      'examples',
      'learn',
      'roadmap',
      'pricing',
      'docs',
      'changelog',
      'about',
      'jflap',
      'download',
      'start',
      'solve',
      'practice',
      'pumping',
    ] as const) {
      expect(routeOf(pathOf(route))).toBe(route);
    }
  });
});
