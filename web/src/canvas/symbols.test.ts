import { describe, expect, it } from 'vitest';

import { EPSILON, formatSymbols, newSymbols, parseSymbols } from '@/canvas/symbols';

describe('parseSymbols', () => {
  it('accepts the three ways people actually type a list', () => {
    // Someone typing quickly produces all three. Rejecting two of them teaches a syntax
    // instead of accepting an obvious intent.
    expect(parseSymbols('a,b')).toEqual(['a', 'b']);
    expect(parseSymbols('a, b')).toEqual(['a', 'b']);
    expect(parseSymbols('a b')).toEqual(['a', 'b']);
  });

  it('ignores stray whitespace and trailing separators', () => {
    expect(parseSymbols('  a ,  b ,  ')).toEqual(['a', 'b']);
  });

  it('reads an epsilon as the absence of a symbol', () => {
    // So nothing downstream has to know that ε is a spelling rather than a symbol — and a
    // machine cannot acquire a literal `ε` that behaves like a letter and prints like one.
    expect(parseSymbols(EPSILON)).toEqual([undefined]);
  });

  it('treats an empty label as an epsilon transition, not as no transition', () => {
    // Clearing the symbols of an edge must not silently delete the edge. A gesture that
    // removes more than it appears to is how work gets lost.
    expect(parseSymbols('')).toEqual([undefined]);
    expect(parseSymbols('   ')).toEqual([undefined]);
  });

  it('collapses duplicates, including duplicate epsilons', () => {
    expect(parseSymbols('a, a, b')).toEqual(['a', 'b']);
    expect(parseSymbols(`${EPSILON}, ${EPSILON}`)).toEqual([undefined]);
  });

  it('keeps the order as typed', () => {
    // Sorting happens at render time in groupEdges, so what is stored stays what was meant.
    expect(parseSymbols('c, a, b')).toEqual(['c', 'a', 'b']);
  });

  it('accepts multi-character symbols', () => {
    expect(parseSymbols('ab, 10')).toEqual(['ab', '10']);
  });
});

describe('formatSymbols', () => {
  it('round-trips a parsed label', () => {
    for (const text of ['a', 'a, b', 'a, b, c', EPSILON]) {
      expect(formatSymbols(parseSymbols(text))).toBe(text);
    }
  });

  it('shows an absent symbol as an epsilon', () => {
    expect(formatSymbols([undefined])).toBe(EPSILON);
    expect(formatSymbols(['a', undefined])).toBe(`a, ${EPSILON}`);
  });
});

describe('newSymbols', () => {
  it('reports only what is not already in the alphabet', () => {
    expect(newSymbols(['a', 'c'], ['a', 'b'])).toEqual(['c']);
  });

  it('never reports epsilon, which is not a symbol', () => {
    expect(newSymbols([undefined], ['a'])).toEqual([]);
  });

  it('is empty when nothing is new, so the hint stays quiet', () => {
    expect(newSymbols(['a', 'b'], ['a', 'b'])).toEqual([]);
  });
});
