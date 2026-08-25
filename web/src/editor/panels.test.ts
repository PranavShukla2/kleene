import { describe, expect, it } from 'vitest';

import { PANELS, isPanelId, panelSpec } from '@/editor/panels';

describe('the panel registry', () => {
  it('gives every panel a distinct id', () => {
    const ids = PANELS.map((panel) => panel.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every panel a distinct glyph', () => {
    // The rail is glyphs and labels; two panels sharing a glyph makes the rail ambiguous at
    // exactly the moment it is being scanned rather than read.
    const glyphs = PANELS.map((panel) => panel.glyph);
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('opens the wide panels along the bottom', () => {
    // The rule the registry exists to hold. A transition table and a tape are wide, and a
    // side column makes a table stop looking like a table.
    expect(panelSpec('table').edge).toBe('bottom');
    expect(panelSpec('test').edge).toBe('bottom');
  });

  it('opens the list-shaped panels at the side', () => {
    expect(panelSpec('selection').edge).toBe('side');
    expect(panelSpec('define').edge).toBe('side');
    expect(panelSpec('export').edge).toBe('side');
  });

  it('recognises only real panel ids', () => {
    // What a stored preference is checked against, so a renamed panel degrades to "nothing
    // open" instead of throwing on the first render after an update.
    expect(isPanelId('table')).toBe(true);
    expect(isPanelId('nonexistent')).toBe(false);
    expect(isPanelId(undefined)).toBe(false);
    expect(isPanelId(3)).toBe(false);
  });

  it('describes every panel in words', () => {
    for (const panel of PANELS) {
      expect(panel.label.length).toBeGreaterThan(0);
      expect(panel.hint.length).toBeGreaterThan(0);
    }
  });
});
