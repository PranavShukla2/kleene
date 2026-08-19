/**
 * The worklist, as a queue you can watch drain (task D1).
 *
 * Subset construction *is* its worklist: take a subset, try every symbol, queue whatever is
 * new, repeat until nothing is left. Everything else — the labels, the arrows, the table —
 * is bookkeeping around that loop. And the queue is the one part of it that leaves no trace
 * in the finished machine, so a diagram alone can never show it.
 *
 * Three groups rather than one list, because "already expanded", "being expanded" and "still
 * to do" are what a reader needs to tell apart, and a single row of chips makes that a
 * colour-matching exercise. Position carries the distinction; colour only reinforces it
 * (design-system §1.2).
 */

import type { Construction } from '@/convert/construction';
import type { Automaton, StateId } from '@/model/automaton';

export function Worklist({
  automaton,
  at,
  onHoverState,
}: {
  automaton: Automaton;
  at: Construction;
  /** Hovering a chip lights the subset it stands for, in the ε-NFA pane. */
  onHoverState?: (id: StateId | undefined) => void;
}) {
  // An unframed trace has no worklist to show. Nothing is a better answer than an empty
  // widget claiming the algorithm has no work left.
  if (!at.framed) return null;

  const label = (id: StateId) =>
    automaton.states.find((state) => state.id === id)?.label ?? String(id);

  const hover = (id: StateId) => ({
    onPointerEnter: () => {
      onHoverState?.(id);
    },
    onPointerLeave: () => {
      onHoverState?.(undefined);
    },
  });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-k-border px-4 py-2">
      <span className="font-mono text-[11px] tracking-wide text-k-text-faint uppercase">
        worklist
      </span>

      {at.done.length > 0 && (
        <span className="flex items-center gap-1">
          {at.done.map((id) => (
            <Chip key={id} kind="done" {...hover(id)}>
              {label(id)}
            </Chip>
          ))}
        </span>
      )}

      {at.current !== undefined && (
        <span className="flex items-center gap-1.5">
          <Arrow />
          <Chip kind="current" {...hover(at.current)}>
            {label(at.current)}
          </Chip>
        </span>
      )}

      {at.pending.length > 0 && (
        <span className="flex items-center gap-1.5">
          <Arrow />
          {at.pending.map((id) => (
            <Chip key={id} kind="pending" {...hover(id)}>
              {label(id)}
            </Chip>
          ))}
        </span>
      )}

      {at.arrived !== undefined && (
        // Task D5. The outcome of the round, named rather than left to be inferred from
        // whether the diagram grew. Three channels agree on it — this word, the motion in the
        // diagram (a state grows in, or an existing one is struck), and the chip that either
        // joins the queue or does not — because it is the distinction students most reliably
        // get wrong, and one channel is what makes a thing missable.
        <span className="ml-auto flex items-center gap-1.5 font-mono text-[11px]">
          {at.fresh ? (
            <>
              <span className="text-k-text-faint">new subset →</span>
              <span className="rounded border border-k-primary bg-k-primary/10 px-1.5 py-0.5 text-k-primary">
                {label(at.arrived)}
              </span>
            </>
          ) : (
            <>
              <span className="text-k-text-faint">already seen —</span>
              <span className="rounded border border-k-secondary/60 px-1.5 py-0.5 text-k-secondary">
                {label(at.arrived)}
              </span>
              <span className="text-k-text-faint">no new state</span>
            </>
          )}
        </span>
      )}

      {at.arrived === undefined && at.current !== undefined && (
        // A round that read a symbol and reached nothing. Left unmarked it looks identical to
        // a round that has not happened yet, and the difference — δ is partial here — is the
        // one the trap state in `complete` exists to fix.
        <span className="ml-auto font-mono text-[11px] text-k-text-faint">
          dead end — no move on this symbol
        </span>
      )}

      {at.pending.length === 0 && at.current === undefined && (
        // The end condition, stated. "The queue is empty" is *why* the algorithm stops, and
        // an empty row leaves the reader to infer that from an absence.
        <span className="text-xs text-k-text-faint">
          empty — every subset has been expanded, so the construction is finished
        </span>
      )}
    </div>
  );
}

/**
 * One subset in the queue.
 *
 * Each of the three states differs in border, weight and colour at once. Border alone would
 * be too quiet at 11px; colour alone would fail §1.2 and greyscale printing both.
 */
function Chip({
  kind,
  children,
  ...handlers
}: {
  kind: 'done' | 'current' | 'pending';
  children: React.ReactNode;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  const style = {
    done: 'border-transparent bg-k-surface-raised text-k-text-faint',
    // The one that moves. 280ms matches the step transition, so the chip and the diagram
    // agree about when a round began.
    current:
      'border-k-primary bg-k-primary/10 font-medium text-k-primary motion-safe:animate-[fade-in_280ms_ease-out]',
    pending: 'border-dashed border-k-border-strong text-k-text-muted',
  }[kind];

  return (
    <span
      {...handlers}
      className={`cursor-help rounded border px-1.5 py-0.5 font-mono text-[11px] ${style}`}
      title={
        {
          done: 'expanded already',
          current: 'being expanded now',
          pending: 'discovered, waiting its turn',
        }[kind]
      }
    >
      {children}
    </span>
  );
}

/** Direction of travel. The queue is read left to right, and this says so once per boundary. */
function Arrow() {
  return (
    <span aria-hidden className="font-mono text-[11px] text-k-text-faint">
      →
    </span>
  );
}
