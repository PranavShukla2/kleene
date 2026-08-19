/**
 * What a page waiting on the engine says.
 *
 * Not a spinner. A spinner says "something is happening" and nothing else, which is the least
 * useful sentence available at a moment when the visitor has already decided the page is slow.
 * This says what is loading and why it is worth the wait, and it draws the shape of what is
 * coming so the layout does not jump when it arrives.
 *
 * The bar is indeterminate on purpose. The engine's arrival depends on a network fetch and a
 * WebAssembly instantiation, neither of which reports progress, and a fake percentage that
 * sticks at 80% is worse than no percentage at all.
 */

import { motion, useReducedMotion } from 'motion/react';

export function Loading({ what }: { what: string }) {
  const still = useReducedMotion();

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="rounded-2xl border border-k-border bg-k-surface p-8">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-k-text-faint">loading the engine</span>
          <span className="ml-auto font-mono text-[11px] text-k-text-faint">
            ~92 KB of Rust, compiled to WebAssembly
          </span>
        </div>

        <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-k-border">
          {still ? (
            <div className="h-full w-1/3 bg-k-primary" />
          ) : (
            <motion.div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-k-aurora-1 via-k-aurora-3 to-k-aurora-2"
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        <p className="mt-4 max-w-prose text-sm text-k-text-muted">{what}</p>

        {/*
          The shape of what is coming, so the page does not jump when it does. Skeletons are
          usually an apology for a slow API; here there is no API — this is a one-time cost
          the visitor pays once per session, and drawing the destination is the honest way to
          spend it.
        */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2" aria-hidden>
          {[0, 1].map((n) => (
            <div key={n} className="rounded-2xl border border-k-border p-4">
              <div className="h-3 w-1/3 rounded-full bg-k-border" />
              <div className="mt-3 h-32 rounded-lg bg-k-canvas" />
              <div className="mt-3 h-2.5 w-2/3 rounded-full bg-k-border" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
