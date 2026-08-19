/**
 * The machine in the hero, running.
 *
 * A working automaton, not a screenshot (Phase 5 E1). This renders the same component the
 * editor does, and then does the one thing a static hero cannot: runs a string through it,
 * symbol by symbol, forever.
 *
 * ## Why it does not use the engine
 *
 * The overview has to paint before a 200KB WebAssembly module arrives, so the first thing a
 * visitor is guaranteed to see cannot depend on it (Phase 5 E4). The machine and the run are
 * both literals here for that reason — and the run is trivially checkable by eye against the
 * diagram beside it, which is the only reason a hard-coded trace is acceptable at all.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

import { AutomatonView } from '@/canvas/AutomatonView';
import type { Automaton, StateId } from '@/model/automaton';

/**
 * "Ends in ab" — small enough to read at a glance, and still showing a self-loop, a
 * bidirectional pair and an accepting state: the whole visual vocabulary in three states.
 */
const MACHINE: Automaton = {
  alphabet: ['a', 'b'],
  states: [
    { id: 0, label: 'q0' },
    { id: 1, label: 'q1' },
    { id: 2, label: 'q2', accepting: true },
  ],
  start: 0,
  transitions: [
    { from: 0, to: 1, on: 'a' },
    { from: 0, to: 0, on: 'b' },
    { from: 1, to: 1, on: 'a' },
    { from: 1, to: 2, on: 'b' },
    { from: 2, to: 1, on: 'a' },
    { from: 2, to: 0, on: 'b' },
  ],
};

const INPUT = 'babab';

/**
 * Where the machine is after each prefix of {@link INPUT}, starting from before anything is
 * read. Checkable by eye against the diagram: `b` self-loops on q0, `a` goes to q1, `b`
 * accepts at q2, `a` returns to q1, `b` accepts again.
 */
const RUN: readonly StateId[] = [0, 0, 1, 2, 1, 2];

/** How long each symbol is held. Slower than the editor's 280ms — nobody is scrubbing this. */
const BEAT = 900;

export function HeroDemo() {
  const [at, setAt] = useState(0);
  const still = useReducedMotion();

  useEffect(() => {
    // A still hero for anyone who asked for one. The diagram is the point; the run is a
    // flourish, and a flourish is exactly what `prefers-reduced-motion` is asking to lose.
    if (still) return;

    const timer = setInterval(() => {
      setAt((was) => (was + 1) % (RUN.length + 2));
    }, BEAT);
    return () => {
      clearInterval(timer);
    };
  }, [still]);

  // Two beats of rest at the end before it starts over, so the accepted state is legible
  // rather than flashing past on its way back to the beginning.
  const step = Math.min(at, RUN.length - 1);
  const active = RUN[step];
  const read = INPUT.slice(0, step);
  const accepted = active !== undefined && MACHINE.states[active]?.accepting === true;

  return (
    <div className="k-glass overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-k-border/60 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <Dot className="bg-k-error/60" />
          <Dot className="bg-k-warning/60" />
          <Dot className="bg-k-success/60" />
        </span>
        <span className="ml-1 font-mono text-[11px] text-k-text-faint">
          ends-in-ab.kln — running
        </span>
        <span
          className={`ml-auto rounded-full px-2 py-0.5 font-mono text-[10px] transition-colors duration-(--duration-k-step) ${
            accepted ? 'bg-k-success/15 text-k-success' : 'bg-k-surface text-k-text-faint'
          }`}
        >
          {accepted ? 'accepted' : 'reading'}
        </span>
      </div>

      {/*
        `AutomatonView` rather than the raw graphics, so the viewBox is computed from the
        layout instead of guessed. A hard-coded box was cropping the self-loops, which are
        drawn *above* the states and so fall outside any box fitted to the states alone.
      */}
      <AutomatonView
        automaton={MACHINE}
        title="A DFA accepting strings over {a, b} that end in ab"
        className="h-56 w-full px-4 sm:h-64"
        active={active === undefined ? [] : [active]}
      />

      {/* The tape. Read symbols dim, the current one lit, the rest waiting. */}
      <div className="flex items-center gap-2 border-t border-k-border/60 px-4 py-3">
        <span className="font-mono text-[11px] text-k-text-faint">input</span>
        <span className="flex gap-1">
          {[...INPUT].map((symbol, index) => (
            <span
              key={`${symbol}${String(index)}`}
              className={`flex h-6 w-6 items-center justify-center rounded border font-mono text-xs transition-colors duration-(--duration-k-step) ${
                index < read.length
                  ? 'border-k-border bg-k-surface text-k-text-faint'
                  : index === read.length
                    ? 'border-k-primary bg-k-primary/10 text-k-primary'
                    : 'border-k-border/60 text-k-text-faint'
              }`}
            >
              {symbol}
            </span>
          ))}
        </span>

        {/*
          The sentence, swapped rather than rewritten in place. A line of text that changes
          word by word is unreadable at this speed; one that is replaced is not.
        */}
        <AnimatePresence mode="wait">
          <motion.span
            key={step}
            initial={still ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={still ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="ml-auto hidden font-mono text-[11px] text-k-text-muted sm:block"
          >
            in {MACHINE.states[active ?? 0]?.label}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Dot({ className }: { className: string }) {
  return <span className={`h-2.5 w-2.5 rounded-full ${className}`} />;
}
