/**
 * Emptying the canvas.
 *
 * The behaviour worth pinning down is not "the states are gone" — it is what *survives*, and
 * that one press of undo brings the machine back. Both are what make it safe to offer the
 * action without a confirmation dialog.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { clearCanvas } from '@/store/commands';
import { normalize } from '@/store/document';
import { useEditor } from '@/store/editor';

function machine() {
  useEditor.getState().load(
    normalize({
      automaton: {
        alphabet: ['a', 'b'],
        start: 0,
        states: [
          { id: 0, label: 'q0' },
          { id: 1, label: 'q1', accepting: true },
        ],
        transitions: [
          { from: 0, to: 1, on: 'a' },
          { from: 1, to: 0, on: 'b' },
        ],
      },
      layout: { 0: { x: 0, y: 0 }, 1: { x: 100, y: 0 } },
    }),
  );
}

// The document lives in the history's `present`, which is what undo moves.
const now = () => useEditor.getState().history.present;
const ids = () => now().automaton.states.map((state) => state.id);

describe('clearing the canvas', () => {
  beforeEach(machine);

  it('removes every state', () => {
    useEditor.getState().run(clearCanvas(ids()));
    expect(now().automaton.states).toEqual([]);
  });

  it('takes the transitions with them', () => {
    // Not a separate step — a transition to a state that no longer exists would dangle, and
    // `validate()` would rightly call the document malformed.
    useEditor.getState().run(clearCanvas(ids()));
    expect(now().automaton.transitions).toEqual([]);
  });

  it('empties the layout too', () => {
    // A stale coordinate for a deleted state is invisible until the id is reused, at which
    // point a new state appears somewhere nobody put it.
    useEditor.getState().run(clearCanvas(ids()));
    expect(Object.keys(now().layout)).toEqual([]);
  });

  it('leaves the alphabet alone', () => {
    // Σ is part of the machine's definition, not something drawn on the canvas. Someone
    // clearing the diagram to draw a different automaton over the same symbols should not
    // have to retype them.
    useEditor.getState().run(clearCanvas(ids()));
    expect(now().automaton.alphabet).toEqual(['a', 'b']);
  });

  it('is one press of undo, not one per state', () => {
    // What makes offering this without a confirmation dialog reasonable. If clearing four
    // states cost four undos, the mis-click would be expensive and the dialog necessary.
    useEditor.getState().run(clearCanvas(ids()));
    useEditor.getState().undo();

    expect(now().automaton.states).toHaveLength(2);
    expect(now().automaton.transitions).toHaveLength(2);
    expect(now().layout).toEqual({ 0: { x: 0, y: 0 }, 1: { x: 100, y: 0 } });
  });

  it('restores which state was accepting, and which was the start', () => {
    useEditor.getState().run(clearCanvas(ids()));
    useEditor.getState().undo();

    expect(now().automaton.start).toBe(0);
    expect(now().automaton.states.find((state) => state.id === 1)?.accepting).toBe(true);
  });

  it('does nothing to an already empty canvas', () => {
    useEditor.getState().run(clearCanvas(ids()));
    const before = now();
    useEditor.getState().run(clearCanvas([]));
    expect(now()).toEqual(before);
  });
});
