/**
 * Every edit the editor can make, as a named command.
 *
 * Modelling edits as commands from the first line, rather than diffing state later, is what
 * the plan calls non-negotiable — retrofitting undo is a rewrite. It buys three things:
 *
 * - **Undo that knows what it is undoing.** "Undo move q0" rather than "Undo".
 * - **Coalescing.** A drag emits one command per pointer frame; without a coalescing key,
 *   dragging a state across the canvas would cost 200 undo steps to reverse.
 * - **Testability.** A command is a pure `EditorDocument → EditorDocument`, so the whole
 *   edit surface is testable without rendering anything.
 *
 * ## Why undo is a snapshot rather than an inverse command
 *
 * The obvious alternative is for each command to carry an inverse. That is more code, more
 * bug surface, and buys nothing here: documents are immutable, so an edit returns a new
 * object *sharing every unchanged substructure*. A snapshot is therefore a pointer plus the
 * spine that actually changed — not a copy of the machine — and at teaching sizes the whole
 * history costs less than one screenshot.
 *
 * The reason to model commands is naming and coalescing. Memory was never the reason, so
 * paying for hand-written inverses would be paying for the wrong thing. (Collaborative
 * editing would change this, and is excluded from v1 by roadmap §1.4.)
 */

import type { Point, StateId } from '@/model/automaton';
import {
  hasTransition,
  labelTaken,
  mapState,
  nextStateId,
  nextStateLabel,
  withAutomaton,
  type EditorDocument,
} from '@/store/document';

/** What a command is doing, used for the undo label and for coalescing. */
export type CommandKind =
  | 'add-state'
  | 'delete-state'
  | 'move-state'
  | 'rename-state'
  | 'toggle-accepting'
  | 'set-start'
  | 'add-transition'
  | 'delete-transition'
  | 'add-symbol'
  | 'delete-symbol';

/** One edit. */
export interface Command {
  readonly kind: CommandKind;
  /** Shown in the UI: "Undo move q0". */
  readonly label: string;
  /**
   * Commands sharing a key, run close together, collapse into one undo entry.
   *
   * Undefined means never coalesce. Dragging uses `move-state:3`, so dragging one state
   * coalesces while dragging two different ones does not.
   */
  readonly coalesceKey?: string;
  /** Pure. Returns the document unchanged if there is nothing to do. */
  apply(document: EditorDocument): EditorDocument;
}

/**
 * Several commands as one undo entry.
 *
 * Needed the moment more than one state can be selected. Dragging three states emits three
 * moves *per pointer frame*, and without this each one is its own history entry — undoing a
 * drag of a group would take dozens of presses and would take the group apart state by state
 * on the way back, which is not a thing the user ever did.
 *
 * The coalesce key is built from the parts', so dragging the same group keeps coalescing and
 * dragging a *different* group starts a new entry. A batch of commands that cannot all
 * coalesce does not coalesce at all, which is the safe direction: an extra undo press is a
 * small cost, and merging two edits that should have stayed separate loses work.
 */
export function batch(kind: CommandKind, label: string, parts: readonly Command[]): Command {
  const keys = parts.map((part) => part.coalesceKey);
  const coalesceKey = keys.every((key) => key !== undefined)
    ? `batch:${keys.join('|')}`
    : undefined;

  return {
    kind,
    label,
    coalesceKey,
    apply(document) {
      // Returns the same object when every part was a no-op, which is the contract history.ts
      // relies on to keep a do-nothing edit out of the undo stack.
      return parts.reduce((current, part) => part.apply(current), document);
    },
  };
}

/** Add a state at a point on the canvas. */
export function addState(at: Point, label?: string): Command {
  return {
    kind: 'add-state',
    label: 'add state',
    apply(document) {
      const id = nextStateId(document.automaton);
      const name = label ?? nextStateLabel(document.automaton);
      const isFirst = document.automaton.states.length === 0;

      return {
        ...document,
        automaton: {
          ...document.automaton,
          states: [...document.automaton.states, { id, label: name }],
          // The first state placed becomes the start state. A machine with no start is
          // invalid, and making someone set it explicitly is a step with one sensible
          // answer.
          start: isFirst ? id : document.automaton.start,
        },
        layout: { ...document.layout, [id]: at },
      };
    },
  };
}

/** Remove a state, and every transition touching it. */
export function deleteState(id: StateId): Command {
  return {
    kind: 'delete-state',
    label: 'delete state',
    apply(document) {
      const remaining = document.automaton.states.filter((state) => state.id !== id);
      if (remaining.length === document.automaton.states.length) return document;

      const layout = { ...document.layout };
      delete layout[id];

      return {
        ...document,
        automaton: {
          ...document.automaton,
          states: remaining,
          // Transitions to a deleted state would dangle, and validate() would rightly
          // report the document as malformed.
          transitions: document.automaton.transitions.filter(
            (transition) => transition.from !== id && transition.to !== id,
          ),
          // Deleting the start state hands the role to whatever is left, rather than
          // leaving the document invalid. Undo restores both.
          start:
            document.automaton.start === id
              ? (remaining[0]?.id ?? 0)
              : document.automaton.start,
        },
        layout,
      };
    },
  };
}

/** Move a state. Coalesces per state, so one drag is one undo entry. */
export function moveState(id: StateId, to: Point): Command {
  return {
    kind: 'move-state',
    label: 'move state',
    coalesceKey: `move-state:${id}`,
    apply(document) {
      // A click that does not move the state must not cost an undo press.
      const current = document.layout[id];
      if (current?.x === to.x && current.y === to.y) return document;
      return { ...document, layout: { ...document.layout, [id]: to } };
    },
  };
}

/** Move several states as one edit — a multi-drag, or an arrow-key nudge of a selection. */
export function moveStates(moves: readonly { id: StateId; to: Point }[]): Command {
  return batch(
    'move-state',
    moves.length === 1 ? 'move state' : `move ${moves.length} states`,
    moves.map((move) => moveState(move.id, move.to)),
  );
}

/** Delete several states as one edit, so `Delete` on a selection is one undo press. */
export function deleteStates(ids: readonly StateId[]): Command {
  return batch(
    'delete-state',
    ids.length === 1 ? 'delete state' : `delete ${ids.length} states`,
    ids.map(deleteState),
  );
}

/** Rename a state. Coalesces per state, so typing a label is one undo entry. */
export function renameState(id: StateId, label: string): Command {
  return {
    kind: 'rename-state',
    label: 'rename state',
    coalesceKey: `rename-state:${id}`,
    apply(document) {
      const state = document.automaton.states.find((candidate) => candidate.id === id);
      // Committing an inline edit without changing the text is not an edit.
      if (!state || state.label === label) return document;

      // Two states called `q1` make a diagram that cannot be read and a TikZ export that
      // cannot be compiled. Refused rather than silently disambiguated: a name the user did
      // not choose appearing on their diagram is worse than a rename that did not take, and
      // the editor warns before they commit.
      if (label.length === 0 || labelTaken(document.automaton, label, id)) return document;

      return withAutomaton(
        document,
        mapState(document.automaton, id, (existing) => ({ ...existing, label })),
      );
    },
  };
}

/** Make a state accepting, or stop it being one. */
export function toggleAccepting(id: StateId): Command {
  return {
    kind: 'toggle-accepting',
    label: 'toggle accepting',
    apply(document) {
      if (!document.automaton.states.some((state) => state.id === id)) return document;
      return withAutomaton(
        document,
        mapState(document.automaton, id, (state) => ({
          ...state,
          accepting: !(state.accepting ?? false),
        })),
      );
    },
  };
}

/** Make a state the start state. */
export function setStart(id: StateId): Command {
  return {
    kind: 'set-start',
    label: 'set start state',
    apply(document) {
      // Unchanged when the state does not exist, and when it is already the start —
      // the second was a real bug the reversibility tests caught.
      if (document.automaton.start === id) return document;
      if (!document.automaton.states.some((state) => state.id === id)) return document;
      return withAutomaton(document, { ...document.automaton, start: id });
    },
  };
}

/**
 * Add a transition, extending the alphabet if the symbol is new.
 *
 * Extending Σ rather than rejecting the edit: a student drawing a machine types the symbol
 * they mean, and being told "that symbol is not in the alphabet" before they have declared
 * one is a rule enforced for its own sake.
 */
export function addTransition(from: StateId, to: StateId, on?: string): Command {
  return {
    kind: 'add-transition',
    label: 'add transition',
    apply(document) {
      if (hasTransition(document.automaton, from, to, on)) return document;

      const alphabet =
        on !== undefined && !document.automaton.alphabet.includes(on)
          ? [...document.automaton.alphabet, on]
          : document.automaton.alphabet;

      return withAutomaton(document, {
        ...document.automaton,
        alphabet,
        transitions: [...document.automaton.transitions, { from, to, on }],
      });
    },
  };
}

/** Remove one transition. */
export function deleteTransition(from: StateId, to: StateId, on?: string): Command {
  return {
    kind: 'delete-transition',
    label: 'delete transition',
    apply(document) {
      const transitions = document.automaton.transitions.filter(
        (transition) =>
          !(transition.from === from && transition.to === to && transition.on === on),
      );
      if (transitions.length === document.automaton.transitions.length) return document;
      return withAutomaton(document, { ...document.automaton, transitions });
    },
  };
}

/**
 * Replace every symbol on one edge.
 *
 * One command rather than a delete followed by an add, because the two halves are never
 * separately meaningful: an edge briefly carrying no symbols is not a state of the document
 * anyone asked for, and undo landing there would be baffling. Editing a label is one edit.
 */
export function setEdgeSymbols(
  from: StateId,
  to: StateId,
  symbols: readonly (string | undefined)[],
): Command {
  return {
    kind: 'add-transition',
    label: 'edit transition',
    apply(document) {
      const existing = document.automaton.transitions.filter(
        (transition) => transition.from === from && transition.to === to,
      );

      const wanted = symbols.map((on) => ({ from, to, on }));
      const unchanged =
        existing.length === wanted.length &&
        existing.every((transition, index) => transition.on === wanted[index]?.on);
      if (unchanged) return document;

      // The edge keeps its position in the transition list rather than jumping to the end.
      // Order is what makes traces reproducible (Phase 1 A2), so an edit that reshuffles it
      // would change the order steps are reported in for reasons the user cannot see.
      const first = document.automaton.transitions.findIndex(
        (transition) => transition.from === from && transition.to === to,
      );
      const rest = document.automaton.transitions.filter(
        (transition) => !(transition.from === from && transition.to === to),
      );
      const at = first === -1 ? rest.length : Math.min(first, rest.length);

      const added = symbols.filter(
        (symbol): symbol is string =>
          symbol !== undefined && !document.automaton.alphabet.includes(symbol),
      );

      return withAutomaton(document, {
        ...document.automaton,
        alphabet:
          added.length > 0
            ? [...document.automaton.alphabet, ...added]
            : document.automaton.alphabet,
        transitions: [...rest.slice(0, at), ...wanted, ...rest.slice(at)],
      });
    },
  };
}

/**
 * Remove an edge entirely — every transition between one ordered pair of states.
 *
 * The drawn edge is the unit people point at: `q0 → q1` labelled `a, b, c` is one arrow on
 * screen, so "delete this" means all three. Deleting only one of the three would leave the
 * arrow looking untouched while the machine had quietly changed.
 */
export function deleteEdge(from: StateId, to: StateId): Command {
  return {
    kind: 'delete-transition',
    label: 'delete transition',
    apply(document) {
      const transitions = document.automaton.transitions.filter(
        (transition) => !(transition.from === from && transition.to === to),
      );
      if (transitions.length === document.automaton.transitions.length) return document;
      return withAutomaton(document, { ...document.automaton, transitions });
    },
  };
}

/** Add a symbol to the alphabet. */
export function addSymbol(symbol: string): Command {
  return {
    kind: 'add-symbol',
    label: 'add symbol',
    apply(document) {
      if (document.automaton.alphabet.includes(symbol)) return document;
      return withAutomaton(document, {
        ...document.automaton,
        alphabet: [...document.automaton.alphabet, symbol],
      });
    },
  };
}

/**
 * Remove a symbol, and every transition that reads it.
 *
 * Removing the transitions too is the only coherent option: leaving them would make the
 * document malformed, and silently keeping a symbol the user asked to remove would be worse.
 * Because this is one command, undo restores the symbol and its transitions together.
 */
export function deleteSymbol(symbol: string): Command {
  return {
    kind: 'delete-symbol',
    label: 'delete symbol',
    apply(document) {
      if (!document.automaton.alphabet.includes(symbol)) return document;
      return withAutomaton(document, {
        ...document.automaton,
        alphabet: document.automaton.alphabet.filter((s) => s !== symbol),
        transitions: document.automaton.transitions.filter(
          (transition) => transition.on !== symbol,
        ),
      });
    },
  };
}
