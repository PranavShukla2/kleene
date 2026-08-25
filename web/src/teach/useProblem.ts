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

import { decodeValue, problemIn, problemKeyIn } from '@/store/share';
import type { ProblemSpec } from '@/model/automaton';

export function useProblem(): { spec: ProblemSpec | undefined; key: string | undefined } {
  const [spec, setSpec] = useState<ProblemSpec | undefined>(undefined);
  const [key, setKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    let live = true;

    const read = () => {
      const payload = problemIn(window.location.hash);
      setKey(problemKeyIn(window.location.hash));
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

  return { spec, key };
}

/**
 * Encode a spec the way a link carries one.
 *
 * Used when the problem set opens a problem: the solve view reads its problem out of the
 * fragment and should not learn a second way of receiving one. A problem chosen from the list
 * and a problem sent by a lecturer arrive by the same door, which also means the URL is
 * shareable from either.
 */
export async function openProblem(spec: ProblemSpec): Promise<string> {
  const { encodeValue } = await import('@/store/share');
  return encodeValue(spec);
}
