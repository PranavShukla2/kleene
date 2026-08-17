/**
 * The document the editor works on.
 *
 * A thin normalisation of the generated {@link Document}: `layout` and `meta` are optional in
 * a file, because a hand-written or freshly-converted one has neither, but the editor always
 * has both. Normalising once on load is better than every call site guarding for `undefined`.
 *
 * Everything here is **immutable**. Edits return a new document sharing every unchanged
 * substructure, which is what makes the undo history cheap: a snapshot is a pointer plus the
 * spine that actually changed, not a copy of the machine.
 */

import type { Automaton, Meta, Point, State, StateId, Transition } from '@/model/automaton';

/** A document with the parts the editor relies on always present. */
export interface EditorDocument {
  version: number;
  automaton: Automaton;
  /** Where each state sits. A state with no entry is positioned automatically. */
  layout: Record<StateId, Point>;
  meta: Meta;
}

/** The document a fresh editor session starts from. */
export function emptyDocument(): EditorDocument {
  return {
    version: 1,
    automaton: { alphabet: [], states: [], start: 0, transitions: [] },
    layout: {},
    meta: {},
  };
}

/** Fill in the parts a file may omit. */
export function normalize(
  document: Pick<EditorDocument, 'automaton'> & Partial<EditorDocument>,
): EditorDocument {
  return {
    version: document.version ?? 1,
    automaton: document.automaton,
    layout: document.layout ?? {},
    meta: document.meta ?? {},
  };
}

/** The next unused state id. */
export function nextStateId(automaton: Automaton): StateId {
  // max + 1, never `length`. Ids are not contiguous once a state has been deleted, and
  // `length` would silently collide with an existing one.
  return automaton.states.reduce((highest, state) => Math.max(highest, state.id), -1) + 1;
}

/** A label no existing state is using, based on `q0`, `q1`, … */
export function nextStateLabel(automaton: Automaton): string {
  const used = new Set(automaton.states.map((state) => state.label));
  for (let n = 0; ; n += 1) {
    const candidate = `q${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

/** Replace the automaton, leaving everything else alone. */
/**
 * Whether a label is already used by some *other* state.
 *
 * Excluding the state being renamed matters: without it, committing a rename that changes
 * nothing would report the state's own name as taken, and the field would refuse to close.
 *
 * Comparison is case-sensitive and exact. `q0` and `Q0` are different names in every textbook
 * this tool sits beside, and quietly treating them as the same would be a stronger claim than
 * uniqueness needs to make.
 */
export function labelTaken(automaton: Automaton, label: string, exceptId?: StateId): boolean {
  return automaton.states.some((state) => state.id !== exceptId && state.label === label);
}

export function withAutomaton(document: EditorDocument, automaton: Automaton): EditorDocument {
  return { ...document, automaton };
}

/** Replace one state, matched by id. */
export function mapState(
  automaton: Automaton,
  id: StateId,
  change: (state: State) => State,
): Automaton {
  return {
    ...automaton,
    states: automaton.states.map((state) => (state.id === id ? change(state) : state)),
  };
}

/** Whether a transition already exists. */
export function hasTransition(
  automaton: Automaton,
  from: StateId,
  to: StateId,
  on: string | undefined,
): boolean {
  return automaton.transitions.some(
    (transition) => transition.from === from && transition.to === to && transition.on === on,
  );
}

/** Every transition touching a state, in either direction. */
export function transitionsTouching(automaton: Automaton, id: StateId): Transition[] {
  return automaton.transitions.filter(
    (transition) => transition.from === id || transition.to === id,
  );
}
