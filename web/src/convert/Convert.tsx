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
import { MarkingTable } from '@/convert/MarkingTable';
import { Partitions } from '@/convert/Partitions';
import { splitAt } from '@/convert/refinement';
import { DEFAULT_PANES, PANES, reduction, type PaneId } from '@/convert/panes';
import { RegexBar } from '@/convert/RegexBar';
import { Scrubber } from '@/convert/Scrubber';
import { StepTable } from '@/convert/StepTable';
import { clampStep, highlighted, readStepFrom, stepFragment } from '@/convert/scrubbing';
import { useCompiler } from '@/convert/useCompiler';
import { Worklist } from '@/convert/Worklist';
import type {
  Automaton,
  Compilation,
  Minimization as MinimizationOf,
  Stage,
  StateId,
} from '@/model/automaton';
import { requestedExpression } from '@/router';
import type { Engine } from '@/wasm/loader';

/** The empty-string glyph. From the engine once D7 makes notation a setting; ε until then. */
const EPSILON = 'ε';

export function Convert({
  engine,
  onOpenInEditor,
  embedded,
}: {
  engine: Engine | undefined;
  /** Hand a stage to the editor, so a converted machine can be edited by hand. */
  onOpenInEditor: (automaton: Automaton) => void;
  /**
   * Rendered inside a `/tools/*` page rather than as `/convert` itself.
   *
   * Two differences, both about what the surrounding page already said: the heading is gone
   * (the tool page has its own, and two `h1`s is a worse document than one) and the starting
   * expression and panes come from the task rather than from the URL.
   *
   * Everything else is identical, deliberately. A cut-down converter for the landing pages
   * would be a second implementation of the one thing this project exists to have exactly one
   * of.
   */
  embedded?: { source: string; panes: readonly PaneId[] };
}) {
  // Seeded from the URL, so a link — or the command palette — can open the page with an
  // expression already compiling. Read once: after that the bar owns the value, and a URL
  // that kept overriding it would fight the person typing.
  const [source, setSource] = useState(
    () => embedded?.source ?? requestedExpression(window.location.search) ?? '',
  );
  const [shown, setShown] = useState<readonly PaneId[]>(embedded?.panes ?? DEFAULT_PANES);
  // Which ε-NFA states the hovered DFA state was built from (task B3).
  const [origin, setOrigin] = useState<readonly StateId[]>([]);
  // Which ε-NFA states the open ε-closure drill-down is on (task D4).
  const [closure, setClosure] = useState<readonly StateId[]>([]);
  /**
   * Which DFA states the refinement views are pointing at (tasks E1, E8).
   *
   * Hovering a block or a marking-table cell lights the states it names in the DFA pane. The
   * ids come from refinement's own machine, which is the DFA restricted and completed — so a
   * trap state added by completion simply matches nothing, which is the right outcome rather
   * than one worth guarding against.
   */
  const [refineFocus, setRefineFocus] = useState<readonly StateId[]>([]);
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

  /*
    A `<main>` on its own page, and a plain `<div>` inside a tool page, which brings its own.
    Making this component embeddable turned it into a `<div>` unconditionally, which quietly
    cost `/convert` its only landmark — the page still looked right and had nothing for a
    screen reader to skip to.
  */
  const Frame = embedded ? 'div' : 'main';

  return (
    <Frame
      className={`relative mx-auto w-full max-w-6xl px-6 pb-4 ${embedded ? 'pt-2' : 'pt-10'}`}
    >
      {/*
        A wash behind the bar and nothing else. The panes below are diagrams, and design-system
        §1.1 keeps decoration away from those — but the top of a page a stranger may land on
        directly should still look like the rest of the site. Not when embedded: the tool page
        has its own, and two of them stack into a bruise.
      */}
      {!embedded && (
        <div
          aria-hidden
          className="k-aurora pointer-events-none absolute inset-x-0 -top-24 h-80 opacity-60"
        />
      )}

      {/*
        Suppressed inside a tool page, which has its own heading. Two `h1`s is a worse document
        than one, and the second would be restating what the first already said.
      */}
      {!embedded && (
        <div className="relative">
          <span className="font-mono text-xs tracking-wider text-k-primary uppercase">
            Convert
          </span>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Type an expression. Watch it become a machine.
          </h1>
          <p className="mt-3 max-w-prose text-k-text-muted">
            Thompson&rsquo;s construction, then subset construction, then minimization. Every
            stage below comes from one pass over what you typed, so no two panes can be
            describing different expressions.
          </p>
        </div>
      )}

      <div className={`relative ${embedded ? '' : 'mt-8'}`}>
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
                  refineFrom={pane.id === 'minimal' ? parsed.dfa.automaton : undefined}
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
                  highlight={paneHighlight(pane.id, {
                    origin,
                    closure,
                    refineFocus,
                    ownStep: (steps.nfa ?? 0) > 0 ? highlighted(step, stage.steps) : [],
                    subsetInPlay,
                  })}
                  onHoverState={pane.id === 'nfa' ? undefined : setOrigin}
                  onSourceHighlight={setRefineFocus}
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
    </Frame>
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

/**
 * Which states a pane marks, given everything competing to say.
 *
 * A function rather than a nested ternary in the JSX. It was four levels deep and about to be
 * five, and the ordering *is* the design — each branch is a judgement about which of two
 * simultaneous signals a reader meant.
 */
function paneHighlight(
  pane: PaneId,
  from: {
    origin: readonly StateId[];
    closure: readonly StateId[];
    refineFocus: readonly StateId[];
    ownStep: readonly StateId[];
    subsetInPlay: readonly StateId[];
  },
): readonly StateId[] {
  // The DFA is the machine refinement runs on, so it is the pane the block and marking-table
  // hovers point into.
  if (pane === 'dfa') return from.refineFocus;

  // Only the ε-NFA takes a highlight from elsewhere: a subset-construction step's `highlight`
  // holds ε-NFA ids, and feeding those to any other diagram lights whichever states happen to
  // share those numbers.
  if (pane !== 'nfa') return [];

  // Hover first, because it is the live gesture. Then an open ε-closure drill-down, which is
  // the narrower question. Then this pane's own scrubber, ahead of another pane's, because a
  // scrubber you moved should not be overruled by one you did not.
  if (from.origin.length > 0) return from.origin;
  if (from.closure.length > 0) return from.closure;
  if (from.ownStep.length > 0) return from.ownStep;
  return from.subsetInPlay;
}

function Pane({
  engine,
  nfa,
  refineFrom,
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
  onSourceHighlight,
  onOpenInEditor,
}: {
  engine: Engine | undefined;
  nfa: Automaton;
  /** The DFA this pane's machine was minimized from, when this is the minimal pane. */
  refineFrom: Automaton | undefined;
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
  /** Light states in the *DFA* pane, for the refinement views that name them. */
  onSourceHighlight: (states: readonly StateId[]) => void;
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

  /*
    A highlight from outside wins over the pane's own frame, on the same grounds hover beats
    the scrubber elsewhere: it is the live gesture, and someone pointing at a block in the
    refinement view is asking about *those* states right now. With nothing being pointed at,
    a framed pane marks itself — the subset being expanded, and the one just arrived at.
  */
  const marked =
    highlight.length > 0
      ? highlight
      : at.framed
        ? [at.current, at.arrived].filter((id): id is StateId => id !== undefined)
        : highlight;

  const [tableOpen, setTableOpen] = useState(defaultTable);

  /**
   * The refinement behind the minimal pane (Track E).
   *
   * Only for that pane, and only from the DFA it was minimized *from* — asking the engine to
   * minimize the already-minimal machine would produce a trace with nothing in it.
   */
  const minimization = useMemo(
    () => (refineFrom && engine ? engine.minimization(refineFrom) : undefined),
    [engine, refineFrom],
  );

  /**
   * Which presentation of the refinement is showing (task E5).
   *
   * Both are peers, so the switch is a visible pair of buttons rather than a menu — and the
   * *step* lives outside it, which is what makes E7 work: switching views mid-scrub keeps
   * position, because the position was never the view's to hold.
   */
  const [view, setView] = useState<'blocks' | 'table'>('blocks');

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

      {minimization && (
        <Refinement
          minimization={minimization}
          step={step}
          view={view}
          onView={setView}
          onHighlight={onSourceHighlight}
        />
      )}

      {onClosureFocus && (
        <ClosureDrill engine={engine} nfa={nfa} seeds={seeds} onFocus={onClosureFocus} />
      )}

      <Scrubber steps={stage.steps} step={step} onStep={onStep} label={`${subtitle} steps`} />
    </section>
  );
}

/**
 * The refinement, in whichever presentation is showing (tasks E5, E7).
 *
 * The switch is two buttons rather than a menu, because neither is the primary — CSE2004
 * teaches both, and a student revising from their notes needs whichever one their notes use.
 * The scrubber position lives in the pane above rather than in here, which is the whole of E7:
 * switching views mid-scrub keeps position because the position was never the view's to hold.
 */
function Refinement({
  minimization,
  step,
  view,
  onView,
  onHighlight,
}: {
  minimization: MinimizationOf;
  step: number;
  view: 'blocks' | 'table';
  onView: (next: 'blocks' | 'table') => void;
  onHighlight: (states: readonly StateId[]) => void;
}) {
  const split = splitAt(minimization, step);
  const previous = step > 0 ? splitAt(minimization, step - 1) : undefined;

  return (
    <div>
      <div className="flex items-center gap-1.5 border-t border-k-border px-4 py-2">
        <span className="font-mono text-[11px] tracking-wide text-k-text-faint uppercase">
          refinement
        </span>
        <div className="ml-auto flex gap-1">
          {(
            [
              ['blocks', 'blocks'],
              ['table', 'table'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => {
                onView(id);
              }}
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors duration-(--duration-k-hover) ${
                view === id
                  ? 'border-k-primary bg-k-primary/10 text-k-primary'
                  : 'border-k-border text-k-text-muted hover:border-k-border-strong hover:text-k-text'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'blocks' ? (
        <Partitions
          split={split}
          automaton={minimization.source}
          epsilon={EPSILON}
          onHoverBlock={onHighlight}
        />
      ) : (
        <MarkingTable
          table={minimization.table}
          automaton={minimization.source}
          split={split}
          previous={previous}
          epsilon={EPSILON}
          onHoverPair={onHighlight}
        />
      )}
    </div>
  );
}
