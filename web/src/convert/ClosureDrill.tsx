/**
 * "How did that closure get so big?" — ε-closure, expanded one state at a time (task D4).
 *
 * Every round of subset construction closes over ε, and the trace states the answer in one
 * sentence: *reading `a` from B reaches {q0, q2, q4, q6, q7, q8}*. That sentence is where
 * students lose the thread, because six states appeared and only one of them was reached by
 * reading anything. This unfolds that one sentence into the worklist behind it.
 *
 * A drill-down rather than part of the main trace, and that split is a decision made in the
 * core: emitting the full closure narration inside every round would bury the twelve steps a
 * reader came for under two hundred they did not. So the construction records the *seeds* it
 * closed over, and the closure is recomputed here only when someone asks.
 */

import { useEffect, useMemo, useState } from 'react';

import { clampStep } from '@/convert/scrubbing';
import type { Automaton, StateId, Step } from '@/model/automaton';
import type { Engine } from '@/wasm/loader';

export function ClosureDrill({
  engine,
  nfa,
  seeds,
  onFocus,
}: {
  engine: Engine | undefined;
  /** The machine the closure is computed in — always the ε-NFA, never the DFA being built. */
  nfa: Automaton;
  /** The set this step closed over, from `step.seeds`. */
  seeds: readonly StateId[];
  /** Light these ε-NFA states in the ε-NFA pane, or clear the focus with an empty array. */
  onFocus: (ids: readonly StateId[]) => void;
}) {
  const [open, setOpen] = useState(false);
  /**
   * How far into *which* closure.
   *
   * Stored as a pair rather than as a number reset by an effect. The outer scrubber moves
   * under this component — advancing a round changes the seeds — and a plain number would
   * either need an effect to zero it (a cascading render) or would leave someone opening a
   * fresh closure half-way through it.
   */
  const [mark, setMark] = useState({ of: '', at: 0 });

  const trace = useMemo(
    () => (open && engine ? engine.epsilonClosure(nfa, seeds) : undefined),
    [open, engine, nfa, seeds],
  );

  const steps: readonly Step[] = trace?.steps ?? [];
  const of = seeds.join(',');
  const here = clampStep(mark.of === of ? mark.at : 0, steps);
  const step = steps[here];
  const goTo = (next: number) => {
    setMark({ of, at: next });
  };

  // Pushing the focus outward is an effect rather than something the click handlers do,
  // because the focus has to follow the step whichever way the step changed — opening,
  // stepping, or the seeds changing underneath because the outer scrubber moved.
  useEffect(() => {
    onFocus(open ? (step?.highlight ?? []) : []);
  }, [open, step, onFocus]);

  if (seeds.length === 0) return null;

  if (!open) {
    return (
      <div className="px-4 pb-2">
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className="font-mono text-[11px] text-k-text-faint underline decoration-dotted underline-offset-4 transition-colors duration-(--duration-k-hover) hover:text-k-secondary"
        >
          ε-closure of {names(nfa, seeds)} — one state at a time
        </button>
      </div>
    );
  }

  return (
    <div className="mx-4 mb-2 rounded-md border border-k-secondary/40 bg-k-secondary/5 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-k-secondary">
          ε-closure of {names(nfa, seeds)}
        </span>
        <div className="flex items-center gap-1">
          <Nudge
            label="Previous state added"
            disabled={here === 0}
            onClick={() => {
              goTo(here - 1);
            }}
          >
            ‹
          </Nudge>
          <span className="font-mono text-[11px] text-k-text-faint tabular-nums">
            {here + 1} of {steps.length}
          </span>
          <Nudge
            label="Next state added"
            disabled={here >= steps.length - 1}
            onClick={() => {
              goTo(here + 1);
            }}
          >
            ›
          </Nudge>
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
      </div>

      {/*
        Polite rather than assertive: someone stepping through a closure is reading, and an
        assertive region would interrupt whatever the screen reader was already saying about
        the round above.
      */}
      <p aria-live="polite" className="mt-1.5 text-xs leading-relaxed text-k-text-muted">
        {step?.detail ?? 'This set is already closed — no ε-transition leaves it.'}
      </p>
    </div>
  );
}

function Nudge({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded px-1.5 font-mono text-sm text-k-text-muted transition-colors duration-(--duration-k-hover) not-disabled:hover:text-k-text disabled:text-k-border-strong"
    >
      {children}
    </button>
  );
}

/** A set of states the way a course writes it. Matches the prose the engine generates. */
function names(automaton: Automaton, ids: readonly StateId[]): string {
  const labels = ids.map(
    (id) => automaton.states.find((state) => state.id === id)?.label ?? String(id),
  );
  return `{${labels.join(', ')}}`;
}
