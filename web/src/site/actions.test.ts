import { describe, expect, it } from 'vitest';

import { siteActions } from '@/site/actions';

const ACTIONS = siteActions('system');

describe('the palette action list', () => {
  it('gives every action a distinct id', () => {
    // The invariant that broke. Every unwritten docs article shared the id `doc:`, and both
    // `NFA` and `ε-NFA` slugged to `concept:nfa`. A duplicate id becomes a duplicate React
    // key, which leaves a row from a previous query stranded in the DOM — visible, unable to
    // be highlighted, and not counted in the footer.
    const ids = ACTIONS.map((action) => action.id);
    const seen = new Set(ids);
    const repeated = ids.filter((id, at) => ids.indexOf(id) !== at);

    expect(repeated).toEqual([]);
    expect(seen.size).toBe(ids.length);
  });

  it('gives every action a dispatchable prefix', () => {
    // The id is the dispatch. An id whose prefix the handler does not know is a row that
    // looks live and does nothing when pressed.
    const HANDLED = ['go:', 'tool:', 'concept:', 'doc:', 'regex:', 'example:'];
    for (const action of ACTIONS) {
      const known =
        HANDLED.some((prefix) => action.id.startsWith(prefix)) ||
        ['theme', 'source'].includes(action.id);
      expect(known, `${action.id} has no handler`).toBe(true);
    }
  });

  it('gives every action a label and a group', () => {
    for (const action of ACTIONS) {
      expect(action.label.trim()).not.toBe('');
      expect(action.group).toBeTruthy();
    }
  });

  it('covers every route the site has a page for', () => {
    // A page reachable by URL and not by the palette is a page most people will not find,
    // now that the palette is how the site is searched.
    const routed = ACTIONS.filter((action) => action.id.startsWith('go:')).map((action) =>
      action.id.slice('go:'.length),
    );
    for (const route of [
      'overview',
      'editor',
      'convert',
      'examples',
      'learn',
      'docs',
      'pricing',
      'roadmap',
      'changelog',
      'about',
    ]) {
      expect(routed, `${route} is unreachable from the palette`).toContain(route);
    }
  });
});
