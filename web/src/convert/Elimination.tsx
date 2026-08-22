/**
 * DFA → regular expression, by state elimination (Track F).
 *
 * Its own section rather than a fourth pane, and that follows from decision D9. The three panes
 * are stages of *one* pipeline running left to right, and the bar above them is already the
 * regular expression — a fourth pane holding a *different* expression for the same language
 * would read as a contradiction rather than as an answer to a different question. Which it is:
 * the panes ask "what machine does this expression describe", and this asks the reverse.
 *
 * ## Why the GNFA is a list and not a diagram
 *
 * The first version drew it. Edge labels during elimination grow to things like
 * `(a|b)*abb(a|b)*` — twenty characters on an arrow forty pixels long — and every layout
 * either overlapped them or spread the states so far apart the machine stopped being readable.
 * A list has room, keeps labels in a stable place so a change is *visible as a change*, and is
 * how the working is written out by hand anyway.
 *
 * Task F2 is the whole point: watching one label grow from `a` to `ab*c` is the lesson.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Scrubber } from '@/convert/Scrubber';
import { clampStep } from '@/convert/scrubbing';
import type { Automaton, Elimination as Run, Endpoint, StateId } from '@/model/automaton';
import { SPRING } from '@/site/spring';
import type { Engine } from '@/wasm/loader';

/** The orders the engine offers, and how each reads. Task F3, decision D6. */
const ORDERS: readonly { id: string; label: string; detail: string }[] = [
  {
    id: 'fewest-edges',
    label: 'fewest edges',
    detail: 'Removes the state that adds the least. Usually a much shorter answer.',
  },
  {
    id: 'textbook',
    label: 'in order',
    detail: 'Removes states by id, the way a worked example does — line for line with yours.',
  },
];

export function Elimination({
  engine,
  dfa,
  epsilon,
}: {
  engine: Engine | undefined;
  /** The machine to convert. The DFA, not the minimal one — that is what a course starts from. */
  dfa: Automaton;
  epsilon: string;
}) {
  const [open, setOpen] = useState(false);
  const [order, setOrder] = useState<string>(ORDERS[0]?.id ?? 'fewest-edges');
  /**
   * How far in, and into *which* run.
   *
   * A pair rather than a number reset by an effect: changing the order changes the trace
   * underneath the scrubber, and zeroing a plain counter from an effect is a cascading render
   * for something already known from the input.
   */
  const [mark, setMark] = useState({ of: '', at: 0 });

  const run = useMemo(
    () => (open && engine ? engine.elimination(dfa, order) : undefined),
    [open, engine, dfa, order],
  );

  if (!open) {
    return (
      <section className="mt-4 rounded-2xl border border-dashed border-k-border p-4">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className="text-left"
        >
          <span className="font-medium tracking-tight">Back to a regular expression →</span>
          <span className="mt-1 block max-w-prose text-sm text-k-text-muted">
            The other direction: eliminate the states one at a time and watch what is left on
            the edges become an expression. This is the conversion the panes above do not do.
          </span>
        </button>
      </section>
    );
  }

  if (!run) return null;

  const key = `${order}:${String(dfa.states.length)}`;
  const step = clampStep(mark.of === key ? mark.at : 0, run.steps);
  const stage = run.stages[step];

  return (
    <section className="mt-4 overflow-hidden rounded-2xl border border-k-border bg-k-surface">
      <header className="flex flex-wrap items-center gap-3 border-b border-k-border px-4 py-2.5">
        <h2 className="font-medium">
          Regular expression
          <span className="ml-2 text-sm font-normal text-k-text-faint">state elimination</span>
        </h2>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="font-mono text-[11px] text-k-text-faint">order</span>
          {ORDERS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={order === option.id}
              title={option.detail}
              onClick={() => {
                setOrder(option.id);
              }}
              className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] transition-colors duration-(--duration-k-hover) ${
                order === option.id
                  ? 'border-k-primary bg-k-primary/10 text-k-primary'
                  : 'border-k-border text-k-text-muted hover:border-k-border-strong hover:text-k-text'
              }`}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
            className="ml-1 font-mono text-[11px] text-k-text-faint hover:text-k-text"
          >
            close
          </button>
        </div>
      </header>

      {/*
        Task F4: the answer, at the top, always. Someone who came for the expression should not
        have to scrub to the end to find it — and seeing it *while* watching it be built is
        what makes the last step feel like an arrival rather than a reveal.
      */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-k-border bg-k-canvas/60 px-4 py-3">
        <span className="font-mono text-[10px] tracking-wider text-k-text-faint uppercase">
          answer
        </span>
        <code className="font-mono text-base break-all text-k-secondary">
          {run.regex === '' ? epsilon : run.regex}
        </code>
      </div>

      <Gnfa
        stage={stage}
        source={run.source}
        epsilon={epsilon}
        eliminated={stage?.eliminated ?? undefined}
      />

      <Scrubber
        steps={run.steps}
        step={step}
        onStep={(next) => {
          setMark({ of: key, at: next });
        }}
        label="Elimination steps"
      />
    </section>
  );
}

function Gnfa({
  stage,
  source,
  epsilon,
  eliminated,
}: {
  stage: Run['stages'][number] | undefined;
  source: Automaton;
  epsilon: string;
  eliminated: StateId | undefined;
}) {
  const still = useReducedMotion();

  const name = (end: Endpoint): string => {
    if (end.kind === 'start') return '▶';
    if (end.kind === 'accept') return '◉';
    return source.states.find((state) => state.id === end.id)?.label ?? String(end.id);
  };

  if (!stage) return null;

  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="font-mono tracking-wider text-k-text-faint uppercase">left</span>
        {stage.remaining.length === 0 ? (
          <span className="text-k-text-faint">nothing — only the added endpoints remain</span>
        ) : (
          stage.remaining.map((id) => (
            <span
              key={id}
              className={`rounded-full border px-2 py-0.5 font-mono ${
                id === eliminated
                  ? 'border-k-distinguishing bg-k-distinguishing/10 text-k-distinguishing'
                  : 'border-k-border text-k-text-muted'
              }`}
            >
              {source.states.find((state) => state.id === id)?.label ?? id}
            </span>
          ))
        )}
      </div>

      <ul className="mt-3 space-y-1">
        <AnimatePresence initial={false}>
          {stage.edges.map((edge) => {
            const id = `${JSON.stringify(edge.from)}->${JSON.stringify(edge.to)}`;
            return (
              <motion.li
                key={id}
                layout={!still}
                initial={still ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={still ? undefined : { opacity: 0, x: 6 }}
                transition={SPRING}
                className="flex items-baseline gap-2 font-mono text-xs"
              >
                <span className="w-10 shrink-0 text-right text-k-text-muted">
                  {name(edge.from)}
                </span>
                <span aria-hidden className="text-k-text-faint">
                  →
                </span>
                <span className="w-10 shrink-0 text-k-text-muted">{name(edge.to)}</span>
                {/*
                  The label, keyed on its own text so a *change* remounts and fades. That is
                  task F2 made visible: an edge whose expression grew reads as an event, and
                  one that did not stays perfectly still.
                */}
                <AnimatePresence mode="wait">
                  <motion.code
                    key={edge.label}
                    initial={still ? false : { opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={still ? undefined : { opacity: 0, y: -3 }}
                    transition={{ duration: 0.18 }}
                    className="break-all text-k-secondary"
                  >
                    {edge.label === '' ? epsilon : edge.label}
                  </motion.code>
                </AnimatePresence>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
