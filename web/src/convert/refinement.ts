/**
 * Reading a minimization at one step of its trace.
 *
 * The engine hands over a `Split` per step — the partition as it stood, what broke, and the
 * pair that proved it — plus the Myhill–Nerode table. This turns that into the two questions
 * the views actually ask: *which block is this state in now*, and *is this pair separated yet*.
 *
 * ## The two views are one fact
 *
 * Task E5 wants the partition view and the marking table to be peers rather than one being a
 * summary of the other, and the way to guarantee that is to derive them from the same place.
 * So "is this pair marked at step *n*" is not looked up in the table at all — it is answered
 * by asking whether the two states are in different blocks of the partition at step *n*.
 *
 * That is exact, needs no extra data on the wire, and makes the duality hold *at every step*
 * rather than only at the end. The table then supplies what the partition cannot: the round a
 * pair separated, and the string that separated it.
 */

import type { Cell, MarkingTable, Minimization, Split, StateId } from '@/model/automaton';

/** Which block each state sits in, by index into the partition. */
export function blockIndex(partition: readonly (readonly StateId[])[]): Map<StateId, number> {
  const index = new Map<StateId, number>();
  partition.forEach((block, at) => {
    for (const id of block) index.set(id, at);
  });
  return index;
}

/** The step's split, clamped so a stale URL cannot index past the end. */
export function splitAt(minimization: Minimization, step: number): Split | undefined {
  if (minimization.splits.length === 0) return undefined;
  const at = Math.min(Math.max(step, 0), minimization.splits.length - 1);
  return minimization.splits[at];
}

/**
 * Whether two states have been told apart by this point in the trace.
 *
 * By the partition rather than by the table's round number, deliberately. A round can contain
 * several splits, so "round 2" is not a moment — and a table that filled in a whole round at
 * once would jump ahead of the diagram beside it.
 */
export function separated(split: Split | undefined, p: StateId, q: StateId): boolean {
  if (!split || p === q) return false;
  const index = blockIndex(split.partition);
  const left = index.get(p);
  const right = index.get(q);
  return left !== undefined && right !== undefined && left !== right;
}

/** How a cell of the marking table should read at this step. */
export type CellState =
  /** Not yet told apart. */
  | 'open'
  /** Separated by the step being shown — the one worth looking at. */
  | 'fresh'
  /** Separated earlier. */
  | 'marked';

export function cellState(
  cell: Cell,
  split: Split | undefined,
  previous: Split | undefined,
): CellState {
  if (!separated(split, cell.row, cell.col)) return 'open';
  return separated(previous, cell.row, cell.col) ? 'marked' : 'fresh';
}

/**
 * The rounds a trace passed through, with the step each one starts at.
 *
 * For the round-by-round presentation, which needs to group steps without the scrubber losing
 * the ability to stop between them (task E7 — the two views share a position, and a position
 * is a step).
 */
export function rounds(
  splits: readonly Split[],
): { round: number; from: number; to: number }[] {
  const out: { round: number; from: number; to: number }[] = [];
  splits.forEach((split, at) => {
    const last = out[out.length - 1];
    if (last && last.round === split.round) last.to = at;
    else out.push({ round: split.round, from: at, to: at });
  });
  return out;
}

/**
 * The states in `table` order, which is the order a course draws the triangle in.
 *
 * The first state is the column header nobody needs and the last is the row nobody needs —
 * the lower triangle has no cell for either — so both are trimmed at the call site rather
 * than rendered empty.
 */
export function triangle(table: MarkingTable): {
  rows: StateId[];
  columns: StateId[];
  cellAt: (row: StateId, col: StateId) => Cell | undefined;
} {
  const byPair = new Map<string, Cell>();
  for (const cell of table.cells) byPair.set(`${String(cell.row)}:${String(cell.col)}`, cell);

  return {
    rows: table.states.slice(1),
    columns: table.states.slice(0, -1),
    cellAt: (row, col) => byPair.get(`${String(row)}:${String(col)}`),
  };
}

/** A witness rendered for display. Empty means the empty string itself did the work. */
export function witnessOf(witness: string, epsilon: string): string {
  return witness === '' ? epsilon : witness;
}
