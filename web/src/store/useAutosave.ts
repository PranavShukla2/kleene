/**
 * Wiring autosave into the running app.
 *
 * Thin on purpose: the policy is in `autosave.ts` and the storage in `persistence.ts`, both
 * testable without React. This only connects them to the store and to the page lifecycle.
 */

import { useEffect, useRef, useState } from 'react';

import { Autosaver, wouldLoseWork, type AutosaveStatus } from '@/store/autosave';
import type { EditorDocument } from '@/store/document';
import { useEditor } from '@/store/editor';
import { AUTOSAVE_KEY, defaultStore, type DocumentStore } from '@/store/persistence';

/** Read whatever was left from the last session. */
export async function recoverDocument(
  store: DocumentStore = defaultStore(),
): Promise<EditorDocument | undefined> {
  try {
    return await store.get(AUTOSAVE_KEY);
  } catch {
    // A corrupt or unreadable database must not stop the editor opening. Starting empty is
    // recoverable; refusing to start is not.
    return undefined;
  }
}

/**
 * Save the document as it changes, and warn before leaving if anything is outstanding.
 *
 * Returns the autosave status so the UI can show it. Passing a store is for tests.
 */
export function useAutosave(store?: DocumentStore): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>({ pending: false, failed: false });
  const saverRef = useRef<Autosaver | undefined>(undefined);

  // The store is created once. Rebuilding it on every render would open a database
  // connection per keystroke.
  const [resolvedStore] = useState(() => store ?? defaultStore());

  useEffect(() => {
    const saver = new Autosaver(resolvedStore);
    saverRef.current = saver;

    const unsubscribeSaver = saver.subscribe(() => {
      setStatus(saver.status);
    });

    // Subscribing to the raw store rather than through a selector hook, because this is an
    // effect rather than a render: it wants every document change, not a re-render.
    const unsubscribeEditor = useEditor.subscribe((state, previous) => {
      if (state.history.present !== previous.history.present) {
        saver.schedule(state.history.present);
      }
    });

    // `pagehide` rather than `beforeunload` for the write itself: it fires on mobile tab
    // eviction and on back-forward-cache navigation, where `beforeunload` does not, and
    // those are real ways to lose a session.
    const onHide = () => {
      void saver.flush();
    };

    // The guard is separate, and asks whether work would genuinely be lost — not whether
    // the document was edited. See `wouldLoseWork`.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!wouldLoseWork(saver.status)) return;
      event.preventDefault();
    };

    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
      unsubscribeSaver();
      unsubscribeEditor();
      void saver.flush();
      saver.dispose();
    };
  }, [resolvedStore]);

  return status;
}
