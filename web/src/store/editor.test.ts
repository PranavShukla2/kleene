import { beforeEach, describe, expect, it } from 'vitest';

import { addState, deleteStates, renameState } from '@/store/commands';
import { normalize } from '@/store/document';
import { useEditor } from '@/store/editor';

/** A three-state machine to select from. */
function threeStates() {
  const store = useEditor.getState();
  store.load(
    normalize({
      automaton: {
        alphabet: ['a'],
        start: 0,
        states: [
          { id: 0, label: 'q0' },
          { id: 1, label: 'q1' },
          { id: 2, label: 'q2' },
        ],
        transitions: [],
      },
      layout: { 0: { x: 0, y: 0 }, 1: { x: 100, y: 0 }, 2: { x: 200, y: 0 } },
    }),
  );
}

describe('the selection after an edit', () => {
  beforeEach(threeStates);

  it('drops states the edit deleted', () => {
    // The bug this exists for: deleting three states left "3 states selected" in the panel
    // and "3 selected" in the status bar beside "0 states", and every action afterwards was
    // aimed at states that no longer existed.
    useEditor.getState().select([0, 1, 2]);
    useEditor.getState().run(deleteStates([0, 1, 2]));

    expect(useEditor.getState().selection).toEqual([]);
  });

  it('keeps the states the edit left alone', () => {
    useEditor.getState().select([0, 1, 2]);
    useEditor.getState().run(deleteStates([1]));

    expect(useEditor.getState().selection).toEqual([0, 2]);
  });

  it('drops a state that undo removed', () => {
    // Undoing an *add* removes a state, which no amount of inspecting the command would
    // reveal — which is why the pruning happens after every transition rather than inside
    // the delete path.
    useEditor.getState().run(addState({ x: 300, y: 0 }));
    const added = useEditor.getState().history.present.automaton.states.at(-1);
    expect(added).toBeDefined();

    useEditor.getState().select([added?.id ?? -1]);
    useEditor.getState().undo();

    expect(useEditor.getState().selection).toEqual([]);
  });

  it('keeps the same array when nothing was pruned', () => {
    // Not an optimisation. Zustand compares by reference, so a fresh array here would
    // re-render every selection subscriber on every keystroke of a rename.
    useEditor.getState().select([0, 1]);
    const before = useEditor.getState().selection;

    useEditor.getState().run(renameState(0, 'start'));

    expect(useEditor.getState().selection).toBe(before);
  });
});
