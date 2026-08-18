/**
 * Moving through a trace.
 *
 * The scrubber is the plan's "centrepiece control of the product", and almost all of what
 * makes it good is arithmetic: clamping, wrapping decisions, and what a step index means when
 * the trace underneath it changes length. None of that needs a DOM, so none of it lives in a
 * component.
 */

import type { Step } from '@/model/automaton';

/**
 * How long one step takes when playing, in milliseconds.
 *
 * 280ms, from design-system §5, which calls this "the most important number here" — and gives
 * the reason: faster and the eye cannot follow which subset became which state; slower and
 * scrubbing through thirty rounds is tedious. Copied here rather than re-derived so the two
 * cannot drift apart silently.
 */
export const STEP_MS = 280;

/** Playback speeds offered, as multipliers of {@link STEP_MS}. */
export const SPEEDS = [0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

/** A step index that is always inside the trace. */
export function clampStep(step: number, steps: readonly Step[]): number {
  return Math.max(0, Math.min(step, steps.length - 1));
}

/**
 * The step after this one, or `undefined` at the end.
 *
 * `undefined` rather than looping. A trace has a beginning and an end because the algorithm
 * does; wrapping round to round one would suggest subset construction is a cycle, which is the
 * opposite of what it is.
 */
export function nextStep(step: number, steps: readonly Step[]): number | undefined {
  return step + 1 < steps.length ? step + 1 : undefined;
}

/** How the position reads: "step 4 of 27". */
export function position(step: number, steps: readonly Step[]): string {
  return steps.length === 0 ? '' : `${String(step + 1)} of ${String(steps.length)}`;
}

/**
 * Which states the current step is about.
 *
 * From `Step.highlight`, which the core fills in beside the code that made the move — a step
 * that mentions `{q1, q3}` in its prose carries those ids, so the diagram and the sentence
 * cannot disagree about which states are being talked about.
 */
export function highlighted(step: number, steps: readonly Step[]): number[] {
  return steps[step]?.highlight ?? [];
}

/**
 * Read a step from a URL fragment, and write one back.
 *
 * Task C7: a TA sends a link to round four rather than saying "scrub to round four". The
 * fragment rather than a query parameter, because it identifies a position *within* the page
 * — which is what fragments have always been for — and because changing it does not look like
 * a new page to anything watching navigation.
 *
 * One-based in the URL, zero-based in the code. `#nfa=1` is the first step, because a link
 * that starts counting at zero is a link written by a programmer for a student.
 */
export function readStepFrom(hash: string, key: string): number | undefined {
  const found = new URLSearchParams(hash.replace(/^#/, '')).get(key);
  if (found === null) return undefined;

  const parsed = Number.parseInt(found, 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed - 1 : undefined;
}

/** The fragment for a step, or `''` at the start — a link to step one needs no fragment. */
export function stepFragment(key: string, step: number): string {
  return step === 0 ? '' : `#${key}=${String(step + 1)}`;
}
