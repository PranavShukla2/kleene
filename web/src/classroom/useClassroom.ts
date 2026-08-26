/**
 * The classroom API, chosen once and handed to the pages (phase C0.3).
 *
 * One place decides whether the app is talking to a server or to the browser's own storage, so
 * no page has to know. The switch is `VITE_API_URL`: set it and the real adapter is used, leave
 * it unset and the local one is — which is what makes `npm run dev` a working classroom with no
 * backend running.
 *
 * The signed-out, serverless path is not a fallback for a broken deployment. It is the mode the
 * project's original constraint promised, kept alive: everything except the classroom works
 * offline with nobody signed in, and the classroom itself degrades to a single-person one
 * rather than to an error page.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Account, ClassroomApi } from '@/classroom/api';
import { localClassroom } from '@/classroom/local';
import type { Engine } from '@/wasm/loader';

/** Where the API lives, or nothing when there is not one. */
export const API_URL: string | undefined =
  (import.meta.env.VITE_API_URL as string | undefined) || undefined;

/** Whether this build talks to a server at all. */
export const hasServer = API_URL !== undefined;

export function useClassroomApi(engine: Engine | undefined): ClassroomApi {
  /*
    Rebuilt when the engine arrives, rather than reaching for it through a ref.

    The adapter holds no state of its own — every row is in `localStorage` — so building a new
    one costs nothing, and it removes the problem the ref was there to solve: an adapter
    constructed before the wasm module loaded would otherwise have captured `undefined` and
    told the first submission that the engine had not loaded, which by then it had.

    A first attempt did use a ref and the linter refused it twice over: mutating it during
    render, then reading it during render. Both objections were right, and the version without
    it is shorter.
  */
  return useMemo(() => localClassroom(() => engine), [engine]);
}

/** Who is signed in, and how to stop being. */
export function useAccount(api: ClassroomApi) {
  const [account, setAccount] = useState<Account | undefined>(undefined);
  // Starts true and is only ever set from a callback. Setting it synchronously inside the
  // effect below would be a second render before the first has been shown, for a value that
  // was already correct.
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    void api
      .me()
      .then(setAccount)
      .catch(() => {
        setAccount(undefined);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(() => {
    void api.signOut().then(refresh);
  }, [api, refresh]);

  return { account, loading, refresh, signOut };
}
