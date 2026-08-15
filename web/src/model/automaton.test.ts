import { describe, expect, it } from 'vitest';

import { determinism, type Automaton } from '@/model/automaton';

/** The machine Phase 0 renders, in the shape the engine actually hands over. */
function endsWithAb(): Automaton {
  return {
    alphabet: ['a', 'b'],
    states: new Map([
      [0, { label: 'q0', accepting: false }],
      [1, { label: 'q1', accepting: false }],
      [2, { label: 'q2', accepting: true }],
    ]),
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

describe('state map', () => {
  it('preserves insertion order, which traces depend on', () => {
    // A plain object would reorder integer-like keys and silently lose this.
    const ids = [...endsWithAb().states.keys()];
    expect(ids).toEqual([0, 1, 2]);
  });
});
