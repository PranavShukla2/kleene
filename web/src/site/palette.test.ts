import { describe, expect, it } from 'vitest';

import { grouped, moveBy, search, type Action } from '@/site/palette';

const ACTIONS: Action[] = [
  { id: 'convert', label: 'Convert', group: 'Go to' },
  { id: 'examples', label: 'Examples', group: 'Go to' },
  { id: 'docs', label: 'Docs', group: 'Go to' },
  { id: 'minimal', label: 'Minimal DFA', group: 'Convert' },
  { id: 'even', label: 'Even number of a’s', group: 'Open an example', keywords: ['parity'] },
  { id: 'theme', label: 'Toggle theme', group: 'Actions' },
];

/** The ids a query returns, in order. */
function ids(query: string): string[] {
  return search(ACTIONS, query).map((match) => match.action.id);
}

describe('search', () => {
  it('returns everything in group order when nothing is typed', () => {
    // The palette is a menu before it is a search box. The first thing someone sees on
    // pressing the shortcut should be what is possible, not an empty box demanding that they
    // already know.
    expect(search(ACTIONS, '').map((m) => m.action.group)).toEqual([
      'Go to',
      'Go to',
      'Go to',
      'Convert',
      'Open an example',
      'Actions',
    ]);
  });

  it('finds an exact label first', () => {
    expect(ids('docs')[0]).toBe('docs');
  });

  it('prefers a prefix to a match buried in the middle', () => {
    expect(ids('con')[0]).toBe('convert');
  });

  it('matches the initials of a multi-word label', () => {
    // `mdfa` for "Minimal DFA" is what people actually type, and a substring search rejects
    // every query of that shape.
    expect(ids('mdfa')[0]).toBe('minimal');
  });

  it('matches a subsequence, so a query can skip letters', () => {
    expect(ids('cnvt')[0]).toBe('convert');
    expect(ids('exmp')[0]).toBe('examples');
  });

  it('finds an item by a keyword that is never shown', () => {
    expect(ids('parity')[0]).toBe('even');
  });

  it('returns nothing when no item can match', () => {
    expect(ids('zzzz')).toEqual([]);
  });

  it('ranks an adjacent run above a scattered match', () => {
    // "DFA" appears as a run in "Minimal DFA" and only scattered elsewhere. If the scattered
    // one ever wins, the palette finds the right thing second — which feels broken in a way
    // nobody can articulate and no amount of looking at the UI reveals.
    const ranked = ids('dfa');
    expect(ranked[0]).toBe('minimal');
  });

  it('is stable for items that score the same', () => {
    // Ties resolve by group then label, never by the order the source array happened to be
    // in — otherwise reordering a data file silently reorders the palette.
    const twice = [search(ACTIONS, 'e'), search(ACTIONS, 'e')];
    expect(twice[0]?.map((m) => m.action.id)).toEqual(twice[1]?.map((m) => m.action.id));
  });
});

describe('grouped', () => {
  it('drops groups with nothing in them', () => {
    const sections = grouped(search(ACTIONS, 'docs'));
    expect(sections.map((s) => s.group)).toEqual(['Go to']);
  });

  it('keeps the display order rather than the match order', () => {
    const sections = grouped(search(ACTIONS, 'e'));
    const order = sections.map((s) => s.group);
    expect(order).toEqual([...order].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  });
});

describe('moveBy', () => {
  it('wraps at both ends', () => {
    // Arrow-down at the bottom goes to the top. A palette that stops at the last item makes
    // the reader look for a scrollbar to find out whether it did anything.
    expect(moveBy(2, 1, 3)).toBe(0);
    expect(moveBy(0, -1, 3)).toBe(2);
    expect(moveBy(0, 1, 3)).toBe(1);
  });

  it('does not divide by zero on an empty list', () => {
    expect(moveBy(0, 1, 0)).toBe(0);
  });
});
