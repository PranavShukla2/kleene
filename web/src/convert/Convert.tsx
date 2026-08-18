/**
 * `/convert` — type a regular expression, watch it become a machine.
 *
 * Phase 3's home. The bar compiles as you type; the panes below show every stage of the
 * pipeline that produces. All three come from **one** call to the engine, so they cannot
 * disagree about which expression they are describing.
 */

import { useMemo, useState } from 'react';

import { DiagramView } from '@/canvas/DiagramView';
import { wrappedRowLayout } from '@/canvas/geometry';
import { DEFAULT_PANES, PANES, reduction, type PaneId } from '@/convert/panes';
import { RegexBar } from '@/convert/RegexBar';
import { Scrubber } from '@/convert/Scrubber';
import { clampStep, highlighted, readStepFrom, stepFragment } from '@/convert/scrubbing';
import { useCompiler } from '@/convert/useCompiler';
import type { Automaton, Compilation, Stage, StateId } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';

/** The empty-string glyph. From the engine once D7 makes notation a setting; ε until then. */
const EPSILON = 'ε';

export function Convert({
  engine,
  onOpenInEditor,
}: {
  engine: Engine | undefined;
  /** Hand a stage to the editor, so a converted machine can be edited by hand. */
  onOpenInEditor: (automaton: Automaton) => void;
}) {
  const [source, setSource] = useState('');
  const [shown, setShown] = useState<readonly PaneId[]>(DEFAULT_PANES);
  // Which ε-NFA states the hovered DFA state was built from (task B3).
  const [origin, setOrigin] = useState<readonly StateId[]>([]);
  // One step position per pane. Seeded from the URL fragment so a link to round four opens
  // there (task C7); after that the fragment follows the scrubber rather than driving it.
  const [steps, setSteps] = useState<Partial<Record<PaneId, number>>>(() =>
    Object.fromEntries(
      PANES.flatMap((pane) => {
        const from = readStepFrom(window.location.hash, pane.id);
        return from === undefined ? [] : [[pane.id, from]];
      }),
    ),
  );

  const compilation = useCompiler(engine, source);
  const parsed = compilation?.kind === 'parsed' ? compilation : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Convert</h1>
      <p className="mt-3 max-w-prose text-k-text-muted">
        Type a regular expression and watch it become a machine — through Thompson&rsquo;s
        construction, subset construction, and minimization. Every stage below comes from one
        pass over what you typed, so no two panes can be describing different expressions.
      </p>

      <div className="mt-8">
        <RegexBar
          source={source}
          onChange={setSource}
          compilation={compilation}
          epsilon={EPSILON}
        />
      </div>

      {parsed && (
        <>
          <PaneToggles shown={shown} onChange={setShown} parsed={parsed} />

          <div
            className={`mt-4 grid gap-4 ${
              // Two panes side by side is the most a 1366×768 laptop reads comfortably, which
              // is what decision D9 is about. A third stacks rather than shrinking the others.
              shown.length > 1 ? 'lg:grid-cols-2' : ''
            }`}
          >
            {PANES.filter((pane) => shown.includes(pane.id)).map((pane) => {
              const stage = pane.stageOf(parsed);
              const step = clampStep(steps[pane.id] ?? 0, stage.steps);

              return (
                <Pane
                  key={pane.id}
                  title={pane.title}
                  subtitle={pane.subtitle}
                  stage={stage}
                  source={source}
                  note={pane.id === 'minimal' ? reduction(parsed) : undefined}
                  step={step}
                  onStep={(next) => {
                    setSteps((current) => ({ ...current, [pane.id]: next }));
                    // Replace rather than push: scrubbing thirty rounds must not put thirty
                    // entries in the back button, but the address bar still holds a link
                    // worth copying at every one of them.
                    window.history.replaceState(
                      null,
                      '',
                      window.location.pathname + stepFragment(pane.id, next),
                    );
                  }}
                  // Two highlights, two sources. Hovering a DFA state points at the ε-NFA
                  // states it came from; scrubbing points at the states the *step* is about.
                  // The scrubber wins where they collide, because it is the deliberate act.
                  highlight={
                    highlighted(step, stage.steps).length > 0
                      ? highlighted(step, stage.steps)
                      : pane.id === 'nfa'
                        ? origin
                        : []
                  }
                  onHoverState={pane.id === 'nfa' ? undefined : setOrigin}
                  onOpenInEditor={() => {
                    onOpenInEditor(stage.automaton);
                  }}
                />
              );
            })}
          </div>
        </>
      )}

      {!parsed && (
        <p className="mt-10 text-sm text-k-text-faint">The machines appear here as you type.</p>
      )}

      {parsed && (
        <p className="mt-8 max-w-prose text-sm text-k-text-faint">
          Every sentence under a scrubber was written in Rust, beside the line of the algorithm
          that made that move. Nothing on this page composes an explanation from what it can see
          in the result.
        </p>
      )}
    </main>
  );
}

/**
 * Which panes to show.
 *
 * Toggles rather than a dropdown, because the answer is usually "these two" and a dropdown
 * makes a two-item answer into two interactions. The state count sits on the toggle so the
 * minimal DFA can answer "could it be smaller?" while its pane is still closed — which is
 * most of what someone wants from it most of the time.
 */
function PaneToggles({
  shown,
  onChange,
  parsed,
}: {
  shown: readonly PaneId[];
  onChange: (next: readonly PaneId[]) => void;
  parsed: Extract<Compilation, { kind: 'parsed' }>;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      {PANES.map((pane) => {
        const on = shown.includes(pane.id);
        const count = pane.stageOf(parsed).automaton.states.length;

        return (
          <button
            key={pane.id}
            type="button"
            aria-pressed={on}
            onClick={() => {
              // Never allow zero panes. A page that can be emptied by clicking its own
              // controls looks broken, and there is nothing useful on the other side of it.
              const next = on ? shown.filter((id) => id !== pane.id) : [...shown, pane.id];
              if (next.length > 0) onChange(next);
            }}
            className={`rounded-full border px-3 py-1 font-mono text-xs transition-colors duration-(--duration-k-hover) ${
              on
                ? 'border-k-primary bg-k-primary/10 text-k-primary'
                : 'border-k-border text-k-text-muted hover:border-k-border-strong hover:text-k-text'
            }`}
          >
            {pane.title} <span className="opacity-60">{count}</span>
          </button>
        );
      })}

      {reduction(parsed) && (
        // Task B4: "that number is the entire argument for minimization".
        <span className="ml-auto font-mono text-xs text-k-text-faint">
          minimization: <span className="text-k-secondary">{reduction(parsed)}</span>
        </span>
      )}
    </div>
  );
}

function Pane({
  title,
  subtitle,
  stage,
  source,
  note,
  step,
  onStep,
  highlight,
  onHoverState,
  onOpenInEditor,
}: {
  title: string;
  subtitle: string;
  stage: Stage;
  source: string;
  note: string | undefined;
  step: number;
  onStep: (next: number) => void;
  highlight: readonly StateId[];
  onHoverState: ((origin: readonly StateId[]) => void) | undefined;
  onOpenInEditor: () => void;
}) {
  // Wrapped, because Thompson's construction produces chains: `(a|b)*abb` is fourteen states
  // and over 1300px on one line, which a pane can only show at a third size. Eight per row
  // keeps a pane's aspect ratio close to the box it is drawn in.
  const layout = useMemo(
    () =>
      wrappedRowLayout(
        stage.automaton.states.map((state) => state.id),
        8,
      ),
    [stage.automaton.states],
  );

  return (
    <section className="overflow-hidden rounded-[10px] border border-k-border bg-k-surface">
      <header className="flex items-baseline justify-between gap-3 border-b border-k-border px-4 py-2.5">
        <h2 className="font-medium">
          {title}
          <span className="ml-2 text-sm font-normal text-k-text-faint">{subtitle}</span>
        </h2>
        <div className="flex items-baseline gap-3">
          {note && <span className="font-mono text-xs text-k-secondary">{note}</span>}
          <span className="font-mono text-xs text-k-text-faint">
            {stage.automaton.states.length} states
          </span>
          {/*
            The link the editor was missing. Someone who converts an expression and then wants
            to change the machine by hand had, until now, no route from one to the other.
          */}
          <button
            type="button"
            onClick={onOpenInEditor}
            className="font-mono text-xs text-k-text-faint underline decoration-dotted underline-offset-4 transition-colors duration-(--duration-k-hover) hover:text-k-text"
          >
            edit →
          </button>
        </div>
      </header>

      <div
        className="p-4"
        onPointerLeave={() => {
          onHoverState?.([]);
        }}
      >
        <DiagramView
          automaton={stage.automaton}
          layout={layout}
          selection={highlight}
          title={`${title} for ${source}`}
          className="h-64 w-full rounded-md border border-k-border"
          onHoverState={
            onHoverState &&
            ((id) => {
              const state = stage.automaton.states.find((candidate) => candidate.id === id);
              onHoverState(state?.origin ?? []);
            })
          }
        />
      </div>

      <Scrubber steps={stage.steps} step={step} onStep={onStep} label={`${subtitle} steps`} />
    </section>
  );
}
