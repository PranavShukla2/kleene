/**
 * Handing a machine from one page to another.
 *
 * The conversion page builds automata the editor should be able to open. They are separate
 * routes, so something has to carry the machine across — and the two obvious options are both
 * worse than this one.
 *
 * **Not the URL.** A ten-state ε-NFA in a query string is kilobytes of base64 in the address
 * bar, and Phase 4 owns share links properly (with compression and a format decision behind
 * it). Building a worse version now would mean two encodings to keep working.
 *
 * **Not the document store directly.** The editor decides on mount whether to restore
 * autosaved work or load an example, and a page that had already written into the store would
 * be racing that decision. A hand-off is a *request*, which the editor's existing ordering can
 * then rank against the others.
 */

import type { Automaton } from '@/model/automaton';

let pending: Automaton | undefined;

/** Offer a machine to the next page that asks. */
export function handOff(automaton: Automaton): void {
  pending = automaton;
}

/**
 * Take the offered machine, if there is one.
 *
 * Consumed on read, so a later reload does not resurrect it. Someone who converts an
 * expression, edits the result, and then refreshes expects their edits back — not the machine
 * they started from.
 */
export function takeHandOff(): Automaton | undefined {
  const taken = pending;
  pending = undefined;
  return taken;
}
