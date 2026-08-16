import { describe, expect, it } from 'vitest';

import {
  addState,
  addTransition,
  deleteState,
  deleteSymbol,
  moveState,
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
