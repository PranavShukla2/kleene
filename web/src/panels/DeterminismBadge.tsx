/**
 * The DFA / NFA / ε-NFA badge.
 *
 * E4, and the plan's reason for it is the interesting one: *"it teaches the distinction for
 * free, every time an edit changes it."* Someone drawing a second `a` out of one state and
 * watching the badge flip from DFA to NFA has learned what nondeterminism is, without being
 * told. That only works if it is always visible and always current — a badge you have to go
 * and look for teaches nothing.
 *
 * The classification comes from Rust. It used to be reimplemented in TypeScript, which meant
 * this badge could disagree with the preconditions the algorithms enforce.
 */

import type { Determinism } from '@/model/automaton';

/** What each class means, in one line, for the tooltip. */
const MEANING: Record<Determinism, string> = {
  DFA: 'At most one move per state and symbol.',
  NFA: 'Some state has two moves on the same symbol.',
  'ε-NFA': 'Has ε-transitions, which move without reading input.',
};

export function DeterminismBadge({ value }: { value: Determinism | undefined }) {
  if (!value) return null;

  return (
    <span
      title={MEANING[value]}
      className={`rounded-md border px-2 py-0.5 font-mono text-xs ${TONE[value]}`}
    >
      {value}
    </span>
  );
}

/**
 * Colour by class, and deliberately not a traffic light.
 *
 * An NFA is not a *worse* machine than a DFA, and colouring it as a warning would teach
 * exactly the wrong thing to the people this is for. The three read as three categories:
 * determinism gets the accepting colour it already owns elsewhere, and the two
 * nondeterministic classes share the primary, distinguished by weight of background.
 */
const TONE: Record<Determinism, string> = {
  DFA: 'border-k-accepting/40 bg-k-accepting/10 text-k-accepting',
  NFA: 'border-k-primary/40 bg-k-primary/10 text-k-primary',
  'ε-NFA': 'border-k-primary/40 bg-k-primary/20 text-k-primary',
};
