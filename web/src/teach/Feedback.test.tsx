/**
 * The wording of failure feedback.
 *
 * Tested as strings rather than as a rendered component, because what matters here is not that
 * a box appears — it is *what it says*. B3's requirement is that a student is never told only
 * that they are wrong, and the way that regresses is someone shortening a sentence.
 */

import { describe, expect, it } from 'vitest';

import type { Failure } from '@/model/automaton';
import { explain } from '@/teach/explain';

describe('what a student is told', () => {
  it('names the string and the direction, for an over-accepting machine', () => {
    const said = explain({
      kind: 'wrong-language',
      input: 'aba',
      accepted_by_answer: true,
    });
    expect(said).toContain('aba');
    expect(said).toContain('accepts');
  });

  it('names the other direction differently', () => {
    // "Your machine accepts x and should not" and "rejects x and should not" are different
    // mistakes, and a student cannot tell which from the string alone.
    const said = explain({
      kind: 'wrong-language',
      input: 'aba',
      accepted_by_answer: false,
    });
    expect(said).toContain('rejects');
  });

  it('shows the empty string as ε rather than as nothing', () => {
    // The witness whenever one machine accepts ε and the other does not. Rendering it as an
    // empty gap makes a precise answer look like a missing one.
    expect(explain({ kind: 'wrong-language', input: '', accepted_by_answer: true })).toContain(
      'ε',
    );
  });

  it('says the language is right when only the budget is wrong', () => {
    // Being told "wrong" when the language is correct would send a student back to rebuild a
    // machine that already works.
    const said = explain({ kind: 'over-budget', used: 5, limit: 4 });
    expect(said).toMatch(/language is right/i);
    expect(said).toContain('5');
    expect(said).toContain('4');
  });

  it('tells a student a broken link is not their fault', () => {
    const said = explain({ kind: 'bad-problem', detail: 'the target does not parse' });
    expect(said).toMatch(/not something you did/i);
  });

  it('never says only that the answer is wrong', () => {
    // The property the whole file exists for. Every failure carries something to act on.
    const failures: Failure[] = [
      { kind: 'wrong-language', input: 'ab', accepted_by_answer: true },
      { kind: 'wrong-language', input: '', accepted_by_answer: false },
      { kind: 'over-budget', used: 5, limit: 4 },
      { kind: 'wrong-alphabet', expected: ['a', 'b'], found: ['a', 'b', 'c'] },
      { kind: 'bad-problem', detail: 'nope' },
    ];

    for (const failure of failures) {
      const said = explain(failure);
      expect(said.length).toBeGreaterThan(40);
      expect(said.toLowerCase()).not.toBe('incorrect');
    }
  });
});
