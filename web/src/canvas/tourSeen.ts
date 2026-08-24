/**
 * Whether the first-run tour has already been given (Phase 5 E6).
 *
 * Its own module so `Tour.tsx` exports only components — which is what keeps fast refresh
 * working on the file most likely to be edited while looking at it.
 */

/** Remembered across visits. Being shown the tour twice is being told you did not learn. */
const SEEN_KEY = 'kleene.tour.seen';

/** Whether the tour has been given. Read once, on the first render. */
export function tourSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === 'yes';
  } catch {
    // Private browsing, blocked storage. Showing the tour again is a smaller failure than
    // failing to start, so this errs towards showing it.
    return false;
  }
}

/** Record that it has. */
export function rememberTourSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, 'yes');
  } catch {
    // Non-fatal. The cost is being shown three cards again.
  }
}
