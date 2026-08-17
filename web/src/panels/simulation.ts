/**
 * Reading a simulation, for the parts of the UI that are not the tester itself.
 *
 * Separate from `InputTester.tsx` because these are not components, and a module that mixes
 * components with helpers breaks fast refresh — every edit to a helper remounts the panel and
 * loses whatever was typed into it.
 */

import type { Simulation, StateId } from '@/model/automaton';

/** The states the machine is in at a given point, for the canvas to highlight. */
export function activeStates(simulation: Simulation | undefined, step: number): StateId[] {
  return simulation?.run.configurations[step]?.states ?? [];
}

/**
 * The valid position within a run, given a stored one.
 *
 * Clamped on read rather than corrected in an effect. An effect that fixed the stored value
 * would fire a second render for every keystroke that shortens the string — and it would also
 * *lose* the position: deleting a character and retyping it would land back at the start
 * instead of where the user had stepped to. Clamping on read keeps the position and costs
 * nothing.
 */
export function clampStep(step: number, length: number): number {
  return Math.min(step, Math.max(0, length - 1));
}
