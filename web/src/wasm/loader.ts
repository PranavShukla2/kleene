/**
 * Loads the Kleene engine exactly once, for the whole app.
 *
 * The types here come from the bindings `wasm-pack` generates. They are deliberately
 * not hand-written: an ambient `.d.ts` that describes what we *think* Rust exports
 * drifts from what it actually exports, and the FFI stops being checked at all.
 */
import init, {
  compile_regex,
  determinism,
  elimination,
  epsilon_closure,
  from_kln,
  minimization,
  example_automaton,
  formal_definition,
  simulate,
  to_dot,
  to_kln,
  to_tikz,
  transition_table,
  validate,
  version,
} from '@wasm';

import type {
  Automaton,
  Compilation,
  Determinism,
  Document,
  Elimination,
  FormalDefinition,
  Minimization,
  Point,
  Report,
  Simulation,
  StateId,
  Traced,
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
  /**
   * Compile a regular expression into an ε-NFA, or into the reason it is not one.
   *
   * `undefined` for an empty input, which is the state the bar is in before anyone has typed
   * — not a mistake to report.
   *
   * Returns *every* stage — ε-NFA, DFA, minimal DFA — from one call. Three calls could each be
   * made against a different expression while the user keeps typing, and the panes would then
   * disagree with each other.
   */
  compileRegex: (source: string) => Compilation | undefined;
  /**
   * An ε-closure, expanded one state at a time (task D4).
   *
   * The narrating implementation, not the precomputed one. Subset construction uses the fast
   * form and records the seeds it closed over, so a round's closure can be replayed on demand
   * without the construction's own trace carrying hundreds of ε-steps nobody asked for.
   */
  epsilonClosure: (automaton: Automaton, seeds: readonly StateId[]) => Traced<StateId[]>;
  /**
   * Partition refinement and its result, in one call (Phase 3 Track E).
   *
   * Carries the machine it ran on as well as the answer. Refinement restricts to reachable
   * states and completes δ first, so every id in the rounds and the marking table indexes a
   * machine the caller never passed in — and a view that drew the caller's DFA beside this
   * table would be labelling blocks with states that machine does not have.
   */
  minimization: (automaton: Automaton) => Minimization;
  /**
   * State elimination, with the GNFA recorded at every step (Phase 3 Track F).
   *
   * `order` picks which state goes next. It is a string rather than a union because the engine
   * owns the list — a TypeScript union here would be a second copy of it, and the two would
   * disagree the first time one is renamed. An unrecognised order falls back to the default
   * rather than failing.
   */
  elimination: (automaton: Automaton, order: string) => Elimination;
  /**
   * TikZ source for a machine, positioned as it is on screen (Phase 4 Track A).
   *
   * Takes the layout because `kleene-core` does not store positions — a machine is a machine
   * wherever it is drawn. It is also why this is the one export that cannot be produced from
   * a `.kln` file by a tool that has never rendered it.
   */
  toTikz: (automaton: Automaton, layout: Record<number, Point>) => string;
  /**
   * Graphviz DOT for a machine (Phase 4 Track G).
   *
   * No layout, unlike `toTikz`: Graphviz is a layout engine, and handing it positions would
   * be telling it not to do the one thing it is for.
   */
  toDot: (automaton: Automaton) => string;
  /** Serialize a document as `.kln` (Phase 4 D1). */
  toKln: (document: Document) => string;
  /**
   * Read a `.kln` file (Phase 4 D1, D3).
   *
   * Throws with a sentence meant to be *shown* — "This file was written by a newer version of
   * Kleene" rather than a parser complaint about an unexpected field several levels down.
   */
  fromKln: (text: string) => Document;
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
      compileRegex: (source: string) => compile_regex(source) as Compilation | undefined,
      minimization: (automaton: Automaton) => minimization(automaton) as Minimization,
      elimination: (automaton: Automaton, order: string) =>
        elimination(automaton, order) as Elimination,
      toTikz: (automaton: Automaton, layout: Record<number, Point>) =>
        to_tikz(automaton, layout),
      toDot: (automaton: Automaton) => to_dot(automaton),
      toKln: (document: Document) => to_kln(document),
      fromKln: (text: string) => from_kln(text) as Document,
      epsilonClosure: (automaton: Automaton, seeds: readonly StateId[]) =>
        // A copy because the binding takes ownership of a `Uint32Array`, and the caller's
        // array is a slice of a step it does not own.
        epsilon_closure(automaton, new Uint32Array(seeds)) as Traced<StateId[]>,
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
