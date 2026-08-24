/**
 * The documentation map, as data.
 *
 * Split out of the page so the command palette can search it without importing a component —
 * and so a file exporting components exports only components, which is what keeps fast refresh
 * working on the page being edited.
 *
 * Named `articles.ts` rather than `docs.ts`, and that is not a preference. `Docs.tsx` and
 * `docs.ts` in one directory differ only in case, which macOS resolves and CI does not — and
 * TypeScript reports the collision as an unrelated "already included file" error while
 * silently dropping one of them from the program. This project has hit it twice before
 * (`Examples`, `Roadmap`); the rule is that a data file never shares a name with its
 * component.
 */

import { READY, planned, type Status } from '@/overview/status';
import type { Route } from '@/router';

export interface Article {
  title: string;
  detail: string;
  status: Status;
  /** Where it goes, when it goes anywhere. */
  route?: Route;
  /**
   * A document that lives in the repository rather than on this site.
   *
   * The reference material — the file format, the CLI — is written in Markdown beside the
   * code it describes, which is the only arrangement where it gets updated in the same commit
   * as the thing it documents. Linking out is honest about where it lives; copying it here
   * would create a second version to keep in step, and the second version always loses.
   */
  href?: string;
}

export const SECTIONS: readonly {
  heading: string;
  blurb: string;
  articles: readonly Article[];
}[] = [
  {
    heading: 'Getting started',
    blurb: 'Enough to draw a machine and run a string through it.',
    articles: [
      {
        title: 'Draw your first automaton',
        detail: 'Double-click to place a state, drag from its edge to make a transition.',
        status: READY,
        route: 'editor',
      },
      {
        title: 'Convert a regular expression',
        detail: 'Type an expression and watch all three stages build themselves.',
        status: READY,
        route: 'convert',
      },
      {
        title: 'Keyboard shortcuts',
        detail: 'Every gesture has one. Press ? in the editor for the full sheet.',
        status: READY,
        route: 'editor',
      },
      {
        title: 'Reading the trace',
        detail: 'What a step is, what the worklist means, and how to scrub one.',
        status: READY,
        route: 'convert',
      },
    ],
  },
  {
    heading: 'The notation',
    blurb: 'What the symbols on screen mean, in the terms a course uses.',
    articles: [
      {
        title: 'Regular expression syntax',
        detail:
          'Union, concatenation, Kleene star, ∅ and ε — and which spellings are accepted.',
        status: READY,
        route: 'convert',
      },
      {
        title: 'The 5-tuple',
        detail: 'M = (Q, Σ, δ, q₀, F), and where each part appears in the interface.',
        status: READY,
        route: 'editor',
      },
      {
        title: 'DFA, NFA and ε-NFA',
        detail: 'What the badge on your machine is telling you, and why it changes.',
        status: READY,
        route: 'learn',
      },
      {
        title: 'Notation settings',
        detail: 'Choosing between + and |, between ε and λ, and between δ styles.',
        // The engine has carried `notation.rs` since Phase 1; what is missing is the control
        // that lets you change it. Deferred rather than dropped — courses genuinely disagree
        // about these, and a tool that picks one has picked a side.
        status: planned(6),
      },
    ],
  },
  {
    heading: 'The algorithms',
    blurb: 'What each conversion does, and the reasoning it produces while doing it.',
    articles: [
      {
        title: 'Thompson’s construction',
        detail: 'Regular expression to ε-NFA, one operator at a time.',
        status: READY,
        route: 'convert',
      },
      {
        title: 'Subset construction',
        detail: 'ε-NFA to DFA, with the worklist and the ε-closures behind each round.',
        status: READY,
        route: 'convert',
      },
      {
        title: 'Minimization',
        detail: 'Partition refinement, and why two states end up in the same block.',
        status: READY,
        route: 'convert',
      },
      {
        title: 'State elimination',
        detail: 'DFA back to a regular expression, and why the order matters.',
        status: READY,
        route: 'convert',
      },
    ],
  },
  {
    heading: 'Taking it away',
    blurb: 'Getting a machine out of the browser and into something else.',
    articles: [
      {
        title: 'The .kln file format',
        detail: 'A documented JSON schema with a version field, so old files keep opening.',
        status: READY,
        href: 'https://github.com/PranavShukla2/kleene/blob/main/docs/formats/kln.md',
      },
      {
        title: 'The command line',
        detail: 'Converting, exporting and grading a directory of submissions from a script.',
        status: READY,
        href: 'https://github.com/PranavShukla2/kleene/blob/main/docs/cli.md',
      },
      {
        title: 'Exporting to TikZ',
        detail: 'The diagram, as LaTeX, with your layout kept.',
        status: READY,
        route: 'editor',
      },
      {
        title: 'Sharing as a URL',
        detail: 'How a machine is encoded into a link.',
        status: READY,
        route: 'editor',
      },
    ],
  },
];
