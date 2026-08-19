import { describe, expect, it } from 'vitest';

import { READY, planned, statusBadge, statusHeadline, statusLabel } from '@/overview/status';

describe('status', () => {
  it('labels a working feature as available', () => {
    expect(statusLabel(READY)).toBe('available');
  });

  it('names the phase', () => {
    expect(statusLabel(planned(3))).toBe('phase 3');
  });

  it('never labels a planned feature as available', () => {
    for (const phase of [3, 4, 5]) {
      expect(statusLabel(planned(phase))).not.toBe('available');
    }
  });

  it('says both "coming soon" and which phase', () => {
    // Two readers, two halves. Someone skimming needs the words; someone deciding whether to
    // depend on this needs the number. Dropping either leaves one of them unserved.
    expect(statusBadge(planned(4))).toBe('Coming soon · phase 4');
    expect(statusBadge(READY)).toBe('Live');
  });

  it('gives a short headline for places with no room for the number', () => {
    expect(statusHeadline(planned(4))).toBe('Coming soon');
    expect(statusHeadline(READY)).toBe('Live');
  });
});
