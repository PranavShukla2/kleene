import { describe, expect, it } from 'vitest';

import { READY, planned, statusLabel } from '@/overview/status';

describe('status', () => {
  it('labels a working feature as available', () => {
    expect(statusLabel(READY)).toBe('available');
  });

  it('names the phase rather than saying "soon"', () => {
    // The whole point. "Coming soon" promises everything and dates nothing; a phase number is
    // a claim specific enough to be wrong, and therefore worth making.
    expect(statusLabel(planned(3))).toBe('phase 3');
  });

  it('never labels a planned feature as available', () => {
    for (const phase of [3, 4, 5]) {
      expect(statusLabel(planned(phase))).not.toBe('available');
    }
  });
});
