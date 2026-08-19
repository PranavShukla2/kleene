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
  | 'roadmap'
  | 'pricing'
  | 'docs'
  | 'changelog'
  | 'about'
  /** No such page. Not a path anyone navigates *to* — only where an unknown one lands. */
  | 'missing';

/** Where each route lives. One table, so the two directions cannot disagree. */
const PATHS: Record<Route, string> = {
  overview: '/',
  editor: '/editor',
  convert: '/convert',
  examples: '/examples',
  roadmap: '/roadmap',
  pricing: '/pricing',
  docs: '/docs',
  changelog: '/changelog',
  about: '/about',
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
  const normalised = pathname.replace(/\/+$/, '') || '/';
  const found = (Object.keys(PATHS) as Route[])
    .filter((route) => route !== 'missing')
    .find((route) => PATHS[route] === normalised);
  return found ?? 'missing';
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

/** Read the current route, and navigate without a reload. */
export function useRoute(): { route: Route; go: (to: Route, search?: string) => void } {
  const [route, setRoute] = useState<Route>(() => routeOf(window.location.pathname));

  // The back button has to work. Without this, navigating away and pressing back changes the
  // URL and leaves the page it came from on screen — which reads as the app being broken.
  useEffect(() => {
    const onPop = () => {
      setRoute(routeOf(window.location.pathname));
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  const go = useCallback((to: Route, search?: string) => {
    window.history.pushState(null, '', pathOf(to) + (search ?? ''));
    setRoute(to);
    // A fresh page starts at the top. Browsers restore scroll on popstate, which is right, but
    // a pushed navigation is a new page and should behave like one.
    window.scrollTo(0, 0);
  }, []);

  return { route, go };
}
