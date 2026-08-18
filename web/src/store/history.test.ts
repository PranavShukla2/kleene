import { describe, expect, it } from 'vitest';

import {
  addState,
  addTransition,
  deleteState,
  deleteSymbol,
  moveState,
  moveStates,
  deleteStates,
  setEdgeSymbols,
  setLayout,
  renameState,
  setStart,
  toggleAccepting,
  type Command,
} from '@/store/commands';
import { emptyDocument, type EditorDocument } from '@/store/document';
import {
  COALESCE_WINDOW_MS,
  canRedo,
  canUndo,
  historyOf,
  redo,
  redoLabel,
  run,
  undo,
  undoLabel,
  type History,
} from '@/store/history';

/** A document with three states and a couple of transitions, to edit against. */
function seeded(): EditorDocument {
  let history = historyOf(emptyDocument());
  for (const command of [
    addState({ x: 0, y: 0 }),
    addState({ x: 100, y: 0 }),
    addState({ x: 200, y: 0 }),
    addTransition(0, 1, 'a'),
    addTransition(1, 2, 'b'),
  ]) {
    history = run(history, command);
  }
  return history.present;
}

/** Run a list of commands, each at a distinct time so nothing coalesces by accident. */
function runAll(start: EditorDocument, commands: Command[]): History {
  return commands.reduce(
    (history, command, i) => run(history, command, i * 10_000),
    historyOf(start),
  );
}

describe('running commands', () => {
  it('applies the command and records a step', () => {
    const history = run(historyOf(emptyDocument()), addState({ x: 10, y: 20 }));
    expect(history.present.automaton.states).toHaveLength(1);
    expect(canUndo(history)).toBe(true);
  });

  it('does not record a command that changes nothing', () => {
    // Clicking "set start" on the state that is already the start should not cost an
    // undo press.
    const before = run(historyOf(emptyDocument()), addState({ x: 0, y: 0 }));
    const after = run(before, setStart(0));

    expect(after).toBe(before);
    expect(after.past).toHaveLength(1);
  });

  it('discards redo once a new edit branches the history', () => {
    // Keeping the future here would let undo walk into a document the user never had.
    let history = runAll(seeded(), [toggleAccepting(0)]);
    history = undo(history);
    expect(canRedo(history)).toBe(true);

    history = run(history, toggleAccepting(1));
    expect(canRedo(history)).toBe(false);
  });
});

describe('undo and redo', () => {
  it('returns exactly the document that preceded the command', () => {
    const start = seeded();
    const history = run(historyOf(start), deleteState(1));

    expect(history.present.automaton.states).toHaveLength(2);
    expect(undo(history).present).toEqual(start);
  });

  it('round-trips through undo and redo', () => {
    const start = seeded();
    const edited = run(historyOf(start), toggleAccepting(2));

    const there = undo(edited);
    const back = redo(there);

    expect(there.present).toEqual(start);
    expect(back.present).toEqual(edited.present);
  });

  it('walks back through a whole sequence, one step at a time', () => {
    const start = seeded();
    let history = runAll(start, [
      addState({ x: 300, y: 0 }),
      toggleAccepting(0),
      renameState(1, 'renamed'),
      addTransition(2, 0, 'c'),
      deleteState(0),
    ]);

    for (let i = 0; i < 5; i += 1) history = undo(history);

    expect(history.present).toEqual(start);
    expect(canUndo(history)).toBe(false);
  });

  it('does nothing when there is nothing to undo or redo', () => {
    const history = historyOf(seeded());
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  it('names what it would reverse', () => {
    const history = run(historyOf(seeded()), moveState(1, { x: 5, y: 5 }));
    expect(undoLabel(history)).toBe('move state');
    expect(redoLabel(undo(history))).toBe('move state');
    expect(undoLabel(historyOf(seeded()))).toBeUndefined();
  });
});

describe('coalescing', () => {
  it('collapses a drag into a single undo entry', () => {
    // The reason coalescing exists: a drag emits one command per pointer frame, and
    // reversing it should cost one undo press rather than two hundred.
    const start = seeded();
    let history = historyOf(start);

    for (let frame = 0; frame < 200; frame += 1) {
      history = run(history, moveState(1, { x: frame, y: 0 }), frame * 8);
    }

    expect(history.past).toHaveLength(1);
    expect(history.present.layout[1]).toEqual({ x: 199, y: 0 });
    expect(undo(history).present).toEqual(start);
  });

  it('undoes a drag to where the state started, not to the previous frame', () => {
    // The subtle half: coalescing must keep the *earliest* snapshot.
    const start = seeded();
    const before = start.layout[1];

    let history = historyOf(start);
    history = run(history, moveState(1, { x: 50, y: 50 }), 0);
    history = run(history, moveState(1, { x: 90, y: 90 }), 100);

    expect(undo(history).present.layout[1]).toEqual(before);
  });

  it('stops coalescing once the window has passed', () => {
    // Two deliberate moves are two edits, and should undo separately.
    let history = historyOf(seeded());
    history = run(history, moveState(1, { x: 10, y: 0 }), 0);
    history = run(history, moveState(1, { x: 20, y: 0 }), COALESCE_WINDOW_MS + 1);

    expect(history.past).toHaveLength(2);
  });

  it('does not coalesce moves of different states', () => {
    // Dragging one state and then another is two edits even in quick succession.
    let history = historyOf(seeded());
    history = run(history, moveState(1, { x: 10, y: 0 }), 0);
    history = run(history, moveState(2, { x: 10, y: 0 }), 10);

    expect(history.past).toHaveLength(2);
  });

  it('does not coalesce commands that have no key', () => {
    let history = historyOf(seeded());
    history = run(history, toggleAccepting(0), 0);
    history = run(history, toggleAccepting(1), 10);

    expect(history.past).toHaveLength(2);
  });
});

describe('every command is reversible', () => {
  // The plan's H1, property-style: run random sequences and assert that undoing all of
  // them returns exactly the document we started from. A command that forgets to restore
  // one field passes every hand-written test and fails here.
  const makeCommands = (): Command[] => [
    addState({ x: 42, y: 42 }),
    deleteState(1),
    moveState(2, { x: 7, y: 9 }),
    renameState(0, 'zz'),
    toggleAccepting(1),
    setStart(2),
    addTransition(0, 2, 'z'),
    addTransition(2, 2, 'a'),
    deleteSymbol('a'),
    // Added as the editor grew. A pool that stops being extended turns this property into a
    // guarantee about the oldest code and silence about the newest — which is exactly
    // backwards, since the newest is where the bugs are.
    moveStates([
      { id: 0, to: { x: 16, y: 16 } },
      { id: 1, to: { x: 32, y: 16 } },
    ]),
    deleteStates([0, 1]),
    setEdgeSymbols(0, 1, ['x', undefined]),
    setEdgeSymbols(1, 2, []),
    setLayout({ 0: { x: 8, y: 8 }, 2: { x: 64, y: 8 } }, 'auto-layout'),
  ];

  it('restores the exact document after any sequence', () => {
    const start = seeded();
    // Deterministic pseudo-random, so a failure is reproducible from the seed alone.
    let seed = 12345;
    const nextInt = (bound: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % bound;
    };

    for (let trial = 0; trial < 200; trial += 1) {
      const pool = makeCommands();
      const length = 1 + nextInt(6);
      const chosen = Array.from({ length }, () => pool[nextInt(pool.length)] as Command);

      let history = runAll(start, chosen);
      const depth = history.past.length;
      for (let i = 0; i < depth; i += 1) history = undo(history);

      expect(history.present).toEqual(start);
    }
  });

  it('redoing everything reaches the same document again', () => {
    const start = seeded();
    let history = runAll(start, [
      addState({ x: 1, y: 1 }),
      toggleAccepting(0),
      deleteState(2),
      addTransition(0, 1, 'q'),
    ]);

    const end = history.present;
    const depth = history.past.length;

    for (let i = 0; i < depth; i += 1) history = undo(history);
    expect(history.present).toEqual(start);

    for (let i = 0; i < depth; i += 1) history = redo(history);
    expect(history.present).toEqual(end);
  });
});

describe('batched commands', () => {
  const three = historyOf(seeded());

  it('collapse a multi-state move into one undo entry', () => {
    // Without this a three-state drag emits three commands per pointer frame, so undoing a
    // group drag takes dozens of presses and takes the group apart one state at a time on
    // the way back — a sequence of documents the user never had.
    const moved = run(
      three,
      moveStates([
        { id: 0, to: { x: 8, y: 8 } },
        { id: 1, to: { x: 108, y: 8 } },
      ]),
    );

    expect(moved.past).toHaveLength(1);
    expect(undo(moved).present.layout).toEqual(three.present.layout);
  });

  it('coalesce with the next frame of the same drag', () => {
    const first = run(three, moveStates([{ id: 0, to: { x: 8, y: 0 } }]), 1000);
    const second = run(first, moveStates([{ id: 0, to: { x: 16, y: 0 } }]), 1100);

    expect(second.past).toHaveLength(1);
    // Undo returns to where the drag began, not to the previous frame.
    expect(undo(second).present.layout[0]).toEqual(three.present.layout[0]);
  });

  it('do not coalesce a drag of a different group', () => {
    const first = run(three, moveStates([{ id: 0, to: { x: 8, y: 0 } }]), 1000);
    const second = run(first, moveStates([{ id: 1, to: { x: 108, y: 0 } }]), 1100);

    expect(second.past).toHaveLength(2);
  });

  it('are not recorded when every part is a no-op', () => {
    // The reduce returns the identical object, which is the contract `run` tests for.
    const nothing = run(three, moveStates([{ id: 0, to: three.present.layout[0]! }]));
    expect(nothing).toBe(three);
  });

  it('delete a whole selection in one press', () => {
    const deleted = run(three, deleteStates([0, 1]));

    expect(deleted.present.automaton.states.map((s) => s.id)).toEqual([2]);
    expect(deleted.past).toHaveLength(1);
    expect(undo(deleted).present.automaton.states).toHaveLength(3);
  });

  it('label a batch by how much it touches', () => {
    expect(deleteStates([0]).label).toBe('delete state');
    expect(deleteStates([0, 1]).label).toBe('delete 2 states');
  });
});

describe('state labels stay unique', () => {
  const three = historyOf(seeded());

  it('refuses a rename to a name another state already has', () => {
    // Two states called q1 make a diagram that cannot be read and a TikZ export that cannot
    // be compiled. Refused rather than silently disambiguated: a name the user did not
    // choose appearing on their own diagram is the worse outcome.
    const labels = three.present.automaton.states.map((s) => s.label);
    const taken = labels[1]!;

    expect(run(three, renameState(0, taken))).toBe(three);
  });

  it('allows renaming a state to the name it already has, as a no-op', () => {
    // The state's own name must not count as taken, or committing an unchanged edit would
    // be refused and the field would appear stuck.
    const own = three.present.automaton.states[0]!.label;
    expect(run(three, renameState(0, own))).toBe(three);
  });

  it('refuses an empty name', () => {
    expect(run(three, renameState(0, ''))).toBe(three);
  });

  it('allows a name that is free', () => {
    const renamed = run(three, renameState(0, 'start'));
    expect(renamed.present.automaton.states[0]?.label).toBe('start');
  });

  it('treats case as significant', () => {
    // q0 and Q0 are different names in every textbook this sits beside, and collapsing them
    // would be a stronger claim than uniqueness needs to make.
    const upper = three.present.automaton.states[1]!.label.toUpperCase();
    expect(run(three, renameState(0, upper)).present.automaton.states[0]?.label).toBe(upper);
  });
});
