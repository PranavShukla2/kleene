import { describe, expect, it } from 'vitest';

import { allConcepts, CHAPTERS, conceptId } from '@/site/concepts';

describe('conceptId', () => {
  it('spells out the Greek rather than dropping it', () => {
    // Dropping it is what broke this: `ε-NFA` and `NFA` both became `nfa`, which is a
    // colliding anchor and — worse — a duplicate React key, which leaves rows from a previous
    // query stranded in the DOM where they are visible and unreachable.
    expect(conceptId('ε-NFA')).toBe('epsilon-nfa');
    expect(conceptId('NFA')).toBe('nfa');
    expect(conceptId('ε-closure')).toBe('epsilon-closure');
  });

  it('produces something usable as a URL fragment', () => {
    expect(conceptId('Thompson’s construction')).toBe('thompson-s-construction');
    expect(conceptId('The operators')).toBe('the-operators');
    for (const { concept } of allConcepts()) {
      expect(conceptId(concept.term)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe('the concept list', () => {
  it('gives every concept a distinct id', () => {
    // The invariant that makes deriving ids from prose safe. Without it, adding a term that
    // happens to slug like an existing one breaks the page silently.
    const ids = allConcepts().map(({ concept }) => conceptId(concept.term));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every chapter a distinct number', () => {
    const numbers = CHAPTERS.map((chapter) => chapter.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('says what the usual mistake is for every single concept', () => {
    // The field the page exists for. A concept without one is a definition, and definitions
    // are the part a reader can already get anywhere.
    for (const { concept } of allConcepts()) {
      expect(concept.mistake.length).toBeGreaterThan(40);
    }
  });
});
