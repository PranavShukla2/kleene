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

/**
 * What an example demonstrates.
 *
 * The filter axis, per Phase 5 C7. Someone arrives at a gallery looking for the thing they are
 * stuck on — ε-transitions, or why their DFA has a trap state — not for a difficulty. Tiers
 * tell you whether you *can* read an example; topics tell you whether you *want* to.
 */
export type Topic =
  'self-loops' | 'invariants' | 'nondeterminism' | 'epsilon' | 'trap states' | 'minimization';

export interface Example {
  /** The key `Engine.example` takes, and what goes in the URL. */
  key: string;
  title: string;
  /** The language it accepts, in the notation a course would use. */
  language: string;
  /** What someone learns by opening it. */
  teaches: string;
  tier: Tier;
  topics: readonly Topic[];
}

export const EXAMPLES: readonly Example[] = [
  {
    key: 'even_number_of_as',
    title: 'Even number of a’s',
    language: '{ w ∈ {a, b}* : |w|ₐ is even }',
    teaches:
      'The smallest machine with a real invariant — two states, and the state *is* the parity.',
    tier: 'introductory',
    topics: ['invariants', 'self-loops'],
  },
  {
    key: 'ends_with_ab',
    title: 'Ends in ab',
    language: '{ w ∈ {a, b}* : w ends with ab }',
    teaches: 'Why a DFA needs memory of the last symbol, and what a self-loop is actually for.',
    tier: 'introductory',
    topics: ['invariants', 'self-loops'],
  },
];

/** Every topic that at least one example carries, in a stable order. */
export function availableTopics(examples: readonly Example[] = EXAMPLES): Topic[] {
  const seen = new Set<Topic>();
  for (const example of examples) for (const topic of example.topics) seen.add(topic);
  return [...seen];
}

/** The examples matching a topic, or all of them when nothing is chosen. */
export function filterByTopic(topic: Topic | undefined, examples = EXAMPLES): Example[] {
  return topic === undefined ? [...examples] : examples.filter((e) => e.topics.includes(topic));
}
