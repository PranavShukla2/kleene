/**
 * `/convert` — type a regular expression, watch it become a machine.
 *
 * Phase 3's home. The bar compiles as you type; the panes below show every stage of the
 * pipeline that produces. All three come from **one** call to the engine, so they cannot
 * disagree about which expression they are describing.
 */

import { useCallback, useMemo, useState } from 'react';

import { DiagramView } from '@/canvas/DiagramView';
import { wrappedRowLayout } from '@/canvas/geometry';
import { ClosureDrill } from '@/convert/ClosureDrill';
import { construction, partial } from '@/convert/construction';
import { DEFAULT_PANES, PANES, reduction, type PaneId } from '@/convert/panes';
import { RegexBar } from '@/convert/RegexBar';
import { Scrubber } from '@/convert/Scrubber';
import { StepTable } from '@/convert/StepTable';
import { clampStep, highlighted, readStepFrom, stepFragment } from '@/convert/scrubbing';
import { useCompiler } from '@/convert/useCompiler';
import { Worklist } from '@/convert/Worklist';
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
  // Which ε-NFA states the open ε-closure drill-down is on (task D4).
  const [closure, setClosure] = useState<readonly StateId[]>([]);
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

  /**
   * The ε-NFA states the DFA pane's step is talking about (task D2, widened).
   *
   * B3 gave this to hover; scrubbing wants it too, because the whole claim of subset
   * construction is that a DFA state *is* a set of NFA states, and the moment to see that is
   * while the round that builds it is on screen.
   *
   * Derived from the step rather than pushed by the scrubber's callback, so a deep link
   * straight into round four arrives with the subset already lit rather than waiting for an
   * interaction that will never come.
   */
  // Stable, because the drill-down pushes its focus from an effect and an identity that
  // changed every render would make that effect a loop.
  const focusClosure = useCallback((ids: readonly StateId[]) => {
    setClosure(ids);
  }, []);

  const subsetInPlay = useMemo(() => {
    if (!parsed || !shown.includes('dfa')) return [];
    const stage = parsed.dfa;
    return highlighted(clampStep(steps.dfa ?? 0, stage.steps), stage.steps);
  }, [parsed, shown, steps.dfa]);

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
            className={`mt-4 grid items-start gap-4 ${
              // Two panes side by side is the most a 1366×768 laptop reads comfortably, which
              // is what decision D9 is about. A third stacks rather than shrinking the others.
              //
              // `items-start` because the panes now differ in height: a pane showing δ and a
              // worklist is taller than one showing neither, and stretching left a slab of
              // empty surface under the shorter one's reasoning.
              shown.length > 1 ? 'lg:grid-cols-2' : ''
            }`}
          >
            {PANES.filter((pane) => shown.includes(pane.id)).map((pane) => {
              const stage = pane.stageOf(parsed);
              const step = clampStep(steps[pane.id] ?? 0, stage.steps);

              return (
                <Pane
                  key={pane.id}
                  engine={engine}
                  // The closure drill-down always computes in the ε-NFA, whichever pane asked.
                  nfa={parsed.nfa.automaton}
                  onClosureFocus={pane.id === 'nfa' ? undefined : focusClosure}
                  // Open under the derived panes, where watching δ fill in is the point, and
                  // shut under the ε-NFA, whose table is fourteen rows of ε and teaches
                  // nothing that the diagram does not say more clearly.
                  defaultTable={pane.id !== 'nfa'}
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
                  /*
                    Only the ε-NFA pane takes a highlight from outside. The two derived
                    panes mark themselves from their own frames, which is the fix for a
                    quiet mistake: `step.highlight` on a subset-construction step holds
                    *ε-NFA* ids, and feeding those to the DFA diagram lit up whichever DFA
                    states happened to share those numbers.

                    Priority, for the pane that does take one: what the pointer is on, then
                    an open ε-closure drill-down, then what this pane's own scrubber says,
                    then the subset the DFA pane is working on. Hover first because it is the
                    live gesture, and the drill-down next because it is the narrower question
                    — someone who opened it is asking about those states specifically.
                  */
                  highlight={
                    pane.id !== 'nfa'
                      ? []
                      : origin.length > 0
                        ? origin
                        : closure.length > 0
                          ? closure
                          : (steps.nfa ?? 0) > 0
                            ? highlighted(step, stage.steps)
                            : subsetInPlay
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
  engine,
  nfa,
  onClosureFocus,
  defaultTable,
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
  engine: Engine | undefined;
  nfa: Automaton;
  onClosureFocus: ((ids: readonly StateId[]) => void) | undefined;
  defaultTable: boolean;
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

  // How much of this machine existed at the step being shown, and what the step did to it.
  // Unframed traces — Thompson's, which glues fragments rather than growing a prefix —
  // report everything present, so this pane behaves exactly as it did before.
  const at = useMemo(
    () => construction(stage.automaton, stage.steps, step),
    [stage.automaton, stage.steps, step],
  );
  const drawn = useMemo(() => partial(stage.automaton, at), [stage.automaton, at]);

  // A framed pane marks itself: the subset being expanded, and the one just arrived at.
  const marked = at.framed
    ? [at.current, at.arrived].filter((id): id is StateId => id !== undefined)
    : highlight;

  const [tableOpen, setTableOpen] = useState(defaultTable);

  // Built from the finished machine and then filtered, rather than rebuilt per step. Which
  // columns a table has is a property of the alphabet, and an alphabet does not grow during
  // subset construction — so a table whose columns appeared one at a time would be inventing
  // a change the algorithm never makes.
  const table = useMemo(
    () => (tableOpen ? engine?.transitionTable(stage.automaton) : undefined),
    [engine, stage.automaton, tableOpen],
  );

  // Memoised: the drill-down keys a wasm call and an effect on this array, and a fresh one
  // every render would make both fire forever.
  const seeds = useMemo(() => stage.steps[step]?.seeds ?? [], [stage.steps, step]);

  const highlightOrigin =
    onHoverState &&
    ((id: StateId | undefined) => {
      const state = stage.automaton.states.find((candidate) => candidate.id === id);
      onHoverState(state?.origin ?? []);
    });

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
            {/*
              Counted against the total while the machine is still being built, because "3 of
              5" is the sentence a reader wants there — how far along, not how big it ends up.
            */}
            {at.present.size < stage.automaton.states.length
              ? `${String(at.present.size)} of ${String(stage.automaton.states.length)} states`
              : `${String(stage.automaton.states.length)} states`}
          </span>
          {/*
            The link the editor was missing. Someone who converts an expression and then wants
            to change the machine by hand had, until now, no route from one to the other.
          */}
          <button
            type="button"
            aria-pressed={tableOpen}
            onClick={() => {
              setTableOpen((open) => !open);
            }}
            className={`font-mono text-xs transition-colors duration-(--duration-k-hover) ${
              tableOpen ? 'text-k-primary' : 'text-k-text-faint hover:text-k-text'
            }`}
            title="Show the transition table, filling in as you scrub"
          >
            δ
          </button>
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
          automaton={drawn}
          layout={layout}
          selection={marked}
          entering={{
            state: at.fresh ? at.arrived : undefined,
            edge: at.drew,
            // An arrival at a state that already existed. The step created nothing, and
            // without a mark of its own it would look as though nothing happened — which is
            // the misreading that has students inventing a new state per arrow.
            recognised: at.fresh ? undefined : at.arrived,
          }}
          title={`${title} for ${source}`}
          className="h-64 w-full rounded-md border border-k-border"
          onHoverState={highlightOrigin}
        />
      </div>

      {table && (
        <StepTable
          table={table}
          automaton={stage.automaton}
          at={at}
          onHoverState={highlightOrigin}
        />
      )}

      {/*
        Between the diagram and the scrubber deliberately. The scrubber is the control, the
        diagram is the result, and the worklist is the algorithm's own state — which belongs
        with the thing being controlled rather than with the controls.
      */}
      <Worklist automaton={stage.automaton} at={at} onHoverState={highlightOrigin} />

      {onClosureFocus && (
        <ClosureDrill engine={engine} nfa={nfa} seeds={seeds} onFocus={onClosureFocus} />
      )}

      <Scrubber steps={stage.steps} step={step} onStep={onStep} label={`${subtitle} steps`} />
    </section>
  );
}
