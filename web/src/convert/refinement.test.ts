import { describe, expect, it } from 'vitest';

import {
  blockIndex,
  cellState,
  rounds,
  separated,
  splitAt,
  triangle,
  witnessOf,
} from '@/convert/refinement';
import type { Cell, MarkingTable, Minimization, Split } from '@/model/automaton';

/** Four states: A and B merge, C and D are told apart in successive rounds. */
const SPLITS: Split[] = [
  { round: 0, partition: [[0, 1, 2], [3]], from: null, into: [], evidence: null },
  {
    round: 1,
    partition: [[0, 1], [2], [3]],
    from: [0, 1, 2],
    into: [[0, 1], [2]],
    evidence: { left: 0, right: 2, witness: 'b' },
  },
  { round: 2, partition: [[0, 1], [2], [3]], from: null, into: [], evidence: null },
];

const TABLE: MarkingTable = {
  states: [0, 1, 2, 3],
  cells: [
    { row: 1, col: 0, mark: null },
    { row: 2, col: 0, mark: { round: 1, witness: 'b' } },
    { row: 2, col: 1, mark: { round: 1, witness: 'b' } },
    { row: 3, col: 0, mark: { round: 0, witness: '' } },
    { row: 3, col: 1, mark: { round: 0, witness: '' } },
    { row: 3, col: 2, mark: { round: 0, witness: '' } },
  ],
};

const MINIMIZATION = { splits: SPLITS, table: TABLE } as unknown as Minimization;

describe('blockIndex', () => {
  it('maps every state to the block holding it', () => {
    const index = blockIndex(SPLITS[1]?.partition ?? []);
    expect(index.get(0)).toBe(0);
    expect(index.get(1)).toBe(0);
    expect(index.get(2)).toBe(1);
    expect(index.get(3)).toBe(2);
  });
});

describe('splitAt', () => {
  it('clamps rather than returning nothing for a step past the end', () => {
    // Reached by a stale URL pointing at a step the expression no longer has.
    expect(splitAt(MINIMIZATION, 99)).toBe(SPLITS[2]);
    expect(splitAt(MINIMIZATION, -4)).toBe(SPLITS[0]);
  });

  it('has nothing to say about a trace with no steps', () => {
    expect(splitAt({ splits: [] } as unknown as Minimization, 0)).toBeUndefined();
  });
});

describe('separated', () => {
  it('reads the partition rather than the round number', () => {
    // A round can contain several splits, so "round 2" is not a moment. A table that filled
    // in a whole round at once would jump ahead of the diagram beside it.
    expect(separated(SPLITS[0], 0, 2)).toBe(false);
    expect(separated(SPLITS[1], 0, 2)).toBe(true);
  });

  it('says accepting and non-accepting are apart from the very first step', () => {
    expect(separated(SPLITS[0], 0, 3)).toBe(true);
  });

  it('never separates a state from itself', () => {
    expect(separated(SPLITS[2], 1, 1)).toBe(false);
  });

  it('leaves equivalent states together at the end', () => {
    expect(separated(SPLITS[2], 0, 1)).toBe(false);
  });
});

describe('cellState', () => {
  const cell = (row: number, col: number): Cell =>
    TABLE.cells.find((c) => c.row === row && c.col === col) ?? TABLE.cells[0]!;

  it('marks a pair as fresh on the step that separates it', () => {
    expect(cellState(cell(2, 0), SPLITS[1], SPLITS[0])).toBe('fresh');
  });

  it('marks it as old on every step after', () => {
    expect(cellState(cell(2, 0), SPLITS[2], SPLITS[1])).toBe('marked');
  });

  it('leaves an equivalent pair open forever', () => {
    for (const at of [0, 1, 2]) {
      expect(cellState(cell(1, 0), SPLITS[at], SPLITS[at - 1])).toBe('open');
    }
  });

  it('treats the first step as having no previous', () => {
    // Round 0 separates accepting from non-accepting, and that *is* news on step one.
    expect(cellState(cell(3, 0), SPLITS[0], undefined)).toBe('fresh');
  });
});

describe('rounds', () => {
  it('groups consecutive steps of one round', () => {
    expect(rounds(SPLITS)).toEqual([
      { round: 0, from: 0, to: 0 },
      { round: 1, from: 1, to: 1 },
      { round: 2, from: 2, to: 2 },
    ]);
  });

  it('keeps several splits of one round together', () => {
    const many: Split[] = [
      { round: 0, partition: [], from: null, into: [], evidence: null },
      { round: 1, partition: [], from: null, into: [], evidence: null },
      { round: 1, partition: [], from: null, into: [], evidence: null },
      { round: 2, partition: [], from: null, into: [], evidence: null },
    ];
    expect(rounds(many)).toEqual([
      { round: 0, from: 0, to: 0 },
      { round: 1, from: 1, to: 2 },
      { round: 2, from: 3, to: 3 },
    ]);
  });
});

describe('triangle', () => {
  it('drops the row and column the lower triangle has no cell for', () => {
    const { rows, columns } = triangle(TABLE);
    expect(rows).toEqual([1, 2, 3]);
    expect(columns).toEqual([0, 1, 2]);
  });

  it('finds a cell by its pair', () => {
    const { cellAt } = triangle(TABLE);
    expect(cellAt(2, 0)?.mark?.witness).toBe('b');
    // The upper half has no cells: the relation is symmetric, so drawing both would be
    // drawing the same fact twice.
    expect(cellAt(0, 2)).toBeUndefined();
  });
});

describe('witnessOf', () => {
  it('shows the empty-string glyph rather than nothing at all', () => {
    // A blank cell where the witness should be reads as missing data, when in fact the empty
    // string is the answer — one state accepts and the other does not.
    expect(witnessOf('', 'ε')).toBe('ε');
    expect(witnessOf('ab', 'ε')).toBe('ab');
  });
});
