/**
 * What is built, what is next, and when.
 *
 * Named `phases.ts`, not `roadmap.ts`, because the page beside it is `Roadmap.tsx` — two files
 * differing only by case in one directory resolve differently on a case-sensitive filesystem,
 * which is what CI runs on and this machine does not. The convention in this directory is
 * therefore: **data files are plural nouns, page components are a different word.**
 * `examples.ts` / `Gallery.tsx`, `phases.ts` / `Roadmap.tsx`.
 *
 * The data behind `/roadmap`, which exists so that *nothing else on the site has to carry a
 * "coming soon" badge*. One honest page beats a marker on every surface: markers accumulate,
 * get missed when the feature lands, and eventually describe a product that no longer exists.
 * A page has one owner and one place to be wrong.
 *
 * It is also the page that stays useful after v1. "What are you building next" is a question
 * people keep asking; "coming soon" stops being an answer the moment it ships.
 */

export type PhaseState = 'done' | 'building' | 'planned';

export interface Phase {
  number: number;
  title: string;
  state: PhaseState;
  /** What this phase makes possible, in the user's terms rather than the plan's. */
  summary: string;
  /** The concrete things, short enough to scan. */
  items: readonly string[];
}

export const PHASES: readonly Phase[] = [
  {
    number: 0,
    title: 'The toolchain',
    state: 'done',
    summary: 'Rust compiles to WebAssembly, runs in a browser, and deploys to a real URL.',
    items: ['Three-crate workspace', 'wasm boundary proven', 'CI green', 'Deployed'],
  },
  {
    number: 1,
    title: 'The engine',
    state: 'done',
    summary:
      'Every algorithm, headless, each one recording its reasoning as it goes — which is what later phases display.',
    items: [
      'Regex → ε-NFA (Thompson)',
      'ε-NFA → DFA (subset construction)',
      'DFA minimization (partition refinement)',
      'DFA → regex (state elimination)',
      'Equivalence and counterexample search',
      '160,000 generated test cases',
    ],
  },
  {
    number: 2,
    title: 'The editor',
    state: 'done',
    summary: 'Draw, edit and test a machine without touching a config file.',
    items: [
      'Canvas with pan, zoom and snapping',
      'Draw states and transitions by hand',
      'Transition table and formal 5-tuple, both editable',
      'Input tester with a step-through and a tape',
      'Live validation, undo for everything',
      'Automatic layout that never overwrites your own',
    ],
  },
  {
    number: 3,
    title: 'The conversion pipeline',
    state: 'building',
    summary:
      'The part nobody else has: watching a conversion happen, one round at a time, with the reason for each step.',
    items: [
      'Type a regex, get an ε-NFA as you type',
      'Four panes: regex, ε-NFA, DFA, minimal DFA',
      'Step scrubber over every round of subset construction',
      'Hover a DFA state to see which NFA states it came from',
      'Partition refinement, with the string that split each block',
    ],
  },
  {
    number: 4,
    title: 'Export and share',
    state: 'planned',
    summary: 'Getting the diagram out — into an assignment, or into someone else’s browser.',
    items: [
      'TikZ export, matching what is on screen',
      'SVG and PNG',
      'The whole automaton in a URL',
      'JFLAP .jff import',
    ],
  },
  {
    number: 5,
    title: 'Ship v1',
    state: 'planned',
    summary: 'The things that make it a tool people can rely on rather than one they try once.',
    items: [
      'About twenty curated examples',
      'Offline as an installed app, and a desktop build',
      'Documentation, generated from the same traces the UI shows',
      'A guided first run',
    ],
  },
];

/** What comes after v1, and only if v1 gets used. */
export const AFTER_V1 = {
  title: 'A teaching layer',
  detail:
    'Assignment links a lecturer can hand out, checked in the student’s own browser, with no accounts and no server holding anyone’s work. Only if v1 finds real users — building it first would be guessing.',
} as const;
