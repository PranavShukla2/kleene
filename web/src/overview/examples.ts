/**
 * The examples the engine ships with, described.
 *
 * Two, today. Phase 5 Track C grows this to ~20 and turns the strip into a real gallery with
 * tiers and filters — so this file is deliberately shaped like the thing it becomes rather
 * than like the thing it is, and the overview says out loud that it is short.
 *
 * The descriptions live here rather than in Rust because they are *copy*: what a machine
 * teaches is an editorial judgement about an audience, not a property of the automaton. The
 * engine owns the machines; this owns how they are introduced.
 */

/** How hard an example is, per Phase 5 C6 — three tiers a student can self-select into. */
export type Tier = 'introductory' | 'standard' | 'pathological';

export interface Example {
  /** The key `Engine.example` takes, and what goes in the URL. */
  key: string;
  title: string;
  /** The language it accepts, in the notation a course would use. */
  language: string;
  /** What someone learns by opening it. */
  teaches: string;
  tier: Tier;
}

export const EXAMPLES: readonly Example[] = [
  {
    key: 'even_number_of_as',
    title: 'Even number of a’s',
    language: '{ w ∈ {a, b}* : |w|ₐ is even }',
    teaches:
      'The smallest machine with a real invariant — two states, and the state *is* the parity.',
    tier: 'introductory',
  },
  {
    key: 'ends_with_ab',
    title: 'Ends in ab',
    language: '{ w ∈ {a, b}* : w ends with ab }',
    teaches: 'Why a DFA needs memory of the last symbol, and what a self-loop is actually for.',
    tier: 'introductory',
  },
];
