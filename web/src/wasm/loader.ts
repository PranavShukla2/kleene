/**
 * Loads the Kleene engine exactly once, for the whole app.
 *
 * The types here come from the bindings `wasm-pack` generates. They are deliberately
 * not hand-written: an ambient `.d.ts` that describes what we *think* Rust exports
 * drifts from what it actually exports, and the FFI stops being checked at all.
 */
import init, { example_automaton, version } from '@wasm';

import type { Automaton } from '@/model/automaton';

/** What the engine module exposes to the app. */
export interface Engine {
  /** Version of `kleene-core` this build was compiled against. */
  version: () => string;
  /** Fetch a built-in example automaton by name. */
  example: (name: string) => Automaton;
}

/**
 * In-flight or completed load. Module-scoped so that N components mounting at once
 * trigger one fetch, not N — and so a failed load is not silently retried forever.
 */
let pending: Promise<Engine> | null = null;

/**
 * Initialise the engine, returning the same promise on every call.
 *
 * Rejects with a real `Error` if the `.wasm` cannot be fetched or instantiated. That
 * matters: the default failure mode of a wasm import is a promise that never settles,
 * which surfaces to a user as a spinner that spins forever with nothing in the console.
 */
export function loadEngine(): Promise<Engine> {
  pending ??= init()
    .then(() => ({
      version,
      example: (name: string) => example_automaton(name) as Automaton,
    }))
    .catch((cause: unknown) => {
      // Clear the cache so a later retry can actually retry rather than re-await a
      // rejected promise forever.
      pending = null;
      throw new Error(
        'Could not load the Kleene engine. The WebAssembly module failed to fetch or instantiate.',
        { cause },
      );
    });

  return pending;
}

/** Test seam: forget any cached load. Not used by application code. */
export function resetEngineForTests(): void {
  pending = null;
}
