/**
 * The regex bar's non-visual parts.
 *
 * Split out because the interesting decisions here — when to recompile, and how to turn a
 * character span into something a `<textarea>`-less input can underline — are testable without
 * a DOM, and would otherwise be buried in a component.
 */

import type { ParseError, Span } from '@/model/automaton';

/**
 * How long to wait after a keystroke before compiling.
 *
 * Task A2 says ~150ms and that number is right for a reason worth stating: compiling is fast
 * (Thompson on a teaching-sized expression is microseconds), so the debounce is not protecting
 * the CPU. It is protecting the *reader*. Every intermediate state of `a(b+c)*` is a parse
 * error — `a(`, `a(b`, `a(b+` — and showing each one flashes red at someone who is typing
 * correctly. 150ms is long enough to skip those and short enough to feel live.
 */
export const COMPILE_DEBOUNCE_MS = 150;

/**
 * The three pieces of a source string, split around an error's span.
 *
 * Returned as text rather than as indices so the component renders three spans and no
 * arithmetic. Spans are *character* offsets, not bytes — see `Span` in the core — which is why
 * this walks the array of code points rather than slicing the string directly.
 */
export interface Underlined {
  before: string;
  offending: string;
  after: string;
}

/**
 * Split `source` around `span`.
 *
 * A span pointing past the end is clamped rather than rejected. That happens for real: "expected
 * a symbol after `(`" points at the position *after* the last character, which is exactly where
 * the caret is and exactly where the underline belongs — so the offending run comes back empty
 * and the component shows a caret-width marker instead.
 */
export function underline(source: string, span: Span): Underlined {
  const characters = [...source];
  const start = Math.max(0, Math.min(span.start, characters.length));
  const end = Math.max(start, Math.min(span.end, characters.length));

  return {
    before: characters.slice(0, start).join(''),
    offending: characters.slice(start, end).join(''),
    after: characters.slice(end).join(''),
  };
}

/**
 * The error as one line, ready to read.
 *
 * Message and help joined with an em dash rather than stacked, because the bar sits above the
 * diagram and every row it grows pushes the thing being explained further down the page.
 */
export function errorLine(error: ParseError): string {
  return error.help === undefined ? error.message : `${error.message} — ${error.help}`;
}

/**
 * The symbols worth a button.
 *
 * A2 and A4: these are the characters a student on a laptop keyboard has to hunt for. `+` and
 * `|` are both offered because D1 makes them synonyms — showing only one would quietly imply
 * the other is wrong, and someone copying from a textbook that uses the other spelling would
 * conclude the tool disagrees with their course.
 *
 * `ε` is *not* here. It comes from the notation setting (D7), so the palette is built at render
 * time from the engine's own glyph rather than hard-coded — a palette that inserted `ε` into a
 * λ-configured session would be inserting a character the parser then rejects.
 */
export const PALETTE: readonly { insert: string; label: string; hint: string }[] = [
  { insert: '|', label: '|', hint: 'union — same as +' },
  { insert: '*', label: '*', hint: 'zero or more' },
  { insert: '(', label: '(', hint: 'group' },
  { insert: ')', label: ')', hint: 'group' },
  { insert: '∅', label: '∅', hint: 'the empty language' },
];

/** Insert `text` into `source` at a caret position, returning the new value and caret. */
export function insertAt(
  source: string,
  caret: number,
  text: string,
): { value: string; caret: number } {
  const characters = [...source];
  const at = Math.max(0, Math.min(caret, characters.length));
  const value = [...characters.slice(0, at), text, ...characters.slice(at)].join('');
  return { value, caret: at + [...text].length };
}
