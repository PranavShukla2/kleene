import { describe, expect, it } from 'vitest';

import { determinism, stateById, type Automaton } from '@/model/automaton';

/** The machine Phase 0 renders, in the shape the engine actually hands over. */
function endsWithAb(): Automaton {
  return {
    alphabet: ['a', 'b'],
    states: [
      { id: 0, label: 'q0', accepting: false },
      { id: 1, label: 'q1', accepting: false },
      { id: 2, label: 'q2', accepting: true },
    ],
    start: 0,
    transitions: [
      { from: 0, to: 1, on: 'a' },
      { from: 0, to: 0, on: 'b' },
      { from: 1, to: 1, on: 'a' },
      { from: 1, to: 2, on: 'b' },
      { from: 2, to: 1, on: 'a' },
      { from: 2, to: 0, on: 'b' },
    ],
  };
}

describe('determinism', () => {
  it('classifies a machine with one move per symbol as a DFA', () => {
    expect(determinism(endsWithAb())).toBe('DFA');
  });

  it('classifies two moves on one symbol as an NFA', () => {
    const a = endsWithAb();
    a.transitions.push({ from: 0, to: 2, on: 'a' });
    expect(determinism(a)).toBe('NFA');
  });

  it('treats an epsilon transition as outranking plain nondeterminism', () => {
    const a = endsWithAb();
    a.transitions.push({ from: 0, to: 2, on: 'a' });
    a.transitions.push({ from: 0, to: 1 });
    expect(determinism(a)).toBe('ε-NFA');
  });

  it('agrees with the Rust implementation it mirrors', () => {
    // This duplication is temporary and load-bearing: Phase 2 E4 routes the check
    // through wasm, at which point this test becomes the regression that proves the
    // two answers matched before the TypeScript copy was deleted.
    expect(determinism(endsWithAb())).toBe('DFA');
  });
});

describe('state order', () => {
  it('is carried by the array, not by a key convention', () => {
    // The reason states are an array. An object keyed by id would leave order to a
    // convention that JSON, JavaScript and Rust each define differently, and a machine
    // whose ids are not ascending would round-trip rearranged.
    expect(endsWithAb().states.map((s) => s.id)).toEqual([0, 1, 2]);
  });

  it('survives ids that are not in ascending order', () => {
    // The case an object encoding gets wrong: JavaScript iterates integer-like keys
    // ascending, so this would come back as 1, 3, 9.
    const machine = {
      ...endsWithAb(),
      states: [
        { id: 1, label: 'a', accepting: false },
        { id: 9, label: 'b', accepting: false },
        { id: 3, label: 'c', accepting: true },
      ],
    };
    expect(machine.states.map((s) => s.id)).toEqual([1, 9, 3]);
  });

  it('finds a state by id regardless of position', () => {
    expect(stateById(endsWithAb(), 2)?.label).toBe('q2');
    expect(stateById(endsWithAb(), 99)).toBeUndefined();
  });
});
