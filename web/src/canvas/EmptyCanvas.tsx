/**
 * What an empty canvas says.
 *
 * The editor never *starts* empty — it opens an example, a handed-over machine, or whatever
 * autosave recovered. So this is the state someone reaches by selecting everything and
 * deleting it, which is a deliberate act with a clear intention behind it: they want to draw
 * their own.
 *
 * Which makes the failure mode specific. An empty canvas with no instruction does not read as
 * "ready" — it reads as "broken", because the last thing that happened was everything
 * disappearing. Three sentences fix that, and the third of them is the one nobody discovers
 * on their own: the shortcut sheet exists.
 *
 * Deliberately not a modal. It sits *behind* the pointer — `pointer-events-none` on the
 * wrapper — so the first double-click that dismisses it is also the one that places a state.
 * A dialog would make the first gesture "close this", which is a gesture that teaches nothing.
 */

import { motion, useReducedMotion } from 'motion/react';

const GESTURES: readonly { keys: readonly string[]; detail: string }[] = [
  { keys: ['double-click'], detail: 'anywhere on the canvas to place a state' },
  { keys: ['drag'], detail: 'from the edge of a state to draw a transition' },
  { keys: ['?'], detail: 'for every shortcut, including the ones worth knowing' },
];

export function EmptyCanvas({ onOpenExample }: { onOpenExample: () => void }) {
  const still = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <motion.div
        initial={still ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        className="max-w-md text-center"
      >
        <h2 className="text-lg font-medium tracking-tight text-k-text">
          An empty machine. Yours to draw.
        </h2>

        <ul className="mt-5 space-y-2.5">
          {GESTURES.map((gesture) => (
            <li
              key={gesture.detail}
              className="flex items-baseline justify-center gap-2 text-sm text-k-text-muted"
            >
              {gesture.keys.map((key) => (
                <kbd
                  key={key}
                  className="rounded-md border border-k-border bg-k-surface-raised px-1.5 py-0.5 font-mono text-[11px] text-k-text shadow-[0_1px_0_0_var(--color-k-border)]"
                >
                  {key}
                </kbd>
              ))}
              <span>{gesture.detail}</span>
            </li>
          ))}
        </ul>

        {/*
          The one interactive thing here, so it gets its pointer events back. Someone who
          emptied the canvas and then changed their mind has, until now, had no way back to a
          working machine except the browser's back button.
        */}
        <button
          type="button"
          onClick={onOpenExample}
          className="pointer-events-auto mt-6 rounded-full border border-k-border bg-k-surface-raised px-4 py-1.5 font-mono text-xs text-k-text-muted transition-colors duration-(--duration-k-hover) hover:border-k-border-strong hover:text-k-text"
        >
          or start from an example →
        </button>
      </motion.div>
    </div>
  );
}
