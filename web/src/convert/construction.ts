/**
 * Reading a step's frame: what the machine looked like part-way through being built.
 *
 * The engine reports how much of a result existed at each step as two prefix counts and a
 * worklist (`Frame`, in Rust). This turns that into the shape the views want — a set of state
 * ids, a transition cut-off, and the three-way split of the worklist that task D1 renders.
 *
 * Pure and separate from any component, because the arithmetic is where the mistakes live:
 * an off-by-one here draws an edge into a state that does not exist yet, and that is the one
 * bug an animation makes look like a rendering fault.
 *
 * ## Not every trace is framed
 *
 * Thompson's construction does not emit frames — it builds fragments bottom-up and glues
 * them, so there is no growing prefix to report. Asking for a construction from an unframed
 * trace returns *everything present*, which is exactly right: a pane whose algorithm cannot
 * describe its own middle should show the finished machine rather than an empty box.
 */

import type { Automaton, StateId, Step } from '@/model/automaton';

/** The half-built machine, as of one step. */
export interface Construction {
  /** State ids that exist yet. */
  present: ReadonlySet<StateId>;
  /** How many of the automaton's transitions exist yet, as a prefix. */
  edges: number;
  /** The state this step arrived at, if it arrived anywhere. */
  arrived: StateId | undefined;
  /** Whether {@link Construction.arrived} was created by this step rather than recognised. */
  fresh: boolean;
  /** The state being expanded. */
  current: StateId | undefined;
  /** States discovered and waiting their turn, in queue order. */
  pending: readonly StateId[];
  /** States already expanded, in the order they were taken. */
  done: readonly StateId[];
  /**
   * The edge this step drew, as the `from->to` key the renderer groups by.
   *
   * A key rather than an index because parallel transitions between the same two states are
   * drawn as one arrow carrying `a, b` — so "the edge that just appeared" is a pair of
   * endpoints, not a row of the transition list.
   */
  drew: string | undefined;
  /**
   * The transition-table cell this step filled in, keyed as {@link cellKey} keys them.
   *
   * Separate from {@link Construction.drew} because a diagram and a table disagree about what
   * one transition is: the diagram merges `a` and `b` between the same pair into one arrow,
   * while the table keeps them in two cells.
   */
  cell: string | undefined;
  /** Whether the algorithm framed this run at all. */
  framed: boolean;
}

/** What the machine looked like after `step`. */
export function construction(
  automaton: Automaton,
  steps: readonly Step[],
  step: number,
): Construction {
  const frame = steps[step]?.frame ?? undefined;

  if (!frame) {
    return {
      present: new Set(automaton.states.map((state) => state.id)),
      edges: automaton.transitions.length,
      arrived: undefined,
      fresh: false,
      current: undefined,
      pending: [],
      done: [],
      drew: undefined,
      cell: undefined,
      framed: false,
    };
  }

  // Compared against the step before rather than tracked in the frame: the engine already
  // says how many edges exist at each point, and a second field saying which one is new
  // would be the same fact stored twice.
  const before = step > 0 ? (steps[step - 1]?.frame?.transitions ?? 0) : 0;
  const drawn = frame.transitions > before ? automaton.transitions[frame.transitions - 1] : undefined;

  const current = frame.current ?? undefined;

  return {
    // By position rather than by id. The counts are a prefix of the result's own order, and
    // reading them as an id range would quietly assume every algorithm numbers from zero.
    present: new Set(automaton.states.slice(0, frame.states).map((state) => state.id)),
    edges: frame.transitions,
    arrived: frame.target ?? undefined,
    fresh: frame.fresh ?? false,
    current,
    pending: frame.pending ?? [],
    done: expanded(steps, step).filter((id) => id !== current),
    drew: drawn && `${String(drawn.from)}->${String(drawn.to)}`,
    cell: drawn?.on == null ? undefined : cellKey(drawn.from, drawn.on),
    framed: true,
  };
}

/** Every state some step up to `step` has expanded, first time each, in order. */
function expanded(steps: readonly Step[], step: number): StateId[] {
  const seen = new Set<StateId>();
  for (const one of steps.slice(0, step + 1)) {
    const id = one.frame?.current;
    if (id !== undefined && id !== null) seen.add(id);
  }
  return [...seen];
}

/**
 * The machine as it stood, ready to hand to a renderer.
 *
 * The *layout* is deliberately not filtered alongside it. Positions come from the finished
 * machine and stay put, so a state appears where it will end up rather than shuffling every
 * other state sideways each time one is discovered — which would make the animation about
 * the layout engine instead of about the algorithm.
 */
export function partial(automaton: Automaton, at: Construction): Automaton {
  if (!at.framed) return automaton;
  return {
    ...automaton,
    states: automaton.states.filter((state) => at.present.has(state.id)),
    transitions: automaton.transitions.slice(0, at.edges),
  };
}

/**
 * Which cells of the transition table have been filled in (task D3).
 *
 * Keyed `from|symbol`, because that pair is what a cell *is* — δ(q, a). A DFA under
 * construction has no ε column, so a transition without a symbol needs no key here.
 */
export function filledCells(automaton: Automaton, at: Construction): Set<string> {
  const filled = new Set<string>();
  for (const transition of automaton.transitions.slice(0, at.edges)) {
    if (transition.on != null) filled.add(cellKey(transition.from, transition.on));
  }
  return filled;
}

/** The key {@link filledCells} uses, so callers never build it by hand. */
export function cellKey(from: StateId, symbol: string): string {
  return `${String(from)}|${symbol}`;
}
