/**
 * The two examples the landing page can show *before* WebAssembly arrives.
 *
 * **This is a deliberate second list, and the reason is a rule.** Phase 5 E4 says the landing
 * page must paint without waiting for the engine, and the full catalogue lives *in* the engine
 * (`engine.catalogue()`) so that the machines a gallery draws are the machines CI runs. A page
 * that must not block on wasm therefore cannot read it.
 *
 * So this holds two entries — enough for a strip that says "browse the gallery" — and nothing
 * else should use it. `/examples` and the editor read the engine.
 *
 * The keys must exist in the engine's catalogue; `landing-examples.test.ts` is what says so,
 * because a card here that opens nothing is worse than one card fewer.
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
