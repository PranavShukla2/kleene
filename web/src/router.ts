/**
 * Which page is showing.
 *
 * Hand-rolled rather than a routing library. Nine flat routes with no params and no nesting —
 * 20KB of matcher, dynamic segments and outlets would be paying for a problem this app does
 * not have. The seam was the point: every page added since has been one row in `PATHS` and one
 * case in a switch, which is exactly what it was built to be.
 *
 * Roadmap §6.1's `/tools/*` pages are the first thing here that will want a real segment, and
 * that is the point at which this file should be reconsidered rather than extended.
 *
 * The History API, not a hash. Shared links are the distribution mechanism (roadmap §6.4), and
 * `kleene.pranavmshukla.in/tools/nfa-to-dfa` is a URL someone will type or paste into a
 * lecture slide. `#/tools/nfa-to-dfa` is one nobody will.
 */

import { useCallback, useEffect, useState } from 'react';

/** Every page the app can show. */
export type Route =
  | 'overview'
  | 'editor'
  | 'convert'
  | 'examples'
  | 'learn'
  | 'roadmap'
  | 'pricing'
  | 'docs'
  | 'changelog'
  | 'about'
  | 'jflap'
  | 'download'
  | 'start'
  | 'solve'
  | 'practice'
  /** A `/tools/<slug>` landing page. The slug is read separately, from the path. */
  | 'tool'
  /** No such page. Not a path anyone navigates *to* — only where an unknown one lands. */
  | 'missing';

/** Where each route lives. One table, so the two directions cannot disagree. */
const PATHS: Record<Route, string> = {
  overview: '/',
  editor: '/editor',
  convert: '/convert',
  examples: '/examples',
  learn: '/learn',
  roadmap: '/roadmap',
  pricing: '/pricing',
  docs: '/docs',
  changelog: '/changelog',
  about: '/about',
  // Named for the search someone actually types. Not `/vs-jflap`: the page answers a
  // question rather than picking a fight, and roadmap §7 rules out trading on the name
  // anywhere it would look like an association.
  jflap: '/jflap-alternative',
  download: '/download',
  start: '/start',
  solve: '/solve',
  practice: '/practice',
  // The prefix only. `pathOf` never builds a real tool URL — `toolPath` does, because a route
  // with a parameter cannot round-trip through a table of constants.
  tool: '/tools',
  // Never matched by `routeOf`, and deliberately not `/404`: the address bar must keep the
  // URL that failed, so someone can see their own typo and fix it.
  missing: '/',
};

/**
 * Where a path leads.
 *
 * An unknown path is `missing`, not the overview. Silently rendering the front page tells a
 * visitor their URL was fine when it was not — so a stale link in someone's notes looks like
 * the site changed rather than like the link is old, and they have no way to tell.
 */
export function routeOf(pathname: string): Route {
  // A query string or a fragment is not part of the path, and this takes whatever a caller
  // has. `goPath('/learn#epsilon-closure')` used to resolve to `missing`, which turned a
  // deep link from the command palette into a 404 for a page that was right there.
  const withoutSuffix = pathname.split(/[?#]/)[0] ?? pathname;
  const normalised = withoutSuffix.replace(/\/+$/, '') || '/';

  // The one route with a parameter, and the reason this file has a note about when to stop
  // extending it. A second one would be the point to reach for a real matcher.
  if (normalised.startsWith('/tools/')) return 'tool';

  const found = (Object.keys(PATHS) as Route[])
    .filter((route) => route !== 'missing' && route !== 'tool')
    .find((route) => PATHS[route] === normalised);
  return found ?? 'missing';
}

/** The slug in a `/tools/<slug>` path, if the path is one. */
export function toolSlug(pathname: string): string | undefined {
  const withoutSuffix = pathname.split(/[?#]/)[0] ?? pathname;
  const match = /^\/tools\/([^/]+)\/?$/.exec(withoutSuffix);
  return match?.[1];
}

/** Where a tool page lives. Not in `PATHS`, because the path depends on the slug. */
export function toolPath(slug: string): string {
  return `/tools/${slug}`;
}

/** The path a route lives at. */
export function pathOf(route: Route): string {
  return PATHS[route];
}

/**
 * What the URL asks the editor to open, if anything.
 *
 * A query parameter rather than a path segment. `/editor?example=ends_with_ab` says "the
 * editor, showing this" — the page is the editor either way, and the example is an argument to
 * it. `/examples/ends_with_ab` would claim a different page exists, which would then need one.
 */
export function requestedExample(search: string): string | undefined {
  return new URLSearchParams(search).get('example') ?? undefined;
}

/**
 * The expression `/convert` should open with, if the URL asked for one.
 *
 * `?q=` rather than a path segment, for the same reason as `?example=`: the page is the
 * converter either way, and the expression is an argument to it. It also has to survive being
 * pasted — regular expressions are full of characters a URL treats as structure, so this is
 * always read through `URLSearchParams` and never by splitting a string.
 */
export function requestedExpression(search: string): string | undefined {
  const asked = new URLSearchParams(search).get('q');
  return asked === null || asked === '' ? undefined : asked;
}

/** Where the app is: enough of the URL that every page can read what it needs. */
export interface Location {
  pathname: string;
  /** Including the leading `?`, or empty. */
  search: string;
}

/** Read the current location, and navigate without a reload. */
export function useRoute(): {
  route: Route;
  location: Location;
  go: (to: Route, search?: string) => void;
  /**
   * Navigate to a literal path, deriving the route from it.
   *
   * `go` builds a URL from a route, which cannot express `/tools/<slug>` — the route is the
   * same for every slug. Rather than smuggle the segment through the `search` argument and
   * hope nobody passes a real query string, a parameterised route gets its own door.
   */
  goPath: (path: string) => void;
} {
  /**
   * The **location**, not the route.
   *
   * This held a `Route` and nothing else, and two pages paid for it. `/tools/nfa-to-dfa` →
   * `/tools/minimize-dfa` is one route to the next, so `setRoute` was handed the value it
   * already had, React saw no change, and the URL updated under a page that never re-rendered.
   * The same for `/convert?q=a*b*` → `/convert?q=(ab)*+b`.
   *
   * Both pages read their argument out of `window.location` during render, which is fine —
   * what was missing was anything telling React that `window.location` had moved. Holding the
   * location itself is that thing, and the route is derived from it.
   */
  const [location, setLocation] = useState<Location>(here);

  // The back button has to work. Without this, navigating away and pressing back changes the
  // URL and leaves the page it came from on screen — which reads as the app being broken.
  useEffect(() => {
    const onPop = () => {
      setLocation(here());
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  const route = routeOf(location.pathname);

  const go = useCallback((to: Route, search?: string) => {
    window.history.pushState(null, '', pathOf(to) + (search ?? ''));
    setLocation({ pathname: pathOf(to), search: search ?? '' });
    // A fresh page starts at the top. Browsers restore scroll on popstate, which is right, but
    // a pushed navigation is a new page and should behave like one.
    window.scrollTo(0, 0);
  }, []);

  const goPath = useCallback((path: string) => {
    window.history.pushState(null, '', path);
    setLocation(here());

    const [, hash] = path.split('#');
    if (hash === undefined) {
      window.scrollTo(0, 0);
      return;
    }

    window.scrollTo(0, 0);
    scrollToWhenItExists(hash);
  }, []);

  return { route, location, go, goPath };
}

/** The current location, read from the browser. */
function here(): Location {
  return { pathname: window.location.pathname, search: window.location.search };
}

/** How long to keep looking for an anchor before giving up. */
const ANCHOR_DEADLINE_MS = 1200;

/**
 * Scroll to an element that does not exist yet.
 *
 * Waiting a frame is not enough here. The shell crossfades between pages, so the incoming
 * page mounts a transition later — and a fixed delay tuned to that transition would be a
 * second copy of its duration, wrong the moment either changes.
 *
 * So it looks every frame until the element turns up, with a deadline. Giving up silently is
 * correct: the visitor is on the right page either way, and scrolling somewhere arbitrary
 * because an anchor was mistyped is worse than not scrolling at all.
 */
function scrollToWhenItExists(id: string, deadline = ANCHOR_DEADLINE_MS): void {
  const until = performance.now() + deadline;

  const look = () => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ block: 'start' });
      return;
    }
    if (performance.now() < until) requestAnimationFrame(look);
  };

  requestAnimationFrame(look);
}
