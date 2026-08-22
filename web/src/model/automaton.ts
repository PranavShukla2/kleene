/**
 * The automaton model, re-exported from the types generated out of Rust.
 *
 * The shapes themselves live in `./generated/`, written by `scripts/generate-types.sh` from
 * the definitions in `kleene-core`. Nothing here restates them — a hand-maintained second
 * copy of a schema drifts from the first within a fortnight, and the drift is silent because
 * both sides still compile.
 *
 * One generated type is correct for both the `.kln` format and the wasm boundary because the
 * two now share an encoding: states are an ordered array with the id inside each state. See
 * `docs/formats/kln.md` for why an object keyed by id cannot work — it has no way to express
 * order, and trace reproducibility depends on it.
 *
 * What lives here instead is the small amount of *behaviour* the app needs on top of the
 * shapes, which has no business being generated.
 */

import type { Automaton } from '@/model/generated/Automaton';
import type { State } from '@/model/generated/State';
import type { Transition } from '@/model/generated/Transition';

export type { Automaton } from '@/model/generated/Automaton';
export type { State } from '@/model/generated/State';
export type { Transition } from '@/model/generated/Transition';
export type { Document } from '@/model/generated/Document';
export type { Meta } from '@/model/generated/Meta';
export type { Point } from '@/model/generated/Point';
export type { Report } from '@/model/generated/Report';
export type { Problem } from '@/model/generated/Problem';
export type { ProblemKind } from '@/model/generated/ProblemKind';
export type { Severity } from '@/model/generated/Severity';
export type { Simulation } from '@/model/generated/Simulation';
export type { Run } from '@/model/generated/Run';
export type { Configuration } from '@/model/generated/Configuration';
export type { Verdict } from '@/model/generated/Verdict';
export type { Step } from '@/model/generated/Step';
export type { StepKind } from '@/model/generated/StepKind';
export type { Frame } from '@/model/generated/Frame';
export type { Traced } from '@/model/generated/Traced';
export type { Minimization } from '@/model/generated/Minimization';
export type { MarkingTable } from '@/model/generated/MarkingTable';
export type { Cell } from '@/model/generated/Cell';
export type { Mark } from '@/model/generated/Mark';
export type { TransitionTable } from '@/model/generated/TransitionTable';
export type { TableRow } from '@/model/generated/TableRow';
export type { TableColumn } from '@/model/generated/TableColumn';
export type { FormalDefinition } from '@/model/generated/FormalDefinition';
export type { Compilation } from '@/model/generated/Compilation';
export type { Stage } from '@/model/generated/Stage';
export type { ParseError } from '@/model/generated/ParseError';
export type { Span } from '@/model/generated/Span';

/** Identifies a state within one automaton. */
export type StateId = number;

/** One symbol of the alphabet. */
export type Sym = string;

/** Find a state by id. */
export function stateById(automaton: Automaton, id: StateId): State | undefined {
  return automaton.states.find((state) => state.id === id);
}

/** Whether a transition is an ε-transition. */
export function isEpsilon(transition: Transition): boolean {
  return transition.on === undefined || transition.on === null;
}

/**
 * How deterministic a machine is — the badge text, exactly as the core spells it.
 *
 * Phase 0 carried a TypeScript reimplementation of this classification, with a note saying
 * E4 would route it through wasm. This is E4, and the copy is gone. A definition of "is this
 * a DFA" living in two languages is precisely the drift the architecture forbids, and it
 * would have been silent: both sides compile, both return plausible answers, and the badge
 * would disagree with the preconditions the algorithms actually enforce.
 */
export type Determinism = 'DFA' | 'NFA' | 'ε-NFA';
