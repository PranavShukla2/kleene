/**
 * Loads the Kleene engine exactly once, for the whole app.
 *
 * The types here come from the bindings `wasm-pack` generates. They are deliberately
 * not hand-written: an ambient `.d.ts` that describes what we *think* Rust exports
 * drifts from what it actually exports, and the FFI stops being checked at all.
 */
import init, {
  determinism,
  example_automaton,
  formal_definition,
  simulate,
  transition_table,
  validate,
  version,
} from '@wasm';

import type {
  Automaton,
  Determinism,
  FormalDefinition,
  Report,
  Simulation,
  TransitionTable,
} from '@/model/automaton';

/** What the engine module exposes to the app. */
export interface Engine {
  /** Version of `kleene-core` this build was compiled against. */
  version: () => string;
  /** Fetch a built-in example automaton by name. */
  example: (name: string) => Automaton;
  /**
   * Everything wrong with a machine.
   *
   * Through wasm rather than reimplemented here. "Is this well-formed?" is a definition, and
   * a second copy in TypeScript would drift silently — both sides would still compile and
   * both would still return plausible answers, while the strip told a student one thing and
   * the algorithm preconditions enforced another.
   */
  validate: (automaton: Automaton) => Report;
  /** Whether a machine is a DFA, an NFA or an ε-NFA. */
  determinism: (automaton: Automaton) => Determinism;
  /**
   * Run a string, returning every configuration and the reasoning behind it.
   *
   * The input tester steps through this rather than simulating anything itself. Two
   * simulators could disagree about ε-closures or about what "stuck" means, and they would be
   * tested separately and believed equally.
   */
  simulate: (automaton: Automaton, input: string) => Simulation;
  /**
   * δ written out as a table.
   *
   * From Rust, because three of the decisions are semantic rather than presentational:
   * whether an ε column exists, what an empty cell means, and which glyph stands for the
   * empty string. Answering those here would put half the definition of δ in the view layer.
   */
  transitionTable: (automaton: Automaton) => TransitionTable;
  /** `M = (Q, Σ, δ, q₀, F)`, with δ left to the table. */
  formalDefinition: (automaton: Automaton) => FormalDefinition;
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
      validate: (automaton: Automaton) => validate(automaton) as Report,
      determinism: (automaton: Automaton) => determinism(automaton) as Determinism,
      simulate: (automaton: Automaton, input: string) =>
        simulate(automaton, input) as Simulation,
      transitionTable: (automaton: Automaton) => transition_table(automaton) as TransitionTable,
      formalDefinition: (automaton: Automaton) =>
        formal_definition(automaton) as FormalDefinition,
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
