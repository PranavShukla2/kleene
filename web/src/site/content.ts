/**
 * What the marketing pages say, as data.
 *
 * Same reasoning as `overview/content.ts` and the same discipline: Phase 5 Track E's job is
 * largely *removing markers as they come true*, and doing that in a table is a one-line edit
 * where doing it in markup is a hunt. This file is where the site's claims live, so they can
 * be audited in one place rather than found by reading JSX.
 */

import { READY, planned, type Status } from '@/overview/status';

/**
 * The numbers under the hero.
 *
 * Every one of them is checkable from the repository, which is the only kind worth printing.
 * No "10,000 students" — a number nobody can verify is decoration wearing a lab coat.
 */
export const STATS: readonly { value: string; label: string; detail: string }[] = [
  { value: '0', label: 'servers', detail: 'Nothing you draw leaves the browser.' },
  { value: '300+', label: 'tests', detail: 'Rust core, TypeScript views, and end to end.' },
  { value: '92 KB', label: 'engine', detail: 'The whole algorithm library, gzipped.' },
  { value: '£0', label: 'forever', detail: 'No plan, no seat, no trial.' },
];

/** The three sentences that describe the pipeline, in order. */
export const PIPELINE: readonly {
  step: string;
  title: string;
  detail: string;
  status: Status;
}[] = [
  {
    step: '01',
    title: 'Write it, or draw it',
    detail:
      'Type a regular expression and it compiles as you type, or place states on a canvas and drag transitions between them. Both ends of the pipeline are editable, and you can enter from either.',
    status: READY,
  },
  {
    step: '02',
    title: 'Watch it convert',
    detail:
      'Thompson’s construction, then subset construction, then minimization — with the machine drawn as it is built, the worklist draining beside it, and δ filling in cell by cell.',
    status: READY,
  },
  {
    step: '03',
    title: 'Take it with you',
    detail:
      'Export the diagram to TikZ for an assignment, share the whole machine as a URL, or check two machines for equivalence from the command line.',
    status: planned(4),
  },
];

/**
 * The differentiator, spelled out.
 *
 * Everything else on the page is a feature list. This is the argument: other tools show you
 * the answer, and an answer is exactly the thing a student already had at the back of the
 * textbook.
 */
export const TRACE_CLAIM = {
  heading: 'Every algorithm shows its working',
  detail:
    'Each conversion returns its reasoning alongside its result — not a log written afterwards by the interface, but a sentence produced in Rust beside the line of the algorithm that made the move. The step scrubber, the command line and the generated documentation all read the same trace, so there is no second explanation to drift out of step with the first.',
  /** Real output, copied from the engine. Not written for the page. */
  sample: [
    'The start state is the ε-closure of {q6} — that is {q0, q2, q4, q6, q7, q8}, which becomes A.',
    'Reading `a` from A = {q0, q2, q4, q6, q7, q8} reaches {q0, q1, q2, q4, q5, q7, q8, q9, q10} — that subset is new, so it becomes B and joins the worklist.',
    'Reading `b` from B = {q0, q1, q2, q4, q5, q7, q8, q9, q10} reaches {q0, q2, q3, q4, q5, q7, q8, q11, q12} — that subset is new, so it becomes D and joins the worklist.',
    'No subsets left to expand. The DFA has 5 states, 1 of them accepting.',
  ],
} as const;

/** Questions a visitor actually has, in the order they have them. */
export const FAQ: readonly { question: string; answer: string }[] = [
  {
    question: 'Is it really free?',
    answer:
      'Yes, and there is no version that is not. Kleene runs entirely in your browser — there is no server to pay for, so there is nothing to charge for. No account, no seats, no trial that expires.',
  },
  {
    question: 'Where is my work stored?',
    answer:
      'In this browser, in IndexedDB. Nothing is uploaded, because there is nowhere to upload it to. That is also why sharing works by putting the machine in a URL rather than by saving it somewhere and giving you a link to it.',
  },
  {
    question: 'How is this different from JFLAP?',
    answer:
      'JFLAP shows you the result. Kleene shows you how it got there — every round of subset construction, every partition split, with the reasoning attached to the step that produced it. It also opens in a browser rather than needing a Java runtime, and it exports to LaTeX.',
  },
  {
    question: 'Can I trust the answers?',
    answer:
      'The engine is a Rust library with over 300 tests, including property tests that check algebraic laws — determinizing a DFA does not change its language, minimizing twice is the same as minimizing once — and differential tests that check the conversions agree with each other. The same library runs in the browser, on the command line, and in the documentation.',
  },
  {
    question: 'Does it work offline?',
    answer:
      'Not yet. It will: an installable progressive web app is planned for phase 5, and so is a native desktop build. There is no technical obstacle, because nothing here needs a network in the first place.',
  },
  {
    question: 'Is it open source?',
    answer:
      'Yes. The Rust core, the WebAssembly bindings, the command line tool and this site are all in one repository, along with the full implementation plan — including the parts that are not built yet.',
  },
];

/** What a course actually needs, as the audience section. */
export const AUDIENCES: readonly {
  who: string;
  need: string;
  detail: string;
  status: Status;
}[] = [
  {
    who: 'Students',
    need: 'Understand why, not just what',
    detail:
      'Scrub through a conversion one step at a time and read the sentence that produced each move. Hover a DFA state to see the subset of NFA states it stands for.',
    status: READY,
  },
  {
    who: 'Lecturers',
    need: 'Diagrams that go straight into notes',
    detail:
      'Export any diagram to TikZ with the layout you arranged, or share a machine as a link that opens exactly what you drew.',
    status: planned(4),
  },
  {
    who: 'Graders',
    need: 'Check equivalence without checking by hand',
    detail:
      'A command line tool that takes two machines and tells you whether they accept the same language — and, when they do not, the shortest string that separates them.',
    status: planned(4),
  },
];
