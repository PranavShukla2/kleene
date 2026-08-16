/**
 * Undo and redo, as a pure reducer.
 *
 * Deliberately free of React and of zustand. Undo is the part of an editor most likely to be
 * subtly wrong — coalescing windows, redo invalidation, no-op edits — and none of that is
 * easier to reason about with a component tree attached. The store in `editor.ts` is a thin
 * wrapper over these functions.
 */

import type { Command } from '@/store/commands';
import type { EditorDocument } from '@/store/document';

/**
 * How long after a command another with the same key still coalesces.
 *
 * 400ms is chosen against human input rather than frame rate: a drag emits a command per
 * pointer frame, so any window above a frame interval collapses the whole gesture, while a
 * deliberate second edit takes longer than this to initiate.
 */
export const COALESCE_WINDOW_MS = 400;

/** One reversible step. */
export interface HistoryEntry {
  /** The document as it was *before* the command ran. */
  before: EditorDocument;
  /** What the command was, for the undo label and for coalescing. */
  command: Command;
  /** When it ran, for the coalescing window. */
  at: number;
}

/** A document plus the steps taken to reach it. */
export interface History {
  present: EditorDocument;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

/** Start a history from a document. */
export function historyOf(document: EditorDocument): History {
  return { present: document, past: [], future: [] };
}

/**
 * Run a command.
 *
 * Three behaviours worth stating, because each is a decision rather than an accident:
 *
 * - **A command that changes nothing is not recorded.** Clicking "set start" on the state
 *   that is already the start should not cost an undo press.
 * - **Redo is discarded on a new edit.** Once history branches, the future is unreachable,
 *   and keeping it would let undo walk into a document the user never had.
 * - **Coalescing keeps the *earliest* snapshot.** Undoing a drag must return to where the
 *   state started, not to the previous pointer frame.
 */
export function run(history: History, command: Command, now = Date.now()): History {
  const next = command.apply(history.present);

  // Reference equality is enough because every command returns the same object when it has
  // nothing to do — that is the contract in commands.ts, not an optimisation.
  if (next === history.present) return history;

  const previous = history.past.at(-1);
  const coalesces =
    command.coalesceKey !== undefined &&
    previous?.command.coalesceKey === command.coalesceKey &&
    now - previous.at <= COALESCE_WINDOW_MS;

  const past = coalesces
    ? [...history.past.slice(0, -1), { ...previous, command, at: now }]
    : [...history.past, { before: history.present, command, at: now }];

  return { present: next, past, future: [] };
}

/** Whether there is anything to undo. */
export function canUndo(history: History): boolean {
  return history.past.length > 0;
}

/** Whether there is anything to redo. */
export function canRedo(history: History): boolean {
  return history.future.length > 0;
}

/** Step back one entry. */
export function undo(history: History): History {
  const entry = history.past.at(-1);
  if (!entry) return history;

  return {
    present: entry.before,
    past: history.past.slice(0, -1),
    // The entry carries the document that produced `present`, so redo can replay it
    // without re-running the command against a document it was not built for.
    future: [{ ...entry, before: history.present }, ...history.future],
  };
}

/** Step forward one entry. */
export function redo(history: History): History {
  const [entry, ...rest] = history.future;
  if (!entry) return history;

  return {
    present: entry.before,
    past: [...history.past, { ...entry, before: history.present }],
    future: rest,
  };
}

/** What the next undo would reverse: "move state", or undefined if there is nothing. */
export function undoLabel(history: History): string | undefined {
  return history.past.at(-1)?.command.label;
}

/** What the next redo would repeat. */
export function redoLabel(history: History): string | undefined {
  return history.future[0]?.command.label;
}
