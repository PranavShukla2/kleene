/**
 * What survives a reload, and what a value written by an older build turns into.
 *
 * The migration is the part worth testing. This preference used to be a boolean called
 * `panelOpen` and is now the name of a panel, so every returning user has the old shape in
 * `localStorage`. The failure mode of getting that wrong is not a crash — it is an editor that
 * quietly forgets what someone chose the last time they used it, which nobody reports.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { openPanelFromStorage } from '@/store/preferences';

const KEY = 'kleene.preferences';

describe('which panel is open after a reload', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opens nothing on a first visit', () => {
    // The rail is always on screen, so the panels stay discoverable without any of them
    // taking the canvas's width before anyone has asked for one.
    expect(openPanelFromStorage()).toBeUndefined();
  });

  it('reopens the panel that was open', () => {
    localStorage.setItem(KEY, JSON.stringify({ openPanel: 'export' }));
    expect(openPanelFromStorage()).toBe('export');
  });

  it('turns the old boolean into the panel it was mostly showing', () => {
    // `panelOpen: true` meant "the stack is open", and the transition table is what people
    // were looking at in it. Reopening something respects the choice; reopening nothing
    // silently discards it.
    localStorage.setItem(KEY, JSON.stringify({ panelOpen: true }));
    expect(openPanelFromStorage()).toBe('table');
  });

  it.each([
    ['the old boolean, false', JSON.stringify({ panelOpen: false })],
    ['a panel that no longer exists', JSON.stringify({ openPanel: 'gone' })],
    ['a hand-edited number', JSON.stringify({ openPanel: 7 })],
    ['corrupt JSON', '{not json'],
    ['a bare string', JSON.stringify('table')],
    ['null', JSON.stringify(null)],
  ])('degrades %s to nothing open', (_what, raw) => {
    // Nothing open is always a legal state, which is what makes it the right thing to fall
    // back to: no stored value can put the editor into a layout it cannot render.
    localStorage.setItem(KEY, raw);
    expect(openPanelFromStorage()).toBeUndefined();
  });
});
