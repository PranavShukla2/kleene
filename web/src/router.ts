/**
 * Which page is showing.
 *
 * Hand-rolled rather than a routing library. Kleene has three routes, and roadmap §6.1's
 * `/tools/*` pages are the only planned growth — 20KB of matcher, params and nested outlets
 * would be paying for a problem this app does not have. What it *does* need is a seam, so that
 * adding those pages later is a case in a switch rather than a refactor.
 *
 * The History API, not a hash. Shared links are the distribution mechanism (roadmap §6.4), and
 * `kleene.pranavmshukla.in/tools/nfa-to-dfa` is a URL someone will type or paste into a
 * lecture slide. `#/tools/nfa-to-dfa` is one nobody will.
 */

import { useCallback, useEffect, useState } from 'react';

/** Every page the app can show. */
export type Route = 'overview' | 'editor';

/** Where a path leads. Anything unrecognised falls to the overview rather than a 404. */
export function routeOf(pathname: string): Route {
  return pathname.replace(/\/+$/, '') === '/editor' ? 'editor' : 'overview';
}

/** The path a route lives at. */
export function pathOf(route: Route): string {
  return route === 'editor' ? '/editor' : '/';
}

/** Read the current route, and navigate without a reload. */
export function useRoute(): { route: Route; go: (to: Route) => void } {
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

  const go = useCallback((to: Route) => {
    window.history.pushState(null, '', pathOf(to));
    setRoute(to);
    // A fresh page starts at the top. Browsers restore scroll on popstate, which is right, but
    // a pushed navigation is a new page and should behave like one.
    window.scrollTo(0, 0);
  }, []);

  return { route, go };
}
