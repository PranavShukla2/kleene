/**
 * The results CSV.
 *
 * The property that matters is not the shape of one row — it is that this file and
 * `kleene grade` produce the *same* shape. A lecturer may mark either way, and if the two
 * disagree then whichever one gets automated against becomes the real format and the other is
 * quietly wrong.
 */

import { describe, expect, it } from 'vitest';

import { asCsv, csvName } from '@/classroom/csv';
import type { Standing } from '@/classroom/api';

const student = (over: Partial<Standing> = {}): Standing => ({
  studentId: 'x',
  displayName: 'Ada Lovelace',
  email: 'ada@example.test',
  attempts: 1,
  solved: true,
  ...over,
});

describe('the header', () => {
  it('is the one `kleene grade` writes, verbatim', () => {
    // Copied rather than chosen. Two paths to one spreadsheet must not differ.
    expect(asCsv([]).split('\n')[0]).toBe('file,verdict,counterexample,direction,states');
  });
});

describe('rows', () => {
  it('records a solved student with their smallest machine', () => {
    const csv = asCsv([student({ bestStates: 2 })]);
    expect(csv).toContain('Ada Lovelace,correct,,,2');
  });

  it('carries the counterexample for a wrong answer', () => {
    // The column that turns a grade into feedback, and the reason a lecturer would hand this
    // back rather than a mark.
    const csv = asCsv([student({ solved: false, lastFailure: 'baabb' })]);
    expect(csv).toContain('baabb');
    expect(csv).toContain('wrong');
  });

  it('distinguishes not-submitted from wrong', () => {
    // A student who has not tried is not a student who got it wrong, and a lecturer chasing
    // the first group needs them separable.
    const csv = asCsv([student({ solved: false, attempts: 0 })]);
    expect(csv).toContain('not submitted');
  });

  it('quotes a name with a comma in it', () => {
    // Half a roster is written "Doe, Jane". A display name is far likelier to contain a comma
    // than a filename is, which is why the CLI's rule is copied rather than skipped.
    expect(asCsv([student({ displayName: 'Doe, Jane' })])).toContain('"Doe, Jane"');
  });

  it('escapes a quote inside a name', () => {
    expect(asCsv([student({ displayName: 'Ada "Countess" Lovelace' })])).toContain(
      '"Ada ""Countess"" Lovelace"',
    );
  });

  it('sorts by name, so two exports can be diffed', () => {
    // Re-exporting after a late submission is the second thing anyone does.
    const csv = asCsv([
      student({ studentId: 'b', displayName: 'Zoe' }),
      student({ studentId: 'a', displayName: 'Ada' }),
    ]);
    const names = csv
      .split('\n')
      .slice(1)
      .filter(Boolean)
      .map((line) => line.split(',')[0]);
    expect(names).toEqual(['Ada', 'Zoe']);
  });

  it('leaves a witness column empty for a correct answer, not "none"', () => {
    // An empty cell means "nothing to say"; a word there would read as data.
    const [, row] = asCsv([student({ bestStates: 3 })]).split('\n');
    expect(row?.split(',')[2]).toBe('');
  });
});

describe('the filename', () => {
  it('is derived from the assignment title', () => {
    expect(csvName('Week 3 — parity')).toBe('week-3-parity.csv');
  });

  it('falls back rather than producing a dotfile', () => {
    // A title of only punctuation would otherwise slug to nothing and write `.csv`, which is
    // invisible in a downloads folder on every platform that matters.
    expect(csvName('—')).toBe('results.csv');
  });
});
