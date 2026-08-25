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
import { Tour } from '@/canvas/Tour';
import { DockPanel, DockRail } from '@/editor/Dock';
import { InstallButton } from '@/editor/InstallButton';
import { StatePalette } from '@/editor/StatePalette';
import { tourSeen } from '@/canvas/tourSeen';
import { ExportPanel } from '@/panels/Export';
import { droppedFile, isFileDrag, openFile, pickFile, saveFile } from '@/store/files';
import { SharePanel } from '@/panels/Share';
import { decode, payloadIn } from '@/store/share';
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
  clearCanvas,
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
  /**
   * The first-run tour (Phase 5 E6).
   *
   * Read synchronously on the first render rather than in an effect: a tour that appears a
   * frame after the editor has drawn is a thing that *arrives*, which is exactly how an
   * interruption feels. Read once, so dismissing it cannot be undone by a re-render.
   */
  const [tour, setTour] = useState(() => !tourSeen());
  /** A drag carrying a file is overhead, so the canvas says it will catch it (task D4). */
  const [dragging, setDragging] = useState(false);
  /**
   * Why the last open failed.
   *
   * Held rather than thrown: someone who drags the wrong file onto their work has made a
   * small mistake, and losing an hour of drawing to it would be a much larger one. The open
   * document is never touched until a file has parsed.
   */
  const [openError, setOpenError] = useState<string | undefined>(undefined);
  /**
   * What the last import had to change (Phase 4 Track E).
   *
   * Only ever produced by `.jff`, where JFLAP's model and Kleene's genuinely differ. Shown
   * because the alternative is a machine that quietly is not the one someone drew — and they
   * would find out at the worst possible moment, which is while being marked on it.
   */
  const [importNotes, setImportNotes] = useState<string[]>([]);
  /**
   * A machine that arrived in the URL and has not been accepted yet (task F7).
   *
   * Held rather than loaded, because **a link must never silently discard open work.** The
   * common case is someone with a half-drawn machine clicking a classmate's link; opening it
   * on top would be indistinguishable from losing their work, and they would have no way back.
   * So it waits, named, with both answers offered.
   */
  const [offered, setOffered] = useState<ReturnType<typeof normalize> | undefined>(undefined);
  const [input, setInput] = useState('');
  const [storedStep, setStep] = useState(0);
  const [laying, setLaying] = useState(false);
  const { choice, cycle } = useTheme();
  const { preferences, togglePanel, togglePanelId, closePanel } = usePreferences();
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
  /**
   * Take in a machine that arrived in the URL.
   *
   * Shared by the initial load and by `hashchange`, which is not a nicety: clicking a share
   * link while already in the editor changes *only the fragment*, and a browser does not
   * reload for that. Handling it on mount alone meant the link did nothing at all for the one
   * person most likely to click it — someone already using the tool.
   */
  const receiveShared = useCallback(
    async (payload: string, busy: boolean, stillLive: () => boolean = () => true) => {
      const document = await decode(payload);
      if (!stillLive()) return;

      if (!document) {
        setOpenError(
          'That link does not contain a machine. It may have been cut short — links are often ' +
            'wrapped by mail clients.',
        );
        return;
      }

      if (busy) setOffered(normalize(document));
      else loadDocument(normalize(document));
    },
    [loadDocument],
  );

  /*
    A share link arriving while the editor is already open.

    Always an *offer* here, never a straight load: by definition there is a document on screen
    that someone has been looking at, and replacing it without asking is the failure task F7
    exists to prevent.
  */
  useEffect(() => {
    const onHash = () => {
      const payload = payloadIn(window.location.hash);
      if (payload !== undefined) void receiveShared(payload, true);
    };

    window.addEventListener('hashchange', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
    };
  }, [receiveShared]);

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
        const shared = payloadIn(window.location.hash);

        /*
          A shared machine is decoded and *offered* rather than loaded, so that the decision
          below can still run. Whether it opens straight away depends on whether there is work
          to lose: with nothing but a default example on screen, opening it is obviously what
          the click meant; with a recovered session, it is not (task F7).
        */
        if (shared !== undefined) {
          const busy = recovered !== undefined && recovered.automaton.states.length > 0;
          void receiveShared(shared, busy, () => live);
        }

        if (handed) {
          loadDocument(
            normalize({
              automaton: handed,
              layout: rowLayout(handed.states.map((state) => state.id)),
            }),
          );
        } else if (shared !== undefined) {
          // Left alone: the decode above owns what happens next, and loading an example here
          // would flash a different machine on screen before the link's arrived.
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
    // `receiveShared` deliberately omitted. This effect is the *first* load and must run once;
    // including it would re-run the whole engine-and-recovery sequence whenever the callback's
    // identity changed, which would flash a second machine on screen. The hashchange listener
    // above is what keeps up with later links.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /** Open a file, replacing the document only once it has parsed. */
  const open = (file: File | undefined) => {
    if (!file || load.status !== 'ready') return;
    const engine = load.engine;
    void openFile(engine, file).then((result) => {
      if (result.ok) {
        loadDocument(normalize(result.document));
        setOpenError(undefined);
        setImportNotes(result.notes ?? []);
      } else {
        setOpenError(result.message);
      }
    });
  };

  return (
    /*
      A workbench, not a page with a tool on it (roadmap §2.8). `h-dvh` and `overflow-hidden`
      rather than a growing document: the window is the frame, the canvas fills it, and
      nothing scrolls the tool off screen. On the 1366×768 laptop design-system §1.5 names as
      the target machine, the previous centred column spent a third of the width on margins.
    */
    <div
      className="relative flex h-dvh flex-col overflow-hidden bg-k-bg text-k-text"
      /*
        The drop target is the whole editor, not the canvas alone. Someone dragging a file
        aims at the window, and a drop landing two pixels outside the canvas that does nothing
        reads as the feature being broken.

        `dragover` must call `preventDefault` or the browser navigates to the file, replacing
        the app with a JSON document — the default behaviour, and a spectacular way to lose
        someone's work.
      */
      onDragOver={(event) => {
        if (!isFileDrag(event.nativeEvent)) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        // Only once the pointer has left the editor entirely. `dragleave` also fires when it
        // crosses between children, and reacting to that makes the overlay flicker.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        open(droppedFile(event.nativeEvent));
      }}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-k-bg/80 backdrop-blur-sm">
          <p className="rounded-2xl border-2 border-dashed border-k-primary bg-k-surface px-6 py-4 text-sm font-medium text-k-primary">
            Drop a .kln file to open it
          </p>
        </div>
      )}

      {offered !== undefined && (
        /*
          Task F7. Two answers, both named, neither destructive by default — and the machine
          stays in the URL either way, so "keep mine" is not a decision anyone has to get right
          the first time.
        */
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 border-b border-k-primary/40 bg-k-primary/10 px-3 py-2 text-sm"
        >
          <span className="flex-1 text-k-text">
            This link contains a machine
            {offered.automaton.states.length > 0 &&
              ` (${String(offered.automaton.states.length)} states)`}
            . Your current work is still open.
          </span>
          <button
            type="button"
            onClick={() => {
              loadDocument(offered);
              setOffered(undefined);
            }}
            className="rounded-full bg-k-primary px-3 py-1 text-xs font-medium text-white"
          >
            Open it
          </button>
          <button
            type="button"
            onClick={() => {
              setOffered(undefined);
            }}
            className="rounded-full border border-k-border px-3 py-1 text-xs text-k-text-muted hover:border-k-border-strong hover:text-k-text"
          >
            Keep mine
          </button>
        </div>
      )}

      {importNotes.length > 0 && (
        /*
          Not an error — the file opened. This is the difference between two tools' models,
          stated once, and dismissible.
        */
        <div className="flex items-start gap-3 border-b border-k-warning/40 bg-k-warning/10 px-3 py-2 text-sm text-k-warning">
          <div className="flex-1">
            <p className="font-medium">Imported, with changes:</p>
            <ul className="mt-1 list-disc pl-5">
              {importNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => {
              setImportNotes([]);
            }}
            className="font-mono text-xs opacity-70 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}

      {openError !== undefined && (
        /*
          Beside the work rather than over it, and dismissible. The document is untouched — the
          only thing that failed is the attempt to replace it — so this is information, not an
          interruption.
        */
        <div
          role="alert"
          className="flex shrink-0 items-start gap-3 border-b border-k-error/40 bg-k-error/10 px-3 py-2 text-sm text-k-error"
        >
          <span className="flex-1">{openError}</span>
          <button
            type="button"
            onClick={() => {
              setOpenError(undefined);
            }}
            className="font-mono text-xs opacity-70 hover:opacity-100"
          >
            dismiss
          </button>
        </div>
      )}

      {/*
        The editor's heading, for readers who navigate by one.
        Visually hidden rather than shown, because the page is a workbench and a title bar
        would cost 40px of canvas to tell a sighted user what the wordmark, the tab title and
        the entire screen already tell them. Screen reader users get no such redundancy: this
        page had no `h1` at all, so jumping by heading found nothing.
      */}
      <h1 className="sr-only">Automaton editor</h1>
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
        onClear={() => {
          run(clearCanvas(ids));
        }}
        onOpen={() => {
          void pickFile().then(open);
        }}
        onSave={() => {
          if (load.status === 'ready') saveFile(load.engine, document, document.meta?.title);
        }}
        onHelp={openHelp}
        onHome={onHome}
        themeLabel={themeLabel(choice)}
        onCycleTheme={cycle}
      />

      {/*
        `<main>` in both branches, not only the ready one. The editor had no landmark at all —
        the command bar is a banner and the status bar is contentinfo, so there was nothing
        between them for a screen reader to skip to, on the one page where the content *is*
        the product.
      */}
      {load.status !== 'ready' ? (
        <main className="flex flex-1 items-center justify-center p-6">
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
        </main>
      ) : (
        /* `min-h-0` is what lets the canvas column actually shrink inside a flex parent —
           without it a flex child refuses to go below its content height and the canvas
           pushes the status bar off the bottom of the window. */
        /* `relative`, because the dock's rail and its panels are positioned against this. */
        <main className="relative flex min-h-0 flex-1">
          {/* `pr-13` reserves the rail's width. The panels themselves float *over* the canvas
              rather than pushing it: a drawer that resizes the diagram every time it opens
              moves the thing you were looking at, and on the table — which is read against
              the diagram — that is the worst possible moment to move it. */}
          <div className="relative flex min-w-0 flex-1 flex-col pr-13">
            <Canvas
              automaton={perf ? perf.automaton : document.automaton}
              layout={perf ? perf.layout : layout}
              selection={perf ? [] : selection}
              active={perf ? [] : active}
              title="The automaton being edited"
              className="min-h-0 flex-1"
              onHelp={openHelp}
            />

            {tour && (
              <Tour
                onDone={() => {
                  setTour(false);
                }}
              />
            )}

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

            {/* Not gated on the canvas being empty. The chip is how someone learns states can
                be placed, and hiding it the moment they succeed once takes the affordance away
                at exactly the point they have started using it. */}
            <StatePalette />

            {/* Above the problem strip, not over it: a bottom panel takes its height from
                the column. See the note in Dock.tsx — hiding "3 states are unreachable" is
                worst at the moment someone opened the table to work out why. */}
            <DockPanel open={preferences.openPanel} onClose={closePanel}>
              {preferences.openPanel === 'selection' && (
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
              )}

              {preferences.openPanel === 'table' && (
                <TransitionTablePanel
                  table={table}
                  automaton={document.automaton}
                  selection={selection}
                  onSelect={select}
                  onEdit={editCell}
                />
              )}

              {preferences.openPanel === 'test' && (
                <InputTester
                  simulation={simulation}
                  input={input}
                  onInput={setInput}
                  step={step}
                  onStep={setStep}
                />
              )}

              {preferences.openPanel === 'define' && (
                <div className="flex flex-col gap-2.5">
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
                </div>
              )}

              {preferences.openPanel === 'export' && (
                <div className="flex flex-col gap-2.5">
                  <ExportPanel
                    engine={load.engine}
                    automaton={document.automaton}
                    layout={layout}
                  />
                  <SharePanel
                    document={document}
                    onSaveInstead={() => {
                      saveFile(load.engine, document, document.meta?.title);
                    }}
                  />
                </div>
              )}
            </DockPanel>

            {/* Docked against the canvas, not below the fold (J5). A problem list you have
                to scroll to find is a problem list nobody reads. */}
            <Validation report={report} onFocus={focusStates} />
          </div>

          <DockRail open={preferences.openPanel} onToggle={togglePanelId} />
        </main>
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
  onClear,
  onOpen,
  onSave,
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
  onClear: () => void;
  /** Pick a `.kln` and open it. */
  onOpen: () => void;
  /** Write the current document to a file. */
  onSave: () => void;
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
      {/* With Arrange and Shake, because all three act on the whole canvas rather than on a
          selection. No confirmation: it is one undo away, and `canArrange` already means
          "there is something here", which is exactly when clearing is possible. */}
      <ToolButton
        onClick={onClear}
        disabled={!canArrange}
        title="Remove every state and transition. Undo brings them back"
      >
        Clear
      </ToolButton>

      <Divider />

      <ToolButton onClick={onOpen} title="Open a .kln file, or import a JFLAP .jff">
        Open
      </ToolButton>
      <ToolButton onClick={onSave} title="Save this machine as a .kln file">
        Save
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
        {/* Beside the theme and the help key: things about the app rather than about the
            machine. It removes itself once the app is installed. */}
        <InstallButton />
        <ToolButton onClick={onHelp} title="Keyboard shortcuts">
          ?
        </ToolButton>
      </div>
    </header>
  );
}

function Divider() {
  return <span aria-hidden className="h-4 w-px shrink-0 bg-k-border" />;
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
      {/*
        Phase 5 E7. "saved" on its own is a claim someone will read as "saved somewhere" —
        a server, an account, a thing that survives clearing site data. It does not. The
        account-free path has to say what it lacks, plainly and once, and the honest place
        for it is beside the word that would otherwise mislead.

        A title rather than a banner: the fact matters at the moment someone wonders about
        it, and a permanent notice about storage in an editor is a nag.
      */}
      <span
        className="ml-auto"
        title="Saved in this browser only — IndexedDB, no account, no server, not synced between devices. Use Save to keep a .kln file, or Share to put the machine in a link."
      >
        {autosave}
      </span>
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
