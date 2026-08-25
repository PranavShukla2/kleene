/**
 * The problem in the address bar, decoded.
 *
 * Asynchronous because the payload is inflated with `DecompressionStream`, which is the same
 * codec the share links use — so this hook holds `undefined` for one frame on a real link, and
 * the page has to be able to render that state without flashing an error.
 *
 * Listens for `hashchange` for the reason the editor's share handling does: a link that differs
 * from the current URL only by its fragment does not reload the page, so a student who is handed
 * a second problem while looking at the first would otherwise see nothing happen.
 */

import { useEffect, useState } from 'react';

import { decodeValue, problemIn } from '@/store/share';
import type { ProblemSpec } from '@/model/automaton';

export function useProblem(): ProblemSpec | undefined {
  const [spec, setSpec] = useState<ProblemSpec | undefined>(undefined);

  useEffect(() => {
    let live = true;

    const read = () => {
      const payload = problemIn(window.location.hash);
      if (payload === undefined) {
        setSpec(undefined);
        return;
      }
      void decodeValue<ProblemSpec>(payload).then((decoded) => {
        // Guarded, because a second `hashchange` can land while the first decode is still in
        // flight — and resolving them out of order would show the previous problem.
        if (live) setSpec(decoded);
      });
    };

    read();
    window.addEventListener('hashchange', read);
    return () => {
      live = false;
      window.removeEventListener('hashchange', read);
    };
  }, []);

  return spec;
}
