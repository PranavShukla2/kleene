import { describe, expect, it } from 'vitest';

import { STATE_DRAG, isStateDrag } from '@/editor/dragState';

/** A `DragEvent` is awkward to build in jsdom; only `dataTransfer.types` is read. */
const drag = (types: string[]) => ({ dataTransfer: { types } }) as unknown as DragEvent;

describe('telling a state chip from a dropped file', () => {
  it('recognises a chip', () => {
    expect(isStateDrag(drag([STATE_DRAG]))).toBe(true);
  });

  it('does not claim a file drag', () => {
    // The distinction that matters: dropping a file replaces the whole document and dropping
    // a chip adds one state. Confusing them silently discards someone's work.
    expect(isStateDrag(drag(['Files']))).toBe(false);
  });

  it('does not claim text dragged in from elsewhere', () => {
    expect(isStateDrag(drag(['text/plain', 'text/html']))).toBe(false);
  });

  it('survives a drag with no dataTransfer at all', () => {
    expect(isStateDrag({} as DragEvent)).toBe(false);
  });

  it('uses a type no other application will send', () => {
    expect(STATE_DRAG.startsWith('application/x-')).toBe(true);
  });
});
