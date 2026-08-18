/**
 * What the overview says, as data.
 *
 * Separated from the markup so the page is a rendering of a list rather than a wall of JSX
 * with prose baked into it. That matters more than usual here: Phase 5 Track E's job is
 * largely *removing markers as they come true*, and doing that in a table is a one-line edit
 * where doing it in markup is a hunt.
 */

import { READY, planned, type Status } from '@/overview/status';

export interface Feature {
  title: string;
  /** One sentence. What it does, not what it is called. */
  detail: string;
  status: Status;
}

/**
 * The capabilities, in the order someone meets them.
 *
 * Draw, then check, then convert, then take it away — which is also the order the phases
 * build them in, because the plan follows how the tool is used rather than how it is layered.
 */
export const FEATURES: readonly Feature[] = [
  {
    title: 'Draw automata directly',
    detail:
      'Place states, drag transitions from a state’s edge, name symbols inline. Everything undoable, everything saved as you work.',
    status: READY,
  },
  {
    title: 'Read it three ways',
    detail:
      'The diagram, the transition table, and the formal 5-tuple — the same machine in the three notations the subject actually uses, each editable.',
    status: READY,
  },
  {
    title: 'Run a string, step by step',
    detail:
      'Watch the configuration set move through the machine one symbol at a time, with the tape and the reasoning for every step.',
    status: READY,
  },
  {
    title: 'Live validation',
    detail:
      'Unreachable states, missing transitions, a partial δ — named as you work, never as a dialog, and every problem clicks through to the state it is about.',
    status: READY,
  },
  {
    title: 'Watch a conversion happen',
    detail:
      'Regex to ε-NFA to DFA to minimal DFA, every round of subset construction and every partition split, with the reasoning attached to each step.',
    status: planned(3, 'the engine already produces these traces; this is the view for them'),
  },
  {
    title: 'Export to TikZ',
    detail:
      'One click from the diagram on screen to the LaTeX in an assignment, with the layout you arranged preserved.',
    status: planned(4),
  },
  {
    title: 'Share as a URL',
    detail: 'The whole automaton in a link. No account, no upload, nothing stored on a server.',
    status: planned(4),
  },
  {
    title: 'Work offline, or on the desktop',
    detail: 'An installable PWA, and a native build for people who prefer one.',
    status: planned(5),
  },
];

/** Roadmap §1.3, verbatim — the clearest single statement of why this exists. */
export const COMPARISON: readonly { aspect: string; jflap: string; kleene: string }[] = [
  { aspect: 'Install', jflap: 'JRE + jar download', kleene: 'Open a URL' },
  { aspect: 'Sharing', jflap: 'Email a .jff file', kleene: 'Copy a link' },
  { aspect: 'LaTeX', jflap: 'None', kleene: 'One-click TikZ' },
  { aspect: 'Explanation', jflap: 'Shows the result', kleene: 'Shows every step and why' },
  { aspect: 'Automation', jflap: 'None', kleene: 'CLI with equivalence checking' },
];
