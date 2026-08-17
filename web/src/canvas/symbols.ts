/**
 * Turning what someone types on an edge into transition symbols, and back.
 *
 * A drawn edge shows `a, b, c` — one edge per ordered pair, symbols sorted. Editing that label
 * is how transitions get their symbols, so this is the parser for the most-used input in the
 * editor. It is separated out because the interesting cases are all about what people
 * *actually type*, and those are worth testing without a DOM.
 */

/** How a symbol set is shown, and what {@link parseSymbols} accepts. */
export const SYMBOL_SEPARATOR = ', ';

/** What the renderer draws for a transition with no symbol. */
export const EPSILON = 'ε';

/**
 * Parse an edge label into symbols.
 *
 * Split on commas *and* whitespace, so `a,b`, `a, b` and `a b` all work. Somebody typing
 * quickly produces all three, and rejecting two of them teaches a syntax rather than accepting
 * an obvious intent.
 *
 * `ε` and the empty string both mean an ε-transition, represented as `undefined` — the same
 * value the model uses, so nothing downstream has to know that `ε` is a spelling rather than a
 * symbol. That also means a machine cannot accidentally acquire a literal symbol named `ε`
 * that behaves like an ordinary letter and prints like an epsilon.
 *
 * Duplicates collapse and order is preserved as typed; sorting happens at render time, in
 * `groupEdges`, so what is stored stays what was meant.
 */
export function parseSymbols(text: string): (string | undefined)[] {
  const parts = text
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  // An empty label is an ε-transition rather than *no* transition. Deleting the symbols of an
  // edge should not silently delete the edge — that is what selecting and deleting is for,
  // and a gesture that removes more than it appears to is how work gets lost.
  if (parts.length === 0) return [undefined];

  const seen = new Set<string>();
  const symbols: (string | undefined)[] = [];

  for (const part of parts) {
    const symbol = part === EPSILON ? undefined : part;
    const key = symbol ?? EPSILON;
    if (seen.has(key)) continue;
    seen.add(key);
    symbols.push(symbol);
  }

  return symbols;
}

/** Render symbols back into an editable label. */
export function formatSymbols(symbols: readonly (string | undefined)[]): string {
  return symbols.map((symbol) => symbol ?? EPSILON).join(SYMBOL_SEPARATOR);
}

/**
 * Which of these symbols are not yet in the alphabet.
 *
 * Used to tell the user what an edit is about to add to Σ. Adding is the right behaviour — a
 * student drawing a machine types the symbol they mean, and being told it is not in an
 * alphabet they have not written down yet is a rule enforced for its own sake — but doing it
 * *silently* is how an alphabet fills up with typos nobody can account for.
 */
export function newSymbols(
  symbols: readonly (string | undefined)[],
  alphabet: readonly string[],
): string[] {
  return symbols.filter(
    (symbol): symbol is string => symbol !== undefined && !alphabet.includes(symbol),
  );
}
