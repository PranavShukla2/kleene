import { describe, expect, it } from 'vitest';

import {
  GROUPS,
  SHORTCUTS,
  formatChord,
  matchesChord,
  shortcutFor,
  sheetRowsIn,
  shortcutsIn,
} from '@/canvas/shortcuts';

/** A key event with only the fields matching reads. */
function key(
  init: { key?: string; code?: string } & Partial<
    Record<'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey', boolean>
  >,
): KeyboardEvent {
  return {
    key: init.key ?? '',
    code: init.code ?? '',
    metaKey: init.metaKey ?? false,
    ctrlKey: init.ctrlKey ?? false,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
  } as KeyboardEvent;
}

describe('matchesChord', () => {
  it('matches a letter through Cmd on a Mac and Ctrl elsewhere', () => {
    const cmdZ = key({ key: 'z', code: 'KeyZ', metaKey: true });
    const ctrlZ = key({ key: 'z', code: 'KeyZ', ctrlKey: true });

    expect(matchesChord('Mod+KeyZ', cmdZ, true)).toBe(true);
    expect(matchesChord('Mod+KeyZ', ctrlZ, false)).toBe(true);
  });

  it('does not fire a Mac chord on Ctrl, or a non-Mac chord on Cmd', () => {
    // The wrong modifier must miss. Accepting either would make Ctrl+Z on a Mac -- which
    // means nothing there -- silently undo.
    expect(matchesChord('Mod+KeyZ', key({ key: 'z', ctrlKey: true }), true)).toBe(false);
    expect(matchesChord('Mod+KeyZ', key({ key: 'z', metaKey: true }), false)).toBe(false);
  });

  it('rejects the chord when the other modifier is also held', () => {
    // Ctrl+Cmd+Z is not undo, and treating it as undo makes shortcuts fire during chords
    // meant for the window manager.
    const both = key({ key: 'z', code: 'KeyZ', metaKey: true, ctrlKey: true });
    expect(matchesChord('Mod+KeyZ', both, true)).toBe(false);
  });

  it('distinguishes undo from redo by shift', () => {
    const shifted = key({ key: 'z', code: 'KeyZ', metaKey: true, shiftKey: true });
    expect(matchesChord('Mod+KeyZ', shifted, true)).toBe(false);
    expect(matchesChord('Mod+Shift+KeyZ', shifted, true)).toBe(true);
  });

  it('matches a shifted digit on its code, not on the glyph it produces', () => {
    // The reason the table is not written against `event.key`. Shift+1 arrives as `!` on a
    // US layout, so a key-based table would fail to bind exactly the shifted shortcuts.
    const shiftOne = key({ key: '!', code: 'Digit1', shiftKey: true });
    expect(matchesChord('Shift+Digit1', shiftOne, true)).toBe(true);
  });

  it('matches a letter through its layout, not its physical position', () => {
    // On AZERTY the key at the US Z position reports code KeyW. Binding by code would put
    // undo under the key marked W.
    const azertyZ = key({ key: 'z', code: 'KeyW', metaKey: true });
    expect(matchesChord('Mod+KeyZ', azertyZ, true)).toBe(true);
  });

  it('matches a letter regardless of case', () => {
    expect(matchesChord('Mod+KeyA', key({ key: 'A', metaKey: true }), true)).toBe(true);
  });

  it('matches a bare named key', () => {
    expect(matchesChord('Escape', key({ code: 'Escape' }), true)).toBe(true);
  });

  it('does not match a bare key when a modifier is held', () => {
    expect(matchesChord('Escape', key({ code: 'Escape', metaKey: true }), true)).toBe(false);
  });
});

describe('shortcutFor', () => {
  it('finds undo', () => {
    expect(shortcutFor(key({ key: 'z', code: 'KeyZ', metaKey: true }), true)?.id).toBe('undo');
  });

  it('finds redo through its unadvertised alias', () => {
    expect(shortcutFor(key({ key: 'y', code: 'KeyY', ctrlKey: true }), false)?.id).toBe('redo');
  });

  it('accepts Delete as well as Backspace', () => {
    expect(shortcutFor(key({ code: 'Delete' }), true)?.id).toBe('delete');
    expect(shortcutFor(key({ code: 'Backspace' }), true)?.id).toBe('delete');
  });

  it('finds nothing for an ordinary keystroke', () => {
    expect(shortcutFor(key({ key: 'a', code: 'KeyA' }), true)).toBeUndefined();
  });

  it('separates a plain arrow from a shifted one', () => {
    expect(shortcutFor(key({ code: 'ArrowUp' }), true)?.id).toBe('nudgeUp');
    expect(shortcutFor(key({ code: 'ArrowUp', shiftKey: true }), true)?.id).toBe('nudgeUpFar');
  });
});

describe('scoping', () => {
  it('does not let a canvas-scoped chord fire globally', () => {
    // Tab must keep moving between the page's own controls, which is how anyone navigating
    // by keyboard reaches the canvas in the first place.
    expect(shortcutFor(key({ code: 'Tab' }), true)).toBeUndefined();
  });

  it('fires a canvas-scoped chord within the canvas', () => {
    expect(shortcutFor(key({ code: 'Tab' }), true, 'canvas')?.id).toBe('focusNext');
    expect(shortcutFor(key({ code: 'Tab', shiftKey: true }), true, 'canvas')?.id).toBe(
      'focusPrev',
    );
  });

  it('does not let a global chord fire from the canvas scope', () => {
    // The scopes are exclusive both ways. A canvas listener claiming everything would
    // double-handle keys the window listener already owns.
    expect(
      shortcutFor(key({ key: 'z', code: 'KeyZ', metaKey: true }), true, 'canvas'),
    ).toBeUndefined();
  });
});

describe('the table itself', () => {
  it('binds each chord to exactly one shortcut', () => {
    // Two shortcuts sharing a chord means one of them silently never fires, and which one
    // depends on table order. Worth catching here rather than in a bug report.
    const chords = SHORTCUTS.flatMap((s) => [s.chord, ...(s.aliases ?? [])]);
    expect(new Set(chords).size).toBe(chords.length);
  });

  it('gives each shortcut a distinct id', () => {
    expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
  });

  it('puts every shortcut in a group the sheet renders', () => {
    // A shortcut in an unrendered group works and is undocumented, which is precisely the
    // drift this table exists to prevent.
    expect(GROUPS.flatMap((group) => shortcutsIn(group))).toHaveLength(SHORTCUTS.length);
  });

  it('gives every family a member carrying its notation', () => {
    // A family whose first member has no `display` collapses to one row showing one chord,
    // which claims three of the four directions do not exist.
    const families = new Set(SHORTCUTS.flatMap((s) => (s.family ? [s.family] : [])));
    for (const family of families) {
      const first = SHORTCUTS.find((s) => s.family === family);
      expect(first?.display, family).toBeTruthy();
    }
  });

  it('labels every shortcut', () => {
    for (const shortcut of SHORTCUTS)
      expect(shortcut.label.length, shortcut.id).toBeGreaterThan(2);
  });
});

describe('sheetRowsIn', () => {
  it('collapses an arrow family to a single row', () => {
    // Eight near-identical nudge rows is how a reference stops being read.
    const rows = sheetRowsIn('Editing', true);
    expect(rows.filter((row) => row.label.startsWith('Nudge'))).toHaveLength(2);
  });

  it('keeps every family member bound even though only one is listed', () => {
    expect(shortcutFor(key({ code: 'ArrowLeft' }), true)?.id).toBe('nudgeLeft');
  });

  it('shows the family notation rather than one of its chords', () => {
    const nudge = sheetRowsIn('Editing', true).find((row) => row.label === 'Nudge selection');
    expect(nudge?.keys).toBe('\u2190\u2191\u2193\u2192');
  });

  it('leaves ungrouped shortcuts alone', () => {
    expect(sheetRowsIn('View', true)).toHaveLength(4);
  });
});

describe('formatChord', () => {
  it('uses Mac symbols with no separator', () => {
    expect(formatChord('Mod+Shift+KeyZ', true)).toBe('⌘⇧Z');
  });

  it('uses words joined by plus elsewhere', () => {
    expect(formatChord('Mod+Shift+KeyZ', false)).toBe('Ctrl+Shift+Z');
  });

  it('strips the Digit prefix', () => {
    expect(formatChord('Shift+Digit1', false)).toBe('Shift+1');
  });

  it('shows a glyph for keys that have one', () => {
    expect(formatChord('ArrowUp', true)).toBe('↑');
    expect(formatChord('Backspace', true)).toBe('⌫');
  });

  it('renders every chord in the table without leaking a raw code', () => {
    for (const shortcut of SHORTCUTS) {
      const shown = formatChord(shortcut.chord, false);
      expect(shown, shortcut.id).not.toMatch(/Key|Digit|Mod/);
    }
  });
});
