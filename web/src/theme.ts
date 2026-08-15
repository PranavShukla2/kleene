/**
 * Theme selection: follow the system, or override it explicitly.
 *
 * Built in Phase 0 because retrofitting a theme costs a day and doing it now costs an hour.
 * The default for a first-time visitor is to follow the system; an explicit choice persists
 * and wins over the system preference in both directions.
 */

import { useCallback, useEffect, useState } from 'react';

/** What the user has chosen. `system` means "follow `prefers-color-scheme`". */
export type ThemeChoice = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'kleene.theme';

function storedChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : 'system';
  } catch {
    // Private browsing and blocked storage both throw here. A theme is not worth
    // breaking the app over.
    return 'system';
  }
}

/**
 * Apply a choice to the document.
 *
 * `system` removes the attribute entirely rather than writing a resolved value, so the CSS
 * media query takes over again — that is what lets the theme keep tracking the OS if the
 * user changes it later.
 */
function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/** Read and set the theme. */
export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(storedChoice);

  useEffect(() => {
    apply(choice);
    try {
      if (choice === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Non-fatal, as above.
    }
  }, [choice]);

  /** Cycle system → light → dark → system. */
  const cycle = useCallback(() => {
    setChoice((c) => (c === 'system' ? 'light' : c === 'light' ? 'dark' : 'system'));
  }, []);

  return { choice, setChoice, cycle };
}

/** Which theme is actually showing right now, accounting for `system`. */
export function resolvedTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice !== 'system') return choice;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
