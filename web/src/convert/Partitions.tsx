/**
 * The partition, round by round (tasks E1, E2, E8).
 *
 * The other half of the pair. Where the marking table answers "which pairs are different",
 * this answers "which states are still together" — and those are the same fact seen from
 * opposite sides, which is why both are derived from one partition in `refinement.ts`.
 *
 * Rendered as blocks rather than as colour over the diagram. Colouring states in the machine
 * was the first idea and it fails on the thing that matters: a block is a *set*, and a set of
 * four states scattered across a diagram does not read as one object however it is tinted.
 * Written out as `{q0, q2}` it does, which is also the notation a course uses on the board.
 */

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { witnessOf } from '@/convert/refinement';
import type { Automaton, Split, StateId } from '@/model/automaton';
import { SPRING } from '@/site/spring';

export function Partitions({
  split,
  automaton,
  epsilon,
  onHoverBlock,
}: {
  split: Split | undefined;
  automaton: Automaton;
  epsilon: string;
  onHoverBlock?: (states: readonly StateId[]) => void;
}) {
  const still = useReducedMotion();
  const label = (id: StateId) =>
    automaton.states.find((state) => state.id === id)?.label ?? String(id);

  if (!split) return null;

  return (
    <div
      className="border-t border-k-border px-4 py-3"
      onPointerLeave={() => {
        onHoverBlock?.([]);
      }}
    >
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[11px] tracking-wide text-k-text-faint uppercase">
          round {split.round}
        </span>
        <span className="font-mono text-[11px] text-k-text-faint">
          {split.partition.length} {split.partition.length === 1 ? 'block' : 'blocks'}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <AnimatePresence initial={false}>
          {split.partition.map((block) => {
            // The pieces this very step made, which the engine already names. Deriving it by
            // comparing against the previous partition was the first attempt and it is
            // strictly worse: `into` is the answer, and recomputing an answer you were handed
            // is how the two end up disagreeing.
            const fresh = split.into.some((piece) => piece.join(',') === block.join(','));
            const key = block.join(',');

            return (
              <motion.button
                key={key}
                type="button"
                layout={!still}
                initial={still ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={still ? undefined : { opacity: 0, scale: 0.9 }}
                transition={SPRING}
                onPointerEnter={() => {
                  onHoverBlock?.(block);
                }}
                className={`cursor-help rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors duration-(--duration-k-hover) ${
                  fresh
                    ? 'border-k-new bg-k-new/10 text-k-new'
                    : 'border-k-border bg-k-surface text-k-text-muted hover:border-k-border-strong hover:text-k-text'
                }`}
              >
                {'{'}
                {block.map((id) => label(id)).join(', ')}
                {'}'}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/*
        Task E3, and the reason this whole track exists. The exam asks for the string that
        tells two states apart; every other tool shows the answer and not this. So it gets its
        own line at a readable size, not a footnote under a diagram.
      */}
      {split.evidence && (
        <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-k-distinguishing/25 bg-k-distinguishing/[0.06] px-3 py-2 text-[13px]">
          <span className="font-mono text-[10px] tracking-wider text-k-distinguishing uppercase">
            tells them apart
          </span>
          <span className="font-mono font-medium text-k-distinguishing">
            {witnessOf(split.evidence.witness, epsilon)}
          </span>
          {/*
            "separates", not "accepted from X and rejected from Y". The engine records the
            string, not which side accepts it — and stating a direction it never computed
            would be the most confidently wrong sentence on this screen.
          */}
          <span className="text-k-text-muted">
            separates {label(split.evidence.left)} from {label(split.evidence.right)}
          </span>
        </p>
      )}
    </div>
  );
}
