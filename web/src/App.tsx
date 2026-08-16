/**
 * Phase 0's whole deliverable: prove the vertical slice.
 *
 * Rust compiles to wasm, wasm loads in React, React renders an automaton, and the result is
 * a URL that can be sent to someone. The scope is deliberately tiny — one machine, no
 * interaction — but the quality bar is not lowered, because this renderer is the one Phase 2
 * extends and this screen is what every screenshot shows for the next three months.
 */

import { useEffect, useState } from 'react';

import { AutomatonView } from '@/canvas/AutomatonView';
import { determinism, type Automaton } from '@/model/automaton';
import { resolvedTheme, useTheme } from '@/theme';
import { loadEngine } from '@/wasm/loader';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; automaton: Automaton; version: string }
  | { status: 'failed'; message: string };

export function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const { choice, cycle } = useTheme();

  useEffect(() => {
    let live = true;

    loadEngine()
      .then((engine) => {
        if (!live) return;
        setLoad({
          status: 'ready',
          automaton: engine.example('ends_with_ab'),
          version: engine.version(),
        });
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
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-k-bg text-k-text">
      <Header themeLabel={themeLabel(choice)} onCycleTheme={cycle} />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
        <section>
          <h1 className="text-2xl font-semibold tracking-tight">Strings ending in ab</h1>
          <p className="mt-2 max-w-prose text-k-text-muted">
            A deterministic finite automaton over the alphabet{' '}
            <code className="font-mono text-k-text">{'{a, b}'}</code>, accepting exactly those
            strings whose last two symbols are <code className="font-mono text-k-text">ab</code>
            . Built in Rust, compiled to WebAssembly, rendered here as SVG.
          </p>
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

        {load.status === 'ready' && (
          <>
            <div className="overflow-hidden rounded-[10px] border border-k-border bg-k-canvas">
              <AutomatonView
                automaton={load.automaton}
                title="DFA accepting strings over {a, b} that end in ab"
                className="h-[320px] w-full"
              />
            </div>

            <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              <Fact label="Type" value={determinism(load.automaton)} />
              <Fact label="States" value={String(load.automaton.states.length)} />
              <Fact label="Alphabet" value={`{${load.automaton.alphabet.join(', ')}}`} />
              <Fact label="Engine" value={`kleene-core ${load.version}`} />
              <Fact label="Theme" value={resolvedTheme(choice)} />
            </dl>
          </>
        )}
      </main>

      <Footer />
    </div>
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
        Phase 0 — proving the toolchain. The editor, the conversion pipeline and TikZ export
        come next.
      </div>
    </footer>
  );
}

function themeLabel(choice: ReturnType<typeof useTheme>['choice']): string {
  return choice === 'system' ? 'system' : choice;
}
