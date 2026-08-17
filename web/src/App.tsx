/**
 * The editor.
 *
 * The document in the store is the single source of truth on screen. The engine's example is
 * *loaded into* that document on a first visit rather than rendered beside it — which is what
 * makes every edit undoable, autosaved and recoverable without anything here knowing that.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Canvas } from '@/canvas/Canvas';
import { rowLayout } from '@/canvas/geometry';
import { ShortcutSheet } from '@/canvas/ShortcutSheet';
import { useShortcuts } from '@/canvas/useShortcuts';
import { requestedPerfSize, syntheticMachine } from '@/canvas/synthetic';
import type { Determinism, Report, Simulation, StateId } from '@/model/automaton';
import { Alphabet } from '@/panels/Alphabet';
import { DeterminismBadge } from '@/panels/DeterminismBadge';
import { InputTester } from '@/panels/InputTester';
import { activeStates, clampStep } from '@/panels/simulation';
import { Properties } from '@/panels/Properties';
import { Validation } from '@/panels/Validation';
import { addSymbol, deleteSymbol, setStart, toggleAccepting } from '@/store/commands';
import { normalize } from '@/store/document';
import { useActions, useDocument, useSelection, useUndoState } from '@/store/editor';
import { recoverDocument, useAutosave } from '@/store/useAutosave';
import { resolvedTheme, useTheme } from '@/theme';
import { loadEngine, type Engine } from '@/wasm/loader';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; engine: Engine }
  | { status: 'failed'; message: string };

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [helpOpen, setHelpOpen] = useState(false);
  const [input, setInput] = useState('');
  const [storedStep, setStep] = useState(0);
  const { choice, cycle } = useTheme();
  const autosave = useAutosave();
  const document = useDocument();
  const selection = useSelection();
  const undoState = useUndoState();
  const { load: loadDocument, undo, redo, run, select } = useActions();

  // A measurement instrument, not a feature: `?perf=60` renders a synthetic machine of that
  // size so the Phase 2 B6 frame-rate floor can be measured rather than assumed.
  const perf = useMemo(() => {
    const size = requestedPerfSize(window.location.search);
    return size ? syntheticMachine(size) : undefined;
  }, []);

  // Load the engine, and seed the document from its example only when nothing was recovered.
  // Both are awaited together deliberately: recovery is asynchronous, and seeding before it
  // resolves would overwrite the work the user is coming back to — the one thing autosave
  // exists to prevent.
  useEffect(() => {
    let live = true;

    Promise.all([loadEngine(), recoverDocument()])
      .then(([engine, recovered]) => {
        if (!live) return;

        if (recovered && recovered.automaton.states.length > 0) {
          loadDocument(recovered);
        } else {
          const automaton = engine.example('ends_with_ab');
          loadDocument(
            normalize({
              automaton,
              layout: rowLayout(automaton.states.map((state) => state.id)),
            }),
          );
        }

        setLoad({ status: 'ready', engine });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setLoad({
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error.',
        });
      });

    return () => {
      live = false;
    };
  }, [loadDocument]);

  const engine = load.status === 'ready' ? load.engine : undefined;

  // Recomputed whenever the machine changes, and *only* when the machine changes — dragging a
  // state moves the layout and must not re-run validation on every pointer frame.
  const report = useMemo<Report | undefined>(
    () => engine?.validate(document.automaton),
    [engine, document.automaton],
  );
  const kind = useMemo<Determinism | undefined>(
    () => engine?.determinism(document.automaton),
    [engine, document.automaton],
  );

  // Only run once the machine is well-formed enough to run. Simulating a document with a
  // dangling transition would ask the engine a question about a machine that does not exist,
  // and the honest answer to "does this accept ab?" while it is malformed is "fix it first" —
  // which the strip is already saying.
  const runnable = report !== undefined && !report.problems.some((p) => p.severity === 'error');

  const simulation = useMemo<Simulation | undefined>(
    () => (engine && runnable ? engine.simulate(document.automaton, input) : undefined),
    [engine, runnable, document.automaton, input],
  );

  // Clamped on read rather than corrected when the run changes — see `clampStep`.
  const step = clampStep(storedStep, simulation?.run.configurations.length ?? 0);
  const active = activeStates(simulation, step);

  // Clicking a problem selects the states it names. Selecting rather than merely scrolling to
  // them: the next thing anyone does after finding the broken state is edit it.
  const focusStates = useCallback(
    (states: StateId[]) => {
      select(states);
    },
    [select],
  );

  const openHelp = useCallback(() => {
    setHelpOpen(true);
  }, []);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
  }, []);

  // Undo and redo live here rather than on the canvas, because they are document-level and
  // must keep working when the pointer is nowhere near the diagram. Two `useShortcuts` calls
  // compose without conflict: each claims only the ids it has a handler for.
  useShortcuts({ undo, redo });

  return (
    <div className="flex min-h-dvh flex-col bg-k-bg text-k-text">
      <Header themeLabel={themeLabel(choice)} onCycleTheme={cycle} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Editor</h1>
            <p className="mt-2 max-w-prose text-k-text-muted">
              Double-click to add a state, or a state to toggle whether it accepts. Drag from a
              state&rsquo;s edge to draw a transition. Everything is undoable and saved as you
              work — there is no server, so it never leaves this browser.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <DeterminismBadge value={kind} />
            <ToolButton onClick={undo} disabled={!undoState.canUndo}>
              {undoState.undoLabel ? `Undo ${undoState.undoLabel}` : 'Undo'}
            </ToolButton>
            <ToolButton onClick={redo} disabled={!undoState.canRedo}>
              Redo
            </ToolButton>
            <ToolButton onClick={openHelp}>?</ToolButton>
          </div>
        </section>

        {load.status === 'loading' && <Panel>Loading the engine…</Panel>}

        {load.status === 'failed' && (
          <Panel tone="error">
            <p className="font-medium">{load.message}</p>
            <p className="mt-1 text-sm text-k-text-muted">
              This usually means the WebAssembly build is missing. Run{' '}
              <code className="font-mono">npm run wasm</code> and reload.
            </p>
          </Panel>
        )}

        {perf && (
          <div className="overflow-hidden rounded-[10px] border border-k-border">
            <Canvas
              automaton={perf.automaton}
              layout={perf.layout}
              selection={[]}
              title={`Synthetic ${perf.automaton.states.length}-state machine`}
              className="h-[520px] w-full"
            />
          </div>
        )}

        {!perf && load.status === 'ready' && (
          <>
            {/*
              Canvas and sidebar, not canvas and a stack of panels underneath. The panels are
              a reference the user glances at *while* editing — the determinism badge only
              teaches anything if it is visible at the moment an edit changes it, which it
              cannot be if it lives below the fold.
            */}
            <div className="flex flex-col gap-4 lg:flex-row">
              <div className="min-w-0 flex-1 overflow-hidden rounded-[10px] border border-k-border">
                <Canvas
                  automaton={document.automaton}
                  layout={document.layout}
                  selection={selection}
                  active={active}
                  title="The automaton being edited"
                  className="h-[480px] w-full"
                  onHelp={openHelp}
                />
              </div>

              <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72">
                <Properties
                  automaton={document.automaton}
                  selection={selection}
                  onToggleAccepting={(id) => {
                    run(toggleAccepting(id));
                  }}
                  onSetStart={(id) => {
                    run(setStart(id));
                  }}
                  // Renaming is an inline edit on the canvas, so the panel asks for it by
                  // selecting the state and letting the canvas's own Enter binding do the
                  // work. A second rename field here would be a second place for the
                  // uniqueness rule to be enforced, or forgotten.
                  onRename={(id) => {
                    select([id]);
                  }}
                />
                <InputTester
                  simulation={simulation}
                  input={input}
                  onInput={setInput}
                  step={step}
                  onStep={setStep}
                />
                <Alphabet
                  automaton={document.automaton}
                  onAdd={(symbol) => {
                    run(addSymbol(symbol));
                  }}
                  onRemove={(symbol) => {
                    run(deleteSymbol(symbol));
                  }}
                />
              </aside>
            </div>

            <Validation report={report} onFocus={focusStates} />

            <p className="text-sm text-k-text-faint">
              Scroll to zoom about the cursor. Hold space, or drag with the middle button, to
              pan. Press <kbd className="font-mono">?</kbd> for every shortcut.
            </p>

            <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <Fact label="States" value={String(document.automaton.states.length)} />
              <Fact label="Selected" value={String(selection.length)} />
              <Fact label="Transitions" value={String(document.automaton.transitions.length)} />
              <Fact label="Engine" value={`kleene-core ${load.engine.version()}`} />
              <Fact label="Theme" value={resolvedTheme(choice)} />
              <Fact
                label="Autosave"
                value={autosave.failed ? 'failed' : autosave.pending ? 'saving…' : 'saved'}
              />
            </dl>
          </>
        )}
      </main>

      <Footer />
      <ShortcutSheet open={helpOpen} onClose={closeHelp} />
    </div>
  );
}

function ToolButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-k-border px-3 py-1.5 text-sm text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text disabled:opacity-40 disabled:hover:border-k-border"
    >
      {children}
    </button>
  );
}

function Header({
  themeLabel,
  onCycleTheme,
}: {
  themeLabel: string;
  onCycleTheme: () => void;
}) {
  return (
    <header className="border-b border-k-border">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-lg font-medium tracking-tight text-k-primary">
            kleene
          </span>
          <span className="text-sm text-k-text-faint">automata workbench</span>
        </div>

        <button
          type="button"
          onClick={onCycleTheme}
          className="rounded-md border border-k-border px-3 py-1.5 text-sm text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text"
        >
          Theme: {themeLabel}
        </button>
      </div>
    </header>
  );
}

function Panel({ children, tone }: { children: React.ReactNode; tone?: 'error' }) {
  return (
    <div
      className={`rounded-[10px] border px-4 py-3 ${
        tone === 'error'
          ? 'border-k-error/40 bg-k-error/5 text-k-error'
          : 'border-k-border bg-k-surface text-k-text-muted'
      }`}
    >
      {children}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-[0.06em] text-k-text-faint uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-k-text">{value}</dd>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-k-border">
      <div className="mx-auto w-full max-w-5xl px-6 py-4 text-sm text-k-text-faint">
        Phase 2 — building the editor. The engine is complete: regular expressions convert to
        NFAs, DFAs and minimal DFAs, and back to regular expressions, with every step explained.
        Panels, the input tester and automatic layout come next.
      </div>
    </footer>
  );
}

function themeLabel(choice: ReturnType<typeof useTheme>['choice']): string {
  return choice === 'system' ? 'system' : choice;
}
