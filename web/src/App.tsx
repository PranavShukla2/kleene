/**
 * The editor.
 *
 * The document in the store is the single source of truth on screen. The engine's example is
 * *loaded into* that document on a first visit rather than rendered beside it — which is what
 * makes every edit undoable, autosaved and recoverable without anything here knowing that.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { Canvas } from '@/canvas/Canvas';
import { EmptyCanvas } from '@/canvas/EmptyCanvas';
import { rowLayout } from '@/canvas/geometry';
import { ShortcutSheet } from '@/canvas/ShortcutSheet';
import { useShortcuts } from '@/canvas/useShortcuts';
import { requestedPerfSize, syntheticMachine } from '@/canvas/synthetic';
import type {
  Determinism,
  FormalDefinition,
  Report,
  Simulation,
  StateId,
  TransitionTable,
} from '@/model/automaton';
import { Alphabet } from '@/panels/Alphabet';
import { DeterminismBadge } from '@/panels/DeterminismBadge';
import { InputTester } from '@/panels/InputTester';
import { activeStates, clampStep } from '@/panels/simulation';
import { FormalDefinitionPanel } from '@/panels/FormalDefinition';
import { Properties } from '@/panels/Properties';
import { TransitionTablePanel } from '@/panels/TransitionTable';
import { Validation } from '@/panels/Validation';
import { autoLayout, hasOverlap, shake } from '@/layout/auto';
import { useAnimatedLayout } from '@/layout/useAnimatedLayout';
import {
  addSymbol,
  deleteSymbol,
  setEdgeSymbols,
  setLayout,
  setStart,
  toggleAccepting,
} from '@/store/commands';
import { requestedExample } from '@/router';
import { takeHandOff } from '@/store/handoff';
import { normalize } from '@/store/document';
import { usePreferences } from '@/store/preferences';
import { useActions, useDocument, useSelection, useUndoState } from '@/store/editor';
import { recoverDocument, useAutosave } from '@/store/useAutosave';
import { resolvedTheme, useTheme } from '@/theme';
import { loadEngine, type Engine } from '@/wasm/loader';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; engine: Engine }
  | { status: 'failed'; message: string };

export function Editor({ onHome }: { onHome: () => void }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [helpOpen, setHelpOpen] = useState(false);
  const [input, setInput] = useState('');
  const [storedStep, setStep] = useState(0);
  const [laying, setLaying] = useState(false);
  const { choice, cycle } = useTheme();
  const { preferences, togglePanel } = usePreferences();
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

        // Three sources, ranked by how explicit the request is.
        //
        // 1. A machine handed over from another page — the most explicit thing there is: the
        //    user pressed a button that says "edit this", one click ago.
        // 2. An `?example=` in the URL. They asked for that machine; restoring their last
        //    session instead would look like the link was broken.
        // 3. Whatever autosave recovered. The ordinary return visit, and what autosave is for.
        const handed = takeHandOff();
        const wanted = requestedExample(window.location.search);

        if (handed) {
          loadDocument(
            normalize({
              automaton: handed,
              layout: rowLayout(handed.states.map((state) => state.id)),
            }),
          );
        } else if (wanted === undefined && recovered && recovered.automaton.states.length > 0) {
          loadDocument(recovered);
        } else {
          // An unknown key falls back rather than failing. A stale link in a lecture slide
          // should open *something*, not an error about a machine that has been renamed.
          let automaton;
          try {
            automaton = engine.example(wanted ?? 'ends_with_ab');
          } catch {
            automaton = engine.example('ends_with_ab');
          }
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
  const table = useMemo<TransitionTable | undefined>(
    () => engine?.transitionTable(document.automaton),
    [engine, document.automaton],
  );
  const definition = useMemo<FormalDefinition | undefined>(
    () => engine?.formalDefinition(document.automaton),
    [engine, document.automaton],
  );

  /**
   * Commit an edited table cell.
   *
   * Expressed as a set of edges rather than as "add this, remove that": a cell *is* the set of
   * states reachable from one state on one symbol, so replacing it wholesale is what the user
   * typed. Each affected pair goes through `setEdgeSymbols`, the same command the canvas uses
   * for a label — so undo does not care which surface the edit came from.
   */
  const editCell = useCallback(
    (from: StateId, symbol: string | undefined, targets: StateId[]) => {
      const previous = document.automaton.transitions
        .filter((t) => t.from === from && (t.on ?? undefined) === symbol)
        .map((t) => t.to);

      const removed = previous.filter((id) => !targets.includes(id));
      const added = targets.filter((id) => !previous.includes(id));
      if (removed.length === 0 && added.length === 0) return;

      for (const to of removed) {
        const rest = document.automaton.transitions
          .filter((t) => t.from === from && t.to === to && (t.on ?? undefined) !== symbol)
          .map((t) => t.on);
        run(setEdgeSymbols(from, to, rest));
      }
      for (const to of added) {
        const existing = document.automaton.transitions
          .filter((t) => t.from === from && t.to === to)
          .map((t) => t.on);
        run(setEdgeSymbols(from, to, [...existing, symbol]));
      }
    },
    [document.automaton, run],
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

  // Rendered positions, which differ from the stored ones only while a rearrangement plays.
  const { layout, animateFrom, animating } = useAnimatedLayout(document.layout);
  const ids = useMemo(
    () => document.automaton.states.map((state) => state.id),
    [document.automaton.states],
  );

  /** Apply a new layout: one command, then animate the rendering from where things were. */
  const applyLayout = useCallback(
    (next: Record<number, { x: number; y: number }>, label: string) => {
      const before = document.layout;
      run(setLayout(next, label));
      animateFrom(before);
    },
    [document.layout, run, animateFrom],
  );

  const layOut = useCallback(() => {
    setLaying(true);
    void autoLayout(document.automaton)
      .then((next) => {
        applyLayout(next, 'auto-layout');
      })
      .finally(() => {
        setLaying(false);
      });
  }, [document.automaton, applyLayout]);

  const shakeOut = useCallback(() => {
    applyLayout(shake(document.layout, ids), 'shake apart');
  }, [document.layout, ids, applyLayout]);

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
  // `togglePanel` joins the table like every other binding, so it appears in the `?` sheet
  // without anyone remembering to add it there (J6).
  useShortcuts({ undo, redo, togglePanel });

  return (
    /*
      A workbench, not a page with a tool on it (roadmap §2.8). `h-dvh` and `overflow-hidden`
      rather than a growing document: the window is the frame, the canvas fills it, and
      nothing scrolls the tool off screen. On the 1366×768 laptop design-system §1.5 names as
      the target machine, the previous centred column spent a third of the width on margins.
    */
    <div className="flex h-dvh flex-col overflow-hidden bg-k-bg text-k-text">
      <CommandBar
        kind={kind}
        undoState={undoState}
        onUndo={undo}
        onRedo={redo}
        onArrange={layOut}
        onShake={shakeOut}
        arranging={laying || animating}
        canArrange={document.automaton.states.length > 0}
        canShake={!animating && hasOverlap(document.layout, ids)}
        panelOpen={preferences.panelOpen}
        onTogglePanel={togglePanel}
        onHelp={openHelp}
        onHome={onHome}
        themeLabel={themeLabel(choice)}
        onCycleTheme={cycle}
      />

      {load.status !== 'ready' ? (
        <div className="flex flex-1 items-center justify-center p-6">
          {load.status === 'loading' ? (
            <Panel>Loading the engine…</Panel>
          ) : (
            <Panel tone="error">
              <p className="font-medium">{load.message}</p>
              <p className="mt-1 text-sm text-k-text-muted">
                This usually means the WebAssembly build is missing. Run{' '}
                <code className="font-mono">npm run wasm</code> and reload.
              </p>
            </Panel>
          )}
        </div>
      ) : (
        /* `min-h-0` is what lets the canvas column actually shrink inside a flex parent —
           without it a flex child refuses to go below its content height and the canvas
           pushes the status bar off the bottom of the window. */
        <div className="flex min-h-0 flex-1">
          <div className="relative flex min-w-0 flex-1 flex-col">
            <Canvas
              automaton={perf ? perf.automaton : document.automaton}
              layout={perf ? perf.layout : layout}
              selection={perf ? [] : selection}
              active={perf ? [] : active}
              title="The automaton being edited"
              className="min-h-0 flex-1"
              onHelp={openHelp}
            />

            {document.automaton.states.length === 0 && (
              <EmptyCanvas
                onOpenExample={() => {
                  const automaton = load.engine.example('ends_with_ab');
                  loadDocument(
                    normalize({
                      automaton,
                      layout: rowLayout(automaton.states.map((state) => state.id)),
                    }),
                  );
                }}
              />
            )}

            {/* Docked against the canvas, not below the fold (J5). A problem list you have
                to scroll to find is a problem list nobody reads. */}
            <Validation report={report} onFocus={focusStates} />
          </div>

          <SidePanel open={preferences.panelOpen} onClose={togglePanel}>
            <Properties
              automaton={document.automaton}
              selection={selection}
              onToggleAccepting={(id) => {
                run(toggleAccepting(id));
              }}
              onSetStart={(id) => {
                run(setStart(id));
              }}
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
            <TransitionTablePanel
              table={table}
              automaton={document.automaton}
              selection={selection}
              onSelect={select}
              onEdit={editCell}
            />
            <FormalDefinitionPanel definition={definition} />
            <Alphabet
              automaton={document.automaton}
              onAdd={(symbol) => {
                run(addSymbol(symbol));
              }}
              onRemove={(symbol) => {
                run(deleteSymbol(symbol));
              }}
            />
          </SidePanel>
        </div>
      )}

      <StatusBar
        states={document.automaton.states.length}
        transitions={document.automaton.transitions.length}
        selected={selection.length}
        engine={load.status === 'ready' ? load.engine.version() : undefined}
        theme={resolvedTheme(choice)}
        autosave={autosave.failed ? 'failed' : autosave.pending ? 'saving…' : 'saved'}
      />

      <ShortcutSheet open={helpOpen} onClose={closeHelp} />
    </div>
  );
}

/**
 * The one bar across the top.
 *
 * Everything that acts on the whole document, in a single 44px row. The alternative — a title
 * block, a toolbar, and a hint paragraph — is three rows of chrome above a canvas that then has
 * nowhere to go, on a screen whose vertical pixels are the scarcest thing about it.
 *
 * Grouped left to right by what the buttons touch: identity, then what the machine *is*, then
 * what changes it, then the view, then help. Undo sits with the layout buttons rather than at
 * the far end, because roadmap §7 asks auto-layout to be visibly undoable and the most direct
 * way to promise that is to put the undo beside the thing that needs it.
 */
function CommandBar({
  kind,
  undoState,
  onUndo,
  onRedo,
  onArrange,
  onShake,
  arranging,
  canArrange,
  canShake,
  panelOpen,
  onTogglePanel,
  onHelp,
  onHome,
  themeLabel: theme,
  onCycleTheme,
}: {
  kind: Determinism | undefined;
  undoState: ReturnType<typeof useUndoState>;
  onUndo: () => void;
  onRedo: () => void;
  onArrange: () => void;
  onShake: () => void;
  arranging: boolean;
  canArrange: boolean;
  canShake: boolean;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onHelp: () => void;
  onHome: () => void;
  themeLabel: string;
  onCycleTheme: () => void;
}) {
  return (
    /*
      The command bar takes the site's type and radii but keeps its own density. That split is
      the whole decision: a workbench earns its screen by fitting more on it, so the bar stays
      44px tall and its controls stay tight — but there is no reason for the wordmark, the
      corner radius and the focus ring to differ from the rest of the site, and a visitor
      clicking the biggest button on the front page should not feel they left the product.
    */
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-k-border bg-k-surface/85 px-3 backdrop-blur">
      {/*
        L5: the wordmark goes home from here too. The editor is the one page someone can arrive
        at directly — a shared link, a bookmark — and a page you can reach but not leave is the
        specific failure that makes a site feel broken rather than unfinished.

        A real anchor with a real `href`, so middle-click and "open in new tab" behave, and an
        `onClick` that routes instead of reloading. Either half alone is worse: a button cannot
        be opened in a tab, and a bare link throws away the running app to render the page it
        could have shown in a frame.
      */}
      <a
        href="/"
        onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          onHome();
        }}
        className="k-gradient-text rounded-full font-mono text-sm font-semibold tracking-tight transition-opacity duration-(--duration-k-hover) hover:opacity-80"
      >
        kleene
      </a>
      <DeterminismBadge value={kind} />

      <Divider />

      <ToolButton
        onClick={onArrange}
        disabled={arranging || !canArrange}
        title="Arrange the states left to right"
      >
        {arranging ? 'Arranging…' : 'Arrange'}
      </ToolButton>
      <ToolButton onClick={onShake} disabled={!canShake} title="Push overlapping states apart">
        Shake
      </ToolButton>

      <Divider />

      <ToolButton onClick={onUndo} disabled={!undoState.canUndo}>
        {undoState.undoLabel ? `Undo ${undoState.undoLabel}` : 'Undo'}
      </ToolButton>
      <ToolButton onClick={onRedo} disabled={!undoState.canRedo}>
        Redo
      </ToolButton>

      {/* Everything after this pushes to the right: view and help, not editing. */}
      <div className="ml-auto flex items-center gap-2">
        <ToolButton onClick={onCycleTheme} title="Cycle theme">
          {theme}
        </ToolButton>
        <ToolButton onClick={onHelp} title="Keyboard shortcuts">
          ?
        </ToolButton>
        <ToolButton
          onClick={onTogglePanel}
          title={panelOpen ? 'Hide the panels' : 'Show the panels'}
          aria-expanded={panelOpen}
        >
          {/* The glyph shows the panel, not an abstract arrow, so it reads the same whichever
              side of the toggle you are on. */}
          {panelOpen ? '▨' : '▤'}
        </ToolButton>
      </div>
    </header>
  );
}

function Divider() {
  return <span aria-hidden className="h-4 w-px shrink-0 bg-k-border" />;
}

/**
 * The collapsible panel column.
 *
 * J2 and J7. **The diagram is the only permanent surface** — closing this leaves a canvas and
 * a command bar, which is design-system §1.1 stated as geometry rather than as an aspiration.
 *
 * Below `lg` it becomes a sheet over the canvas instead of a column beside it. A 288px column
 * next to a canvas on a tablet leaves neither usable, and building a second layout for small
 * screens is how two layouts drift apart.
 */
function SidePanel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <aside
      aria-label="Panels"
      className="absolute inset-y-0 right-0 z-30 flex w-80 shrink-0 flex-col gap-2.5 overflow-y-auto border-l border-k-border bg-k-surface/60 p-3 shadow-lg backdrop-blur lg:static lg:z-auto lg:w-72 lg:shadow-none"
    >
      {/* Only reachable below `lg`, where the panel covers the canvas and the command bar's
          toggle may be behind it. */}
      <button
        type="button"
        onClick={onClose}
        className="self-end rounded-full px-2 py-0.5 font-mono text-xs text-k-text-faint hover:text-k-text lg:hidden"
      >
        close
      </button>
      {children}
    </aside>
  );
}

/**
 * The thin readout along the bottom.
 *
 * Facts about the document that are worth glancing at and never worth reading: counts, the
 * engine version, whether the work is saved. One row, monospace, and deliberately the least
 * prominent thing on screen — design-system §1.1 again.
 */
function StatusBar({
  states,
  transitions,
  selected,
  engine,
  theme,
  autosave,
}: {
  states: number;
  transitions: number;
  selected: number;
  engine: string | undefined;
  theme: string;
  autosave: string;
}) {
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-k-border bg-k-surface/70 px-3 font-mono text-[11px] text-k-text-faint backdrop-blur">
      <span>{states} states</span>
      <span>{transitions} transitions</span>
      {selected > 0 && <span className="text-k-primary">{selected} selected</span>}
      <span className="ml-auto">{autosave}</span>
      <span>{theme}</span>
      {engine && <span>kleene-core {engine}</span>}
    </footer>
  );
}

function ToolButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      // Pills, matching the site. The padding stays tighter than a marketing button's,
      // because a command bar with six controls cannot afford marketing spacing.
      className="rounded-full border border-k-border px-3 py-1 text-sm text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text disabled:opacity-40 disabled:hover:border-k-border"
    >
      {children}
    </button>
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

function themeLabel(choice: ReturnType<typeof useTheme>['choice']): string {
  return choice === 'system' ? 'system' : choice;
}
