/**
 * The editor's state.
 *
 * Deliberately thin. All the logic worth testing lives in `history.ts` and `commands.ts`,
 * which know nothing about React or zustand — this only holds a `History` and exposes it.
 *
 * ## Selectors, not one big subscription
 *
 * Components subscribe to the narrowest slice they need. Dragging a state changes `layout`
 * and nothing else, and a component reading only `automaton` must not re-render for it —
 * that is the difference between a canvas that stays at 60fps while dragging a 60-state
 * machine (Track B's measured floor) and one that does not.
 */

import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { Automaton, StateId } from '@/model/automaton';
import type { Command } from '@/store/commands';
import { emptyDocument, type EditorDocument } from '@/store/document';
import {
  canRedo,
  canUndo,
  historyOf,
  redo,
  redoLabel,
  run,
  undo,
  undoLabel,
  type History,
} from '@/store/history';

interface EditorState {
  history: History;
  /** Which states are selected, in selection order. */
  selection: StateId[];

  /** Run an edit. */
  run: (command: Command) => void;
  /** Step back. */
  undo: () => void;
  /** Step forward. */
  redo: () => void;
  /** Replace the document entirely — loading a file, or an example. */
  load: (document: EditorDocument) => void;
  /** Replace the selection. */
  select: (ids: StateId[]) => void;
}

export const useEditor = create<EditorState>((set) => ({
  history: historyOf(emptyDocument()),
  selection: [],

  run: (command) => set((state) => ({ history: run(state.history, command) })),
  undo: () => set((state) => ({ history: undo(state.history) })),
  redo: () => set((state) => ({ history: redo(state.history) })),

  // Loading starts a fresh history rather than appending. Undoing across a file open would
  // resurrect a document the user deliberately replaced.
  load: (document) => set({ history: historyOf(document), selection: [] }),

  select: (ids) => set({ selection: ids }),
}));

/** The document as it stands. */
export const useDocument = (): EditorDocument => useEditor((s) => s.history.present);

/** Just the machine — does not re-render when only the layout moves. */
export const useAutomaton = (): Automaton => useEditor((s) => s.history.present.automaton);

/** Just the layout — does not re-render when only the machine changes. */
export const useLayout = (): EditorDocument['layout'] =>
  useEditor((s) => s.history.present.layout);

/** What undo and redo would do, for enabling buttons and labelling them. */
export function useUndoState() {
  return useEditor(
    useShallow((s) => ({
      canUndo: canUndo(s.history),
      canRedo: canRedo(s.history),
      undoLabel: undoLabel(s.history),
      redoLabel: redoLabel(s.history),
    })),
  );
}

/** The editing actions. Stable across renders, so they never cause one. */
export function useActions() {
  return useEditor(
    useShallow((s) => ({
      run: s.run,
      undo: s.undo,
      redo: s.redo,
      load: s.load,
      select: s.select,
    })),
  );
}
