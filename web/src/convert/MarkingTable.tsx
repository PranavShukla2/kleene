/**
 * The Myhill–Nerode marking table (tasks E5, E6).
 *
 * The triangular grid a course has students fill in by hand: a row and a column per state,
 * the lower half only, and a cross in every cell whose pair can be told apart. Half a class
 * revises from this and half from the partition rounds, which is why it is a peer of the
 * other view rather than an alternative to it.
 *
 * ## What each cell carries
 *
 * A cross is the answer to "are these different". The exam asks the harder question — *how do
 * you know* — and the answer to that is the string that separates them, which is why every
 * marked cell shows its witness and the round it was marked. That is the one thing the tools
 * students are pointed at do not do (roadmap §1.1).
 *
 * The witness is on the cell itself at a readable size rather than behind a tooltip. A tooltip
 * is a thing you have to already suspect is there.
 */

import { cellState, triangle, witnessOf } from '@/convert/refinement';
import type { Automaton, MarkingTable as Table, Split, StateId } from '@/model/automaton';

export function MarkingTable({
  table,
  automaton,
  split,
  previous,
  epsilon,
  onHoverPair,
}: {
  table: Table;
  /** The machine refinement ran on — *not* the caller's, whose ids may differ. */
  automaton: Automaton;
  split: Split | undefined;
  /** The step before, so a cell can say it was marked *now* rather than merely marked. */
  previous: Split | undefined;
  epsilon: string;
  /** Light a pair in the diagram beside this. */
  onHoverPair?: (pair: readonly StateId[]) => void;
}) {
  const { rows, columns, cellAt } = triangle(table);
  const label = (id: StateId) =>
    automaton.states.find((state) => state.id === id)?.label ?? String(id);

  if (rows.length === 0) {
    return (
      <p className="px-4 py-3 text-sm text-k-text-faint">
        One state has nothing to be distinguished from.
      </p>
    );
  }

  return (
    <div
      className="overflow-x-auto px-4 py-3"
      onPointerLeave={() => {
        onHoverPair?.([]);
      }}
    >
      <table className="border-separate border-spacing-0.5 font-mono text-[11px]">
        <caption className="sr-only">
          Myhill–Nerode marking table. A marked cell holds the string that tells its pair apart.
        </caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row}>
              <th
                scope="row"
                className="pr-2 text-right font-normal whitespace-nowrap text-k-text-muted"
              >
                {label(row)}
              </th>

              {columns.map((col) => {
                const cell = cellAt(row, col);
                // Above the diagonal: the relation is symmetric, so drawing both halves
                // would be drawing the same fact twice.
                if (!cell) return <td key={col} className="w-14" />;

                const state = cellState(cell, split, previous);
                return (
                  <Cell
                    key={col}
                    state={state}
                    witness={cell.mark ? witnessOf(cell.mark.witness, epsilon) : undefined}
                    round={cell.mark?.round}
                    title={`${label(row)} and ${label(col)}`}
                    onHover={() => {
                      onHoverPair?.([row, col]);
                    }}
                  />
                );
              })}
            </tr>
          ))}

          <tr>
            <th />
            {columns.map((col) => (
              <th
                key={col}
                scope="col"
                className="pt-1 text-center font-normal text-k-text-muted"
              >
                {label(col)}
              </th>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  state,
  witness,
  round,
  title,
  onHover,
}: {
  state: 'open' | 'fresh' | 'marked';
  witness: string | undefined;
  round: number | undefined;
  title: string;
  onHover: () => void;
}) {
  /*
    Three states, three treatments, and none of them colour alone (design-system §1.2): an
    open cell is empty, a marked one holds text, and the one marked by this very step is
    ringed as well as tinted.
  */
  const tone = {
    open: 'border-k-border text-k-text-faint',
    marked: 'border-k-border-strong bg-k-surface text-k-text-muted',
    fresh:
      'border-k-distinguishing bg-k-distinguishing/10 text-k-distinguishing ring-1 ring-k-distinguishing/40 motion-safe:animate-[fade-in_280ms_ease-out]',
  }[state];

  return (
    <td
      onPointerEnter={onHover}
      title={
        state === 'open'
          ? `${title} — not told apart yet`
          : `${title} — separated in round ${String(round ?? 0)} by “${witness ?? ''}”`
      }
      className={`h-9 w-14 cursor-help rounded border text-center align-middle transition-colors duration-(--duration-k-step) ${tone}`}
    >
      {state === 'open' ? (
        ''
      ) : (
        <span className="flex flex-col leading-none">
          <span className="font-medium">{witness}</span>
          {/* The round, small. It answers "when", which is the second half of the exam's
              question and never the first. */}
          <span className="mt-0.5 text-[9px] opacity-60">r{round}</span>
        </span>
      )}
    </td>
  );
}
