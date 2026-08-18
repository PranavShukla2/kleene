/**
 * Small preferences that belong to the window rather than to the document.
 *
 * Whether the side panel is open is not part of an automaton — saving it into the `.kln` file
 * would mean sharing a link imposed your panel layout on the person opening it. So it lives
 * here, in `localStorage`, next to the theme, which is exactly the same kind of thing.
 *
 * `localStorage` rather than IndexedDB deliberately. The document store uses IndexedDB because
 * it holds work worth not losing; these are two booleans, and reading them *synchronously*
 * during the first render is what stops the panel flashing open and then shutting on every
 * page load.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'kleene.preferences';

/** Everything remembered about the shell. */
export interface Preferences {
  /** Whether the side panel is showing. */
  panelOpen: boolean;
}

const DEFAULTS: Preferences = {
  // Open on a first visit. The panels are where the transition table, the tuple and the input
  // tester live, and a first-time visitor who cannot see them has no way to learn they exist.
  panelOpen: true,
};

function stored(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;

    // Merged over the defaults rather than trusted wholesale, so a preferences object written
    // by an older build — missing a key added since — does not leave a field undefined.
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;
    return { ...DEFAULTS, ...(parsed as Partial<Preferences>) };
  } catch {
    // Private browsing, blocked storage, and corrupt JSON all land here. A panel position is
    // not worth failing to start over.
    return DEFAULTS;
  }
}

/** Read and update the shell preferences. */
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(stored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Non-fatal, as above.
    }
  }, [preferences]);

  const togglePanel = useCallback(() => {
    setPreferences((current) => ({ ...current, panelOpen: !current.panelOpen }));
  }, []);

  return { preferences, togglePanel };
}
