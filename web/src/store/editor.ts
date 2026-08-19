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
  /** Select every state in the document. */
  selectAll: () => void;
}

export const useEditor = create<EditorState>((set) => ({
  history: historyOf(emptyDocument()),
  selection: [],

  // Every one of these prunes the selection, for the reason spelled out on `selectAll`: a
  // selection holding an id that no longer exists is this module's one real hazard. Deleting
  // three states used to leave "3 states selected" in the panel and "3 selected" in the status
  // bar next to "0 states" — and every subsequent action was aimed at states that were gone.
  run: (command) => set((state) => after(run(state.history, command), state.selection)),
  undo: () => set((state) => after(undo(state.history), state.selection)),
  redo: () => set((state) => after(redo(state.history), state.selection)),

  // Loading starts a fresh history rather than appending. Undoing across a file open would
  // resurrect a document the user deliberately replaced.
  load: (document) => set({ history: historyOf(document), selection: [] }),

  select: (ids) => set({ selection: ids }),

  // Reads the document rather than taking a list, so no caller can select an id that is not
  // there. A selection referring to a deleted state is the bug this whole module avoids by
  // holding ids, and it would be a shame to reintroduce it through the convenient path.
  selectAll: () =>
    set((state) => ({ selection: state.history.present.automaton.states.map((s) => s.id) })),
}));

/**
 * A history transition, with the selection narrowed to states that still exist.
 *
 * Applied on the way *out* of every transition rather than checked on the way in, because
 * every path that can remove a state — a command, an undo of an add, a redo of a delete — has
 * to be covered, and the command alone does not say which of them did.
 *
 * The identity check is not an optimisation. Zustand compares by reference, so returning a
 * fresh array when nothing was pruned would re-render every selection subscriber on every
 * keystroke of a rename — which is exactly the per-slice subscription this module's header
 * says it exists to protect.
 */
function after(history: History, selection: StateId[]): Partial<EditorState> {
  const alive = history.present.automaton.states;
  const kept = selection.filter((id) => alive.some((state) => state.id === id));
  return kept.length === selection.length ? { history } : { history, selection: kept };
}

/** The selected state ids. */
export const useSelection = (): StateId[] => useEditor((s) => s.selection);

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
      selectAll: s.selectAll,
    })),
  );
}
