/**
 * Progress, and the two rules that matter about it.
 *
 * It lives in `localStorage` and there is no server behind it, so the failure modes are: it
 * gets lost, or it gets *wrongly reduced*. The second is worse, because a student watching a
 * solved problem become unsolved learns not to experiment.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearProgress,
  exportProgress,
  importProgress,
  readProgress,
  record,
  tally,
} from '@/teach/progress';

beforeEach(() => {
  localStorage.clear();
});

describe('recording an attempt', () => {
  it('remembers that a problem was solved', () => {
    record('even-as', { solved: true, withinBudget: true, states: 2 });
    expect(readProgress()['even-as']?.solved).toBe(true);
  });

  it('remembers an attempt that failed', () => {
    record('even-as', { solved: false, withinBudget: false, states: 5 });
    const attempt = readProgress()['even-as'];
    expect(attempt?.attempted).toBe(true);
    expect(attempt?.solved).toBe(false);
  });

  it('never un-solves a problem', () => {
    // The rule this file exists for. A student who solves something and keeps experimenting
    // has not un-learned it, and watching a tick vanish is a reason to stop experimenting.
    record('even-as', { solved: true, withinBudget: true, states: 2 });
    record('even-as', { solved: false, withinBudget: false, states: 9 });
    expect(readProgress()['even-as']?.solved).toBe(true);
  });

  it('keeps the smallest machine, not the latest', () => {
    record('even-as', { solved: true, withinBudget: true, states: 4 });
    record('even-as', { solved: true, withinBudget: true, states: 2 });
    record('even-as', { solved: true, withinBudget: true, states: 6 });
    expect(readProgress()['even-as']?.best).toBe(2);
  });
});

describe('what is deliberately absent', () => {
  it('records nothing that could become a streak or a score', () => {
    // C4 and roadmap §9.2. A streak measures showing up rather than understanding, and it
    // punishes the student who took a week off because they were struggling.
    record('even-as', { solved: true, withinBudget: true, states: 2 });
    const attempt = readProgress()['even-as'];
    const fields = Object.keys(attempt ?? {}).sort();
    expect(fields).toEqual(['attempted', 'best', 'solved', 'withinBudget']);
  });
});

describe('surviving storage that is not co-operating', () => {
  it('starts empty rather than throwing on corrupt JSON', () => {
    localStorage.setItem('kleene.progress', '{not json');
    expect(readProgress()).toEqual({});
  });

  it('drops a malformed entry without losing the others', () => {
    // One key, editable from any console, read on every page load. A single bad record must
    // not take the list view down with it.
    localStorage.setItem(
      'kleene.progress',
      JSON.stringify({ good: { solved: true }, bad: 'not an object' }),
    );
    const progress = readProgress();
    expect(progress.good?.solved).toBe(true);
    expect(progress.bad).toBeUndefined();
  });
});

describe('export and import', () => {
  it('round-trips', () => {
    record('even-as', { solved: true, withinBudget: true, states: 2 });
    const file = exportProgress();
    clearProgress();
    importProgress(file);
    expect(readProgress()['even-as']?.solved).toBe(true);
  });

  it('merges rather than replacing', () => {
    // The realistic import is "I moved to another machine", not "erase today".
    record('even-as', { solved: true, withinBudget: true, states: 2 });
    const fromOverThere = exportProgress({
      'ends-with-ab': { attempted: true, solved: true, withinBudget: true },
    });
    importProgress(fromOverThere);

    const progress = readProgress();
    expect(progress['even-as']?.solved).toBe(true);
    expect(progress['ends-with-ab']?.solved).toBe(true);
  });

  it('cannot lose a solved problem to an older export', () => {
    // The union is the only merge with that property, which is why it is the merge.
    record('even-as', { solved: true, withinBudget: true, states: 2 });
    importProgress(
      exportProgress({ 'even-as': { attempted: true, solved: false, withinBudget: false } }),
    );
    expect(readProgress()['even-as']?.solved).toBe(true);
  });

  it('refuses a file that is not progress', () => {
    expect(importProgress(JSON.stringify({ kind: 'something-else' }))).toBeUndefined();
    expect(importProgress('nonsense')).toBeUndefined();
  });
});

describe('how far through the set someone is', () => {
  it('counts solved and attempted separately', () => {
    record('a', { solved: true, withinBudget: true, states: 2 });
    record('b', { solved: false, withinBudget: false, states: 3 });
    expect(tally(readProgress(), ['a', 'b', 'c'])).toEqual({
      solved: 1,
      attempted: 2,
      total: 3,
    });
  });
});
