/**
 * δ, written out.
 *
 * Roadmap §2.4a. Not a view of the diagram — the diagram is a picture of *this*. A student is
 * examined on converting between the two in both directions, so the table has to read the way
 * a printed one does: `→` on the start row, `*` on accepting rows, targets as a set, and no ε
 * column unless the machine actually has ε-transitions.
 *
 * The table is **editable** (task I2). Read-only would make it a report, and for a dense DFA
 * typing targets is genuinely faster than drawing them. Editing goes through the same commands
 * the canvas uses, so undo does not care which surface an edit came from.
 *
 * The contents come from Rust (`Engine.transitionTable`), because whether an ε column exists
 * and what an empty cell means are decisions about δ rather than about layout.
 */

import { useState } from 'react';

import { Panel } from '@/panels/Alphabet';
import type { Automaton, StateId, TableRow, TransitionTable as Table } from '@/model/automaton';

/** What a cell with no targets shows. The empty set, because that is what δ returns. */
const EMPTY_CELL = '∅';

interface Props {
  table: Table | undefined;
  automaton: Automaton;
  selection: readonly StateId[];
  /** Select a state, shared with the canvas both ways (task I3). */
  onSelect: (ids: StateId[]) => void;
  /** Commit an edited cell: the targets now reachable from `from` on `symbol`. */
  onEdit: (from: StateId, symbol: string | undefined, targets: StateId[]) => void;
}

export function TransitionTablePanel({ table, automaton, selection, onSelect, onEdit }: Props) {
  const [editing, setEditing] = useState<{ row: StateId; column: number } | undefined>(
    undefined,
  );

  if (!table || table.rows.length === 0) {
    return (
      <Panel title="Transition table">
        <p className="text-sm text-k-text-faint">
          No states yet. δ has nothing to say about a machine with no states.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Transition table">
      <div className="-mx-1 overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs">
          <thead>
            <tr>
              {/*
                The corner cell carries the function's name. A table headed `δ` is the one in
                the textbook; a table headed "State" is a spreadsheet about an automaton.
              */}
              <th className="px-1.5 py-1 text-left font-normal text-k-text-faint">δ</th>
              {table.columns.map((column) => (
                <th
                  key={column.heading}
                  className="px-1.5 py-1 text-left font-medium text-k-text"
                  // The ε column is worth naming, because it is the one a reader may not
                  // expect and the one that explains why the machine is an ε-NFA.
                  title={column.symbol === undefined ? 'the empty string' : undefined}
                >
                  {column.heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <Row
                key={row.state}
                row={row}
                columns={table.columns}
                automaton={automaton}
                selected={selection.includes(row.state)}
                editing={editing?.row === row.state ? editing.column : undefined}
                onSelect={() => {
                  onSelect([row.state]);
                }}
                onEditCell={(column) => {
                  setEditing({ row: row.state, column });
                }}
                onCommit={(column, targets) => {
                  onEdit(row.state, table.columns[column]?.symbol ?? undefined, targets);
                  setEditing(undefined);
                }}
                onCancel={() => {
                  setEditing(undefined);
                }}
              />
            ))}
          </tbody>
        </table>
      </div>

      {!table.complete && (
        /*
          Stated rather than left for the reader to find by scanning for gaps. An incomplete δ
          is the most common reason a machine that looks finished rejects a string its author
          expected it to accept — the run gets *stuck* rather than rejecting, which is a
          distinction the input tester also draws.
        */
        <p className="mt-2 text-[11px] text-k-text-faint">
          δ is partial — some state has no move on some symbol, so a run can get stuck.
        </p>
      )}
    </Panel>
  );
}

function Row({
  row,
  columns,
  automaton,
  selected,
  editing,
  onSelect,
  onEditCell,
  onCommit,
  onCancel,
}: {
  row: TableRow;
  columns: Table['columns'];
  automaton: Automaton;
  selected: boolean;
  editing: number | undefined;
  onSelect: () => void;
  onEditCell: (column: number) => void;
  onCommit: (column: number, targets: StateId[]) => void;
  onCancel: () => void;
}) {
  return (
    <tr className={selected ? 'bg-k-primary/10' : 'hover:bg-k-primary/5'}>
      <th scope="row" className="px-1.5 py-1 text-left font-normal whitespace-nowrap">
        <button
          type="button"
          onClick={onSelect}
          className="text-k-text underline-offset-2 hover:underline"
        >
          {/*
            `→` and `*` rather than icons or colour, because this is the notation the textbook
            uses and because the table has to survive being printed in greyscale.
          */}
          <span className="text-k-text-faint">{row.start ? '→' : '  '}</span>
          <span className={row.accepting ? 'text-k-accepting' : ''}>
            {row.accepting ? '*' : ' '}
            {row.label}
          </span>
        </button>
      </th>

      {row.cells.map((targets, index) => (
        <Cell
          key={columns[index]?.heading ?? index}
          targets={targets}
          automaton={automaton}
          editing={editing === index}
          onEdit={() => {
            onEditCell(index);
          }}
          onCommit={(next) => {
            onCommit(index, next);
          }}
          onCancel={onCancel}
        />
      ))}
    </tr>
  );
}

function Cell({
  targets,
  automaton,
  editing,
  onEdit,
  onCommit,
  onCancel,
}: {
  targets: StateId[];
  automaton: Automaton;
  editing: boolean;
  onEdit: () => void;
  onCommit: (targets: StateId[]) => void;
  onCancel: () => void;
}) {
  const shown = targets.map((id) => labelOf(automaton, id)).join(', ');

  if (editing) {
    return (
      <td className="px-0.5 py-0.5">
        <CellEditor
          value={shown}
          onCommit={(text) => {
            onCommit(parseTargets(text, automaton));
          }}
          onCancel={onCancel}
        />
      </td>
    );
  }

  return (
    <td className="px-0.5 py-0.5">
      <button
        type="button"
        onClick={onEdit}
        className="w-full rounded px-1 py-0.5 text-left whitespace-nowrap hover:bg-k-primary/10"
      >
        {targets.length === 0 ? <span className="text-k-text-faint">{EMPTY_CELL}</span> : shown}
      </button>
    </td>
  );
}

function CellEditor({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(value);

  return (
    <input
      autoFocus
      value={text}
      onChange={(event) => {
        setText(event.target.value);
      }}
      onKeyDown={(event) => {
        // Never let the canvas see a state name being typed.
        event.stopPropagation();
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit(text);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
      // Same contract as the canvas's inline editor: clicking away commits, Escape abandons.
      // Two edit surfaces that disagree about what leaving a field means is two tools.
      onBlur={() => {
        onCommit(text);
      }}
      className="w-full min-w-16 rounded border border-k-primary bg-k-surface-raised px-1 py-0.5 font-mono text-xs text-k-text outline-none"
    />
  );
}

/** A state's label, or its id if the label has gone missing. */
function labelOf(automaton: Automaton, id: StateId): string {
  return automaton.states.find((state) => state.id === id)?.label ?? String(id);
}

/**
 * Read a cell back into state ids.
 *
 * Accepts labels, separated by commas or spaces — the same forgiving split the edge-label
 * parser uses, because it is the same gesture. Names that match nothing are dropped rather
 * than rejected: a cell is committed on blur, and refusing to commit would trap someone who
 * clicked away mid-typo. `∅` and an empty string both mean no targets.
 */
function parseTargets(text: string, automaton: Automaton): StateId[] {
  const names = text
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== EMPTY_CELL);

  const ids = names.flatMap((name) => {
    const state = automaton.states.find((candidate) => candidate.label === name);
    return state ? [state.id] : [];
  });

  return [...new Set(ids)];
}
