/**
 * Telling someone a new version is ready, and letting them decide (Phase 5 A5).
 *
 * The service worker is registered in `prompt` mode rather than `autoUpdate`, and this is the
 * half that makes that choice worth anything. The reason is specific: this app holds unsaved
 * work — a machine someone is drawing lives in IndexedDB and in memory, not on a server — and
 * a worker that swapped itself and reloaded under a half-finished diagram is a way to lose
 * one. The new version can wait five minutes.
 *
 * ## Offline is not an event worth announcing
 *
 * `vite-plugin-pwa` also offers an "app ready to work offline" callback, and it is not used.
 * Nothing changed for the reader: the page they are on already worked. A toast saying so is a
 * notification about the *implementation*, which is the kind of thing that trains people to
 * dismiss notifications without reading them.
 */

import { useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export interface UpdateState {
  /** A newer build is downloaded and waiting. */
  ready: boolean;
  /** Take it. Reloads the page, so callers should have saved anything worth keeping. */
  apply: () => void;
  /** Not now. Stays dismissed until the next new build arrives. */
  dismiss: () => void;
}

export function useUpdatePrompt(): UpdateState {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const apply = useCallback(() => {
    void updateServiceWorker(true);
  }, [updateServiceWorker]);

  /*
    Dismissing *is* clearing `needRefresh`, and no separate flag is kept.

    A `dismissed` boolean was the first version and it was redundant: the plugin sets
    `needRefresh` true when a new build is waiting, and nothing sets it true again until a
    *different* build arrives. So "dismissed until the next version" falls out, and the second
    piece of state was only there to be kept in step with the first.

    Not persisted, either. Someone who once pressed "later" should not stop being told about
    updates on a tool whose whole distribution model is a URL.
  */
  const dismiss = useCallback(() => {
    setNeedRefresh(false);
  }, [setNeedRefresh]);

  return { ready: needRefresh, apply, dismiss };
}
