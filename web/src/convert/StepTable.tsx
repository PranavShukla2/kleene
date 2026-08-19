/**
 * δ, filling in cell by cell alongside the diagram (task D3).
 *
 * Half a class reads automata as pictures and half reads them as tables, and the two halves
 * are examined on converting between them. Showing one and not the other reaches half the
 * room; showing both *out of step* is worse than showing one, because then they look like
 * two different machines.
 *
 * So this is not the editor's transition-table panel with a filter bolted on. That one is
 * editable, sized for a side panel, and describes a machine that is finished. This one is
 * read-only, sized to sit under a diagram, and its whole subject is being unfinished: rows
 * appear as subsets are discovered, cells fill as rounds emit transitions, and the cell the
 * current step filled is marked.
 */

import { cellKey, filledCells, type Construction } from '@/convert/construction';
import type { Automaton, StateId, TransitionTable } from '@/model/automaton';

/** What an unfilled cell shows: not "no transition", but "not worked out yet". */
const UNKNOWN = '·';

/** What a filled cell with no targets shows. δ returns the empty set, so say so. */
const EMPTY = '∅';

export function StepTable({
  table,
  automaton,
  at,
  onHoverState,
}: {
  table: TransitionTable;
  automaton: Automaton;
  at: Construction;
  onHoverState?: (id: StateId | undefined) => void;
}) {
  const filled = filledCells(automaton, at);
  const rows = table.rows.filter((row) => at.present.has(row.state));

  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto border-t border-k-border px-4 py-2">
      <table className="border-collapse font-mono text-[11px]">
        <thead>
          <tr>
            <th className="px-1.5 py-0.5 text-left font-normal text-k-text-faint">δ</th>
            {table.columns.map((column) => (
              <th
                key={column.heading}
                className="px-1.5 py-0.5 text-left font-medium text-k-text-muted"
              >
                {column.heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.state}
              className={
                // The row whose turn it is. Same primary as the worklist chip, because they
                // are two views of one fact: this is the subset being expanded.
                at.current === row.state ? 'bg-k-primary/10' : undefined
              }
              onPointerEnter={() => {
                onHoverState?.(row.state);
              }}
              onPointerLeave={() => {
                onHoverState?.(undefined);
              }}
            >
              <th
                scope="row"
                className="cursor-help px-1.5 py-0.5 text-left font-normal whitespace-nowrap"
              >
                {/* `→` and `*`, because that is what a printed table uses and neither
                    survives being turned into colour. */}
                <span className="text-k-text-faint">{row.start ? '→' : '  '}</span>
                <span className={row.accepting ? 'text-k-accepting' : 'text-k-text'}>
                  {row.accepting ? '*' : ' '}
                  {row.label}
                </span>
              </th>

              {row.cells.map((targets, index) => {
                const symbol = table.columns[index]?.symbol ?? undefined;
                const key = symbol === undefined ? undefined : cellKey(row.state, symbol);
                const known = key !== undefined && filled.has(key);

                return (
                  <Cell
                    key={table.columns[index]?.heading ?? index}
                    known={known}
                    // A cell is worked out but empty when its row has been expanded and this
                    // symbol led nowhere — the dead end the trace narrates. Distinguishing
                    // that from "not reached yet" is the entire point of two placeholders.
                    settled={at.done.includes(row.state)}
                    justFilled={key !== undefined && at.cell === key}
                    text={targets
                      .map(
                        (id) =>
                          automaton.states.find((state) => state.id === id)?.label ?? String(id),
                      )
                      .join(', ')}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  known,
  settled,
  justFilled,
  text,
}: {
  known: boolean;
  settled: boolean;
  justFilled: boolean;
  text: string;
}) {
  if (!known) {
    return (
      <td
        className={`px-1.5 py-0.5 ${settled ? 'text-k-text-faint' : 'text-k-border-strong'}`}
        title={settled ? 'no transition on this symbol' : 'not worked out yet'}
      >
        {settled ? EMPTY : UNKNOWN}
      </td>
    );
  }

  return (
    <td
      className={`px-1.5 py-0.5 whitespace-nowrap ${
        justFilled
          ? // The cell this step wrote. Faded in over 280ms, matching the diagram's step
            // transition, so the arrow appearing and the cell filling read as one event.
            'text-k-primary motion-safe:animate-[fade-in_280ms_ease-out]'
          : 'text-k-text'
      }`}
    >
      {text === '' ? EMPTY : text}
    </td>
  );
}
