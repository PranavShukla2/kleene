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
import { determinism } from '@/model/automaton';
import { normalize } from '@/store/document';
import { useActions, useDocument, useSelection, useUndoState } from '@/store/editor';
import { recoverDocument, useAutosave } from '@/store/useAutosave';
import { resolvedTheme, useTheme } from '@/theme';
import { loadEngine } from '@/wasm/loader';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; version: string }
  | { status: 'failed'; message: string };

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [helpOpen, setHelpOpen] = useState(false);
  const { choice, cycle } = useTheme();
  const autosave = useAutosave();
  const document = useDocument();
  const selection = useSelection();
  const undoState = useUndoState();
  const { load: loadDocument, undo, redo } = useActions();

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

        setLoad({ status: 'ready', version: engine.version() });
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

          <div className="flex gap-2">
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
            <div className="overflow-hidden rounded-[10px] border border-k-border">
              <Canvas
                automaton={document.automaton}
                layout={document.layout}
                selection={selection}
                title="The automaton being edited"
                className="h-[480px] w-full"
                onHelp={openHelp}
              />
            </div>
            <p className="-mt-3 text-sm text-k-text-faint">
              Scroll to zoom about the cursor. Hold space, or drag with the middle button, to
              pan. Press <kbd className="font-mono">?</kbd> for every shortcut.
            </p>

            <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <Fact label="Type" value={determinism(document.automaton)} />
              <Fact label="States" value={String(document.automaton.states.length)} />
              <Fact label="Selected" value={String(selection.length)} />
              <Fact label="Alphabet" value={`{${document.automaton.alphabet.join(', ')}}`} />
              <Fact label="Engine" value={`kleene-core ${load.version}`} />
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
