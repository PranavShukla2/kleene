/**
 * The first-run tour (Phase 5 E6).
 *
 * Kleene's gestures are discoverable but not obvious, and one is genuinely unguessable:
 * **a transition is drawn by dragging from a state's rim, not its centre** — dragging the
 * centre moves the state. Someone who does not know that concludes the tool cannot draw
 * transitions, which is most of what it is for.
 *
 * ## Three cards, not a walkthrough
 *
 * A tour that waits for you to perform each step traps anyone who does the steps in a
 * different order, and people do. These name the three gestures and get out of the way; the
 * editor is where they are learned.
 *
 * ## Why it is here and not in Phase 2
 *
 * A tour is documentation with a shorter feedback loop. Written against gestures that were
 * still moving it would have been rewritten twice — and a tour describing a gesture the editor
 * no longer has is worse than no tour.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { formatChord } from '@/canvas/shortcuts';
import { rememberTourSeen } from '@/canvas/tourSeen';
import { SPRING } from '@/site/spring';

interface Card {
  title: string;
  detail: string;
  /** Shown as a key cap, when the gesture has one. */
  keys?: string;
}

const CARDS: readonly Card[] = [
  {
    title: 'Double-click to place a state',
    detail: 'Anywhere on the canvas. Double-click a state again to rename it.',
    keys: 'double-click',
  },
  {
    title: 'Drag from the rim to draw a transition',
    detail:
      'From the edge of a state, not its middle — dragging the middle moves the state. Drop on another state, or on the same one for a self-loop.',
    keys: 'drag',
  },
  {
    title: 'Everything else has a shortcut',
    detail:
      'Undo, select all, arrange the layout, run a string. The full sheet is one key away and worth thirty seconds.',
    keys: '?',
  },
];

export function Tour({ onDone }: { onDone: () => void }) {
  const [at, setAt] = useState(0);
  const still = useReducedMotion();

  const finish = () => {
    rememberTourSeen();
    onDone();
  };

  const card = CARDS[at];
  if (!card) return null;

  const last = at === CARDS.length - 1;

  return (
    <AnimatePresence>
      <motion.div
        // Bottom-left: over the canvas, but clear of the command bar and the panels. A modal
        // in the middle would cover the thing being described.
        initial={still ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={still ? undefined : { opacity: 0, y: 12 }}
        transition={SPRING}
        role="dialog"
        aria-label="Getting started"
        /*
          `pointer-events-none`, with the buttons opting back in.

          The tour sits over the canvas and tells you to draw on it. A panel that swallowed
          those gestures would block the exact thing it is describing — and the first-time
          user, who is the only one who sees this, would conclude the tool does not work.
        */
        className="pointer-events-none absolute bottom-4 left-4 z-40 w-80 rounded-2xl border border-k-border bg-k-surface-raised/95 p-4 shadow-lg backdrop-blur"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-wider text-k-text-faint uppercase">
            {at + 1} of {CARDS.length}
          </span>
          {/*
            Skip is on every card, not only the first. Someone who realises on card two that
            they already know this should not have to keep reading to escape.
          */}
          <button
            type="button"
            onClick={finish}
            className="pointer-events-auto ml-auto font-mono text-[11px] text-k-text-faint hover:text-k-text"
          >
            skip
          </button>
        </div>

        <div className="mt-2 flex items-baseline gap-2">
          {card.keys && (
            <kbd className="rounded-md border border-k-border bg-k-surface px-1.5 py-0.5 font-mono text-[11px] whitespace-nowrap text-k-text">
              {card.keys === '?' ? formatChord('Shift+Slash') : card.keys}
            </kbd>
          )}
          <h2 className="text-sm font-medium tracking-tight">{card.title}</h2>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-k-text-muted">{card.detail}</p>

        <div className="mt-4 flex items-center gap-2">
          <div className="flex gap-1" aria-hidden>
            {CARDS.map((entry, index) => (
              <span
                key={entry.title}
                className={`h-1.5 w-1.5 rounded-full ${
                  index === at ? 'bg-k-primary' : 'bg-k-border-strong'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (last) finish();
              else setAt(at + 1);
            }}
            className="pointer-events-auto ml-auto rounded-full bg-k-primary px-3.5 py-1 text-xs font-medium text-white"
          >
            {last ? 'Start drawing' : 'Next'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
