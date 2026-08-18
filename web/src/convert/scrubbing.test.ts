import { describe, expect, it } from 'vitest';

import {
  clampStep,
  highlighted,
  nextStep,
  position,
  readStepFrom,
  stepFragment,
} from '@/convert/scrubbing';
import type { Step } from '@/model/automaton';

const steps: Step[] = [
  { kind: 'note', detail: 'first' },
  { kind: 'subset-round', detail: 'second', highlight: [1, 3] },
  { kind: 'subset-round', detail: 'third' },
];

describe('clampStep', () => {
  it('keeps an index inside the trace', () => {
    expect(clampStep(-5, steps)).toBe(0);
    expect(clampStep(99, steps)).toBe(2);
    expect(clampStep(1, steps)).toBe(1);
  });

  it('does not go negative for an empty trace', () => {
    // A machine with no steps still has to render something rather than index at -1.
    expect(clampStep(3, [])).toBe(0);
  });
});

describe('nextStep', () => {
  it('advances', () => {
    expect(nextStep(0, steps)).toBe(1);
  });

  it('stops at the end rather than looping', () => {
    // A trace has an end because the algorithm does. Wrapping to round one would suggest
    // subset construction is a cycle, which is the opposite of what it is.
    expect(nextStep(2, steps)).toBeUndefined();
  });
});

describe('position', () => {
  it('counts from one, the way a person does', () => {
    expect(position(0, steps)).toBe('1 of 3');
    expect(position(2, steps)).toBe('3 of 3');
  });

  it('says nothing about an empty trace', () => {
    expect(position(0, [])).toBe('');
  });
});

describe('highlighted', () => {
  it('reads the ids the core attached to the step', () => {
    expect(highlighted(1, steps)).toEqual([1, 3]);
  });

  it('is empty for a step that names no states', () => {
    expect(highlighted(0, steps)).toEqual([]);
    expect(highlighted(99, steps)).toEqual([]);
  });
});

describe('deep links', () => {
  it('reads a one-based step from the fragment', () => {
    // One-based in the URL because a link that counts from zero is a link written by a
    // programmer for a student.
    expect(readStepFrom('#dfa=4', 'dfa')).toBe(3);
  });

  it('ignores a fragment for a different pane', () => {
    expect(readStepFrom('#nfa=4', 'dfa')).toBeUndefined();
  });

  it('ignores nonsense rather than jumping somewhere arbitrary', () => {
    for (const hash of ['#dfa=0', '#dfa=-2', '#dfa=abc', '#dfa=', '', '#']) {
      expect(readStepFrom(hash, 'dfa'), hash).toBeUndefined();
    }
  });

  it('writes no fragment for the first step', () => {
    // A link to the beginning is just a link to the page.
    expect(stepFragment('dfa', 0)).toBe('');
    expect(stepFragment('dfa', 3)).toBe('#dfa=4');
  });

  it('round-trips every step', () => {
    for (let step = 0; step < 12; step += 1) {
      const fragment = stepFragment('dfa', step);
      expect(readStepFrom(fragment, 'dfa') ?? 0).toBe(step);
    }
  });
});
