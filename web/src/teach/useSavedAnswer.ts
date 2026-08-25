/**
 * The student's work, on a page that is not the editor.
 *
 * The solve page shows whatever is in the editor store — but the editor store starts empty on
 * every page load, and it is `App` that restores the autosaved document. `App` only mounts on
 * `/editor`.
 *
 * So without this, the sequence that actually happens — open the problem link, go and draw an
 * answer, come back to check it — showed an empty canvas and a disabled Check button. The
 * work was safe in IndexedDB the whole time; the page simply never asked for it.
 *
 * Restores only into an empty store, so it can never overwrite a document the editor has
 * already put there. Whoever loaded first wins, and the editor is the one that loads with
 * intent.
 */

import { useEffect } from 'react';

import { useEditor } from '@/store/editor';
import { AUTOSAVE_KEY, defaultStore } from '@/store/persistence';

export function useSavedAnswer(): void {
  useEffect(() => {
    let live = true;

    void defaultStore()
      .get(AUTOSAVE_KEY)
      .then((saved) => {
        if (!live || !saved) return;
        // Checked at the moment of writing rather than when the read began: an editor mounted
        // in between would have loaded something the student is looking at right now.
        if (useEditor.getState().history.present.automaton.states.length > 0) return;
        useEditor.getState().load(saved);
      })
      .catch(() => {
        // Blocked storage and private browsing both land here. An answer that cannot be
        // recovered is a blank canvas, which is a state this page already renders.
      });

    return () => {
      live = false;
    };
  }, []);
}
