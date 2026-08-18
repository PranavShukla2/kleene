import { describe, expect, it } from 'vitest';

import { errorLine, insertAt, underline } from '@/convert/regex';

describe('underline', () => {
  it('splits the source around the span', () => {
    expect(underline('a(b+c)', { start: 1, end: 2 })).toEqual({
      before: 'a',
      offending: '(',
      after: 'b+c)',
    });
  });

  it('counts characters, not bytes', () => {
    // The reason `Span` is character-indexed. `ε` is two bytes; a byte offset would land
    // inside it and split the string mid-glyph — and ε is exactly the character a regex bar
    // for this subject invites people to type.
    expect(underline('εab', { start: 1, end: 2 })).toEqual({
      before: 'ε',
      offending: 'a',
      after: 'b',
    });
  });

  it('clamps a span pointing past the end', () => {
    // A real case: "expected a symbol after `(`" points at the position after the last
    // character, which is where the caret is and where the underline belongs.
    expect(underline('a(', { start: 2, end: 3 })).toEqual({
      before: 'a(',
      offending: '',
      after: '',
    });
  });

  it('survives a reversed span rather than producing a negative slice', () => {
    expect(underline('abc', { start: 2, end: 1 }).offending).toBe('');
  });

  it('reassembles into the original source', () => {
    for (const source of ['', 'a', 'a(b+c)*', 'εab', '(((']) {
      const parts = underline(source, { start: 1, end: 3 });
      expect(parts.before + parts.offending + parts.after).toBe(source);
    }
  });
});

describe('errorLine', () => {
  it('shows the message alone when there is no suggestion', () => {
    expect(errorLine({ span: { start: 0, end: 1 }, message: 'nope' })).toBe('nope');
  });

  it('joins the suggestion on one line', () => {
    // One line, not two. The bar sits above the diagram, and every row it grows pushes the
    // thing being explained further down the page.
    expect(errorLine({ span: { start: 0, end: 1 }, message: 'nope', help: 'try this' })).toBe(
      'nope — try this',
    );
  });
});

describe('insertAt', () => {
  it('inserts at the caret and moves it past what was inserted', () => {
    expect(insertAt('ab', 1, '|')).toEqual({ value: 'a|b', caret: 2 });
  });

  it('appends when the caret is at the end', () => {
    expect(insertAt('ab', 2, '*')).toEqual({ value: 'ab*', caret: 3 });
  });

  it('clamps a caret past the end rather than producing undefined', () => {
    expect(insertAt('ab', 99, '*')).toEqual({ value: 'ab*', caret: 3 });
  });

  it('counts a multi-byte insert as one character', () => {
    expect(insertAt('ab', 1, '∅')).toEqual({ value: 'a∅b', caret: 2 });
  });
});
