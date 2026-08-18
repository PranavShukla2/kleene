/**
 * Which panes the conversion page shows, and what each one is.
 *
 * The list is data because it is read three times — the toggles, the layout, and the reduction
 * figure all walk it — and three hand-written copies of "the three stages" would eventually
 * disagree about their order.
 */

import type { Compilation, Stage } from '@/model/automaton';

/** The three diagram panes. Decision D9: there is no regex pane — the bar is the regex. */
export type PaneId = 'nfa' | 'dfa' | 'minimal';

export interface PaneSpec {
  id: PaneId;
  title: string;
  /** How this machine was reached, named the way a course names it. */
  subtitle: string;
  /** Pull this stage out of a successful compilation. */
  stageOf: (parsed: Extract<Compilation, { kind: 'parsed' }>) => Stage;
}

export const PANES: readonly PaneSpec[] = [
  {
    id: 'nfa',
    title: 'ε-NFA',
    subtitle: 'Thompson’s construction',
    stageOf: (parsed) => parsed.nfa,
  },
  {
    id: 'dfa',
    title: 'DFA',
    subtitle: 'subset construction',
    stageOf: (parsed) => parsed.dfa,
  },
  {
    id: 'minimal',
    title: 'Minimal DFA',
    subtitle: 'partition refinement',
    stageOf: (parsed) => parsed.minimal,
  },
];

/**
 * The pair shown by default, per decision D9.
 *
 * Subset construction is what the page is named for and what the syllabus examines. The minimal
 * DFA answers a second question — "and could it be smaller?" — which someone asks after they
 * have understood the first.
 */
export const DEFAULT_PANES: readonly PaneId[] = ['nfa', 'dfa'];

/**
 * How much minimization saved, as a sentence, or nothing when it saved nothing.
 *
 * Task B4 calls this figure "the entire argument for minimization", and it is — but only when
 * there is one. `11 → 4` is an argument; `4 → 4` is a machine that was already minimal, and
 * dressing that up as a saving would be claiming credit for doing nothing.
 */
export function reduction(
  parsed: Extract<Compilation, { kind: 'parsed' }>,
): string | undefined {
  const before = parsed.dfa.automaton.states.length;
  const after = parsed.minimal.automaton.states.length;
  return after < before ? `${String(before)} → ${String(after)} states` : undefined;
}
