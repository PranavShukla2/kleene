/**
 * Small preferences that belong to the window rather than to the document.
 *
 * Which panel is open is not part of an automaton — saving it into the `.kln` file would mean
 * sharing a link imposed your panel layout on the person opening it. So it lives here, in
 * `localStorage`, next to the theme, which is exactly the same kind of thing.
 *
 * `localStorage` rather than IndexedDB deliberately. The document store uses IndexedDB because
 * it holds work worth not losing; this is one short string, and reading it *synchronously*
 * during the first render is what stops a panel flashing open and then shutting on every page
 * load.
 */

import { useCallback, useEffect, useState } from 'react';

import { isPanelId, type PanelId } from '@/editor/panels';

const STORAGE_KEY = 'kleene.preferences';

/** Everything remembered about the shell. */
export interface Preferences {
  /** Which panel is showing, or `undefined` for none. */
  openPanel: PanelId | undefined;
}

const DEFAULTS: Preferences = {
  // Nothing open on a first visit. The rail is always on screen, so the panels are still
  // discoverable — which is what the old always-open column was really for — and a first-time
  // visitor meets the canvas rather than a wall of controls around it.
  openPanel: undefined,
};

/**
 * Read what was stored, tolerating anything that is not what we expect.
 *
 * This field used to be a boolean called `panelOpen`, so a returning user has one of those in
 * storage. A `true` becomes the transition table: it is the panel that a boolean "the panels
 * are open" was mostly showing, and reopening *something* respects the choice they made.
 * Anything unrecognisable — a renamed panel, a hand-edited value, a half-written record —
 * degrades to nothing open, which is always a legal state.
 */
export function openPanelFromStorage(): PanelId | undefined {
  return stored().openPanel;
}

function stored(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULTS;

    const record = parsed as Record<string, unknown>;
    if (isPanelId(record.openPanel)) return { openPanel: record.openPanel };
    if (record.panelOpen === true) return { openPanel: 'table' };

    return DEFAULTS;
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

  /** Open a panel, or close it if it is the one already open. */
  const togglePanelId = useCallback((id: PanelId) => {
    setPreferences((current) => ({
      openPanel: current.openPanel === id ? undefined : id,
    }));
  }, []);

  const closePanel = useCallback(() => {
    setPreferences({ openPanel: undefined });
  }, []);

  /**
   * The keyboard's toggle, which has no panel in mind.
   *
   * `Mod+\` predates the rail and means "show me the panels" — so it opens the last useful one
   * rather than requiring a choice the keyboard cannot express.
   */
  const togglePanel = useCallback(() => {
    setPreferences((current) => ({
      openPanel: current.openPanel === undefined ? 'table' : undefined,
    }));
  }, []);

  return { preferences, togglePanel, togglePanelId, closePanel };
}
